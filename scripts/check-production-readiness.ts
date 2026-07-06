import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Prisma } from "@prisma/client";
import { resolveAudioStorageConfig } from "../apps/web/src/server/audio-storage";
import { prisma } from "../apps/web/src/server/db";
import { verifyPassword } from "../apps/web/src/server/password";
import { checkSonioxRealtimeConnectivity } from "../apps/web/src/server/soniox-realtime";

const execFileAsync = promisify(execFile);

type CheckSeverity = "required" | "external";

type ReadinessCheck = {
  name: string;
  ok: boolean;
  severity: CheckSeverity;
  message: string;
};

function argValue(name: string) {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

function boolFlag(name: string) {
  return process.argv.includes(name);
}

function check(
  checks: ReadinessCheck[],
  input: {
    name: string;
    ok: boolean;
    severity?: CheckSeverity;
    message: string;
  },
) {
  checks.push({
    severity: input.severity ?? "required",
    ...input,
  });
}

async function serviceState(name: string) {
  try {
    const { stdout } = await execFileAsync("systemctl", [
      "show",
      name,
      "--property=ActiveState,NRestarts",
      "--no-pager",
    ]);
    const fields = Object.fromEntries(
      stdout
        .trim()
        .split(/\r?\n/)
        .map((line) => {
          const index = line.indexOf("=");
          return index > 0
            ? [line.slice(0, index), line.slice(index + 1)]
            : [line, ""];
        }),
    );
    const nRestarts = Number(fields.NRestarts ?? 0);
    return {
      active: fields.ActiveState === "active",
      nRestarts: Number.isFinite(nRestarts) ? nRestarts : null,
    };
  } catch {
    return { active: false, nRestarts: null };
  }
}

async function httpsOk(baseUrl: string) {
  try {
    const response = await fetch(baseUrl, { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}

async function securityHeadersOk(baseUrl: string) {
  try {
    const response = await fetch(baseUrl, { method: "HEAD" });
    const headers = response.headers;
    const hsts = headers.get("strict-transport-security") ?? "";
    const csp = headers.get("content-security-policy") ?? "";
    const frameOptions = headers.get("x-frame-options") ?? "";
    const contentTypeOptions = headers.get("x-content-type-options") ?? "";
    const referrerPolicy = headers.get("referrer-policy") ?? "";
    const missing = [
      hsts.toLowerCase().includes("max-age=")
        ? undefined
        : "strict-transport-security",
      csp.includes("frame-ancestors 'none'")
        ? undefined
        : "content-security-policy",
      frameOptions.toUpperCase() === "DENY" ? undefined : "x-frame-options",
      contentTypeOptions.toLowerCase() === "nosniff"
        ? undefined
        : "x-content-type-options",
      referrerPolicy === "strict-origin-when-cross-origin"
        ? undefined
        : "referrer-policy",
    ].filter((item): item is string => Boolean(item));
    return {
      ok: response.ok && missing.length === 0,
      message:
        missing.length === 0
          ? "Production security headers are present."
          : `Missing or invalid security headers: ${missing.join(", ")}.`,
    };
  } catch {
    return {
      ok: false,
      message: "Production security headers could not be checked.",
    };
  }
}

async function staticAssetOk(baseUrl: string) {
  try {
    const staticRoots = [
      process.env.BABBLEDECK_STATIC_ASSET_DIR,
      "/srv/aialra/releases/babbledeck/current/apps/web/.next/static/chunks",
      path.join(
        process.cwd(),
        "apps/web/.next/standalone/apps/web/.next/static/chunks",
      ),
      path.join(process.cwd(), "apps/web/.next/static/chunks"),
    ].filter((item): item is string => Boolean(item));
    let cssFile: string | undefined;
    for (const staticRoot of staticRoots) {
      try {
        const entries = await fs.readdir(staticRoot);
        cssFile = entries.find((entry) => entry.endsWith(".css"));
        if (cssFile) break;
      } catch {
        continue;
      }
    }
    if (!cssFile) {
      return false;
    }
    const response = await fetch(
      new URL(`/_next/static/chunks/${cssFile}`, baseUrl),
      { method: "HEAD" },
    );
    return (
      response.ok &&
      (response.headers.get("content-type") ?? "").includes("text/css")
    );
  } catch {
    return false;
  }
}

async function healthEndpointOk(baseUrl: string, expectedCommit?: string) {
  let releaseCommit: string | null = null;
  try {
    const response = await fetch(new URL("/api/health", baseUrl), {
      headers: { Accept: "application/json" },
    });
    const body = await response.json();
    const databaseOk = body?.data?.checks?.database?.ok === true;
    const storageOk = body?.data?.checks?.audioStorage?.ok === true;
    releaseCommit =
      typeof body?.data?.release?.commit === "string"
        ? body.data.release.commit
        : null;
    const releaseOk =
      !expectedCommit || releaseCommit === expectedCommit.trim();
    const coreOk = response.ok && body?.ok === true && databaseOk && storageOk;
    return {
      ok: coreOk && releaseOk,
      releaseCommit,
      message: coreOk
        ? releaseOk
          ? expectedCommit
            ? `Production health endpoint reports core service readiness for release ${expectedCommit}.`
            : "Production health endpoint reports core service readiness."
          : `Production health endpoint release commit ${releaseCommit ?? "unknown"} does not match expected ${expectedCommit}.`
        : "Production health endpoint did not report core service readiness.",
    };
  } catch {
    return {
      ok: false,
      releaseCommit,
      message: "Production health endpoint could not be checked.",
    };
  }
}

async function healthAlertStateOk() {
  const statePath =
    process.env.BABBLEDECK_HEALTH_ALERT_STATE ??
    "/srv/aialra/logs/babbledeck/health-monitor-state.json";
  try {
    const contents = await fs.readFile(statePath, "utf8");
    const state = JSON.parse(contents);
    const alertActive = state?.alertActive === true;
    const failureStreak = Number(state?.failureStreak ?? 0);
    return {
      ok: !alertActive,
      message: alertActive
        ? `Production health alert is active after ${failureStreak} consecutive monitor failures.`
        : "No active production health monitor alert.",
    };
  } catch {
    return {
      ok: true,
      message: "No active production health monitor alert state exists.",
    };
  }
}

async function seedAdminMatchesEnv() {
  const email = (
    process.env.SEED_ADMIN_EMAIL ?? "admin@example.invalid"
  ).toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password) {
    return {
      ok: false,
      message: "SEED_ADMIN_PASSWORD is not configured.",
    };
  }
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      passwordHash: true,
      role: true,
      disabledAt: true,
      passwordRotationRequired: true,
    },
  });
  if (!user) {
    return { ok: false, message: `Seed admin ${email} is missing.` };
  }
  const matches = await verifyPassword(password, user.passwordHash);
  return {
    ok:
      matches &&
      user.role === "ADMIN" &&
      !user.disabledAt &&
      !user.passwordRotationRequired,
    message: matches
      ? "Seed admin exists, is enabled, and matches SEED_ADMIN_PASSWORD."
      : "Seed admin password hash does not match SEED_ADMIN_PASSWORD.",
  };
}

function configuredEnv(names: string[]) {
  const name = names.find((item) => Boolean(process.env[item]?.trim()));
  return name ? { name, value: process.env[name]?.trim() ?? "" } : undefined;
}

function liveKitConfigured() {
  return Boolean(
    process.env.LIVEKIT_URL &&
    process.env.LIVEKIT_API_KEY &&
    process.env.LIVEKIT_API_SECRET,
  );
}

type ProductionAudioStorageTarget = {
  driver: "local" | "s3";
  bucket: string;
};

type ProductionAudioStorageStatus = {
  ok: boolean;
  target?: ProductionAudioStorageTarget;
  message: string;
};

async function selfHostedAudioStorageStatus(
  rootDirInput: string,
): Promise<ProductionAudioStorageStatus> {
  const rootDir = path.resolve(rootDirInput);
  const expectedRoot = path.resolve(
    process.env.BABBLEDECK_PRODUCTION_AUDIO_STORAGE_DIR ??
      "/srv/aialra/storage/babbledeck",
  );
  const workspaceRoot = path.resolve(process.cwd());
  const problems = [
    rootDir === expectedRoot
      ? undefined
      : `AUDIO_STORAGE_DIR resolves to ${rootDir}, expected ${expectedRoot}`,
    rootDir === workspaceRoot ||
    rootDir.startsWith(`${workspaceRoot}${path.sep}`)
      ? "AUDIO_STORAGE_DIR is inside the release/workspace tree"
      : undefined,
    rootDir === "/tmp" || rootDir.startsWith(`/tmp${path.sep}`)
      ? "AUDIO_STORAGE_DIR is under /tmp"
      : undefined,
  ].filter((item): item is string => Boolean(item));

  try {
    const stat = await fs.stat(rootDir);
    if (!stat.isDirectory()) {
      problems.push("AUDIO_STORAGE_DIR is not a directory");
    }
    await fs.access(
      rootDir,
      fsConstants.R_OK | fsConstants.W_OK | fsConstants.X_OK,
    );

    const probeDir = path.join(rootDir, ".readiness");
    const probeFile = path.join(
      probeDir,
      `probe-${process.pid}-${Date.now()}.txt`,
    );
    try {
      await fs.mkdir(probeDir, { recursive: true, mode: 0o700 });
      await fs.writeFile(probeFile, "babbledeck audio storage readiness\n", {
        mode: 0o600,
      });
      const probeContents = await fs.readFile(probeFile, "utf8");
      if (probeContents !== "babbledeck audio storage readiness\n") {
        problems.push("AUDIO_STORAGE_DIR probe readback did not match");
      }
    } finally {
      await fs.rm(probeFile, { force: true }).catch(() => undefined);
    }
  } catch (error) {
    problems.push(
      error instanceof Error
        ? `AUDIO_STORAGE_DIR check failed: ${error.message}`
        : "AUDIO_STORAGE_DIR check failed.",
    );
  }

  return {
    ok: problems.length === 0,
    target: { driver: "local", bucket: "" },
    message:
      problems.length === 0
        ? `Self-hosted production audio storage is persistent and writable at ${rootDir}.`
        : `Self-hosted production audio storage is not ready: ${problems.join("; ")}.`,
  };
}

function s3AudioStorageStatus(): ProductionAudioStorageStatus {
  const driverSetting = process.env.AUDIO_STORAGE_DRIVER?.toLowerCase();
  const bucketVar = configuredEnv([
    "AUDIO_STORAGE_BUCKET",
    "R2_BUCKET",
    "S3_BUCKET",
  ]);
  const endpointVar = configuredEnv([
    "AUDIO_STORAGE_ENDPOINT",
    "R2_ENDPOINT",
    "R2_ACCOUNT_ID",
    "S3_ENDPOINT",
  ]);
  const accessKeyVar = configuredEnv([
    "AUDIO_STORAGE_ACCESS_KEY_ID",
    "R2_ACCESS_KEY_ID",
    "S3_ACCESS_KEY_ID",
    "AWS_ACCESS_KEY_ID",
  ]);
  const secretKeyVar = configuredEnv([
    "AUDIO_STORAGE_SECRET_ACCESS_KEY",
    "R2_SECRET_ACCESS_KEY",
    "S3_SECRET_ACCESS_KEY",
    "AWS_SECRET_ACCESS_KEY",
  ]);
  const requiresEndpoint =
    driverSetting === "r2" ||
    Boolean(process.env.R2_BUCKET) ||
    Boolean(process.env.R2_ENDPOINT) ||
    Boolean(process.env.R2_ACCOUNT_ID) ||
    Boolean(process.env.AUDIO_STORAGE_ENDPOINT) ||
    Boolean(process.env.S3_ENDPOINT);
  const missing = [
    bucketVar ? undefined : "AUDIO_STORAGE_BUCKET/R2_BUCKET/S3_BUCKET",
    requiresEndpoint && !endpointVar
      ? "AUDIO_STORAGE_ENDPOINT/R2_ENDPOINT/R2_ACCOUNT_ID/S3_ENDPOINT"
      : undefined,
    accessKeyVar
      ? undefined
      : "AUDIO_STORAGE_ACCESS_KEY_ID/R2_ACCESS_KEY_ID/S3_ACCESS_KEY_ID/AWS_ACCESS_KEY_ID",
    secretKeyVar
      ? undefined
      : "AUDIO_STORAGE_SECRET_ACCESS_KEY/R2_SECRET_ACCESS_KEY/S3_SECRET_ACCESS_KEY/AWS_SECRET_ACCESS_KEY",
  ].filter((item): item is string => Boolean(item));

  return {
    ok: missing.length === 0,
    target: bucketVar ? { driver: "s3", bucket: bucketVar.value } : undefined,
    message:
      missing.length === 0
        ? "R2/S3-compatible production audio storage target and credentials are configured."
        : `R2/S3-compatible production audio storage is incomplete; missing ${missing.join(", ")}.`,
  };
}

async function productionAudioStorageStatus(): Promise<ProductionAudioStorageStatus> {
  try {
    const config = resolveAudioStorageConfig();
    if (config.driver === "local") {
      return await selfHostedAudioStorageStatus(config.rootDir);
    }
    return s3AudioStorageStatus();
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? `Production audio storage config is invalid: ${error.message}`
          : "Production audio storage config is invalid.",
    };
  }
}

async function audioChunksOnCurrentTarget(
  target: ProductionAudioStorageTarget,
) {
  const bucket = target.driver === "s3" ? target.bucket : "";
  const rows = await prisma.$queryRaw<
    { total: bigint; matching: bigint }[]
  >(Prisma.sql`
    select
      count(*)::bigint as total,
      count(*) filter (
        where metadata->>'storageDriver' = ${target.driver}
          and coalesce(metadata->>'storageBucket', '') = ${bucket}
      )::bigint as matching
    from audio_chunks
    where status = 'UPLOADED'
  `);
  const total = Number(rows[0]?.total ?? 0n);
  const matching = Number(rows[0]?.matching ?? 0n);
  return {
    ok: total === matching,
    message:
      total === matching
        ? `All ${total} uploaded audio chunks are marked on the current ${target.driver === "local" ? "self-hosted" : "R2/S3-compatible"} target.`
        : `${total - matching} of ${total} uploaded audio chunks are not marked on the current ${target.driver === "local" ? "self-hosted" : "R2/S3-compatible"} target.`,
  };
}

async function latestBackupOk() {
  const backupRoot =
    process.env.BABBLEDECK_BACKUP_ROOT ?? "/srv/aialra/backups/babbledeck";
  try {
    const entries = await fs.readdir(backupRoot, { withFileTypes: true });
    return entries.some((entry) => entry.isDirectory());
  } catch {
    return false;
  }
}

async function recentBackupVerificationOk() {
  const backupRoot =
    process.env.BABBLEDECK_BACKUP_ROOT ?? "/srv/aialra/backups/babbledeck";
  const maxAgeHours = Number(
    process.env.BABBLEDECK_BACKUP_VERIFY_MAX_AGE_HOURS ?? 48,
  );
  const maxAgeMs =
    Number.isFinite(maxAgeHours) && maxAgeHours > 0
      ? maxAgeHours * 60 * 60 * 1000
      : 48 * 60 * 60 * 1000;
  try {
    const entries = await fs.readdir(backupRoot, { withFileTypes: true });
    const now = Date.now();
    for (const entry of entries) {
      if (!entry.isDirectory() || !/^20\d{6}T\d{6}Z$/.test(entry.name)) {
        continue;
      }
      const markerPath = path.join(
        backupRoot,
        entry.name,
        "verify-counts.last.json",
      );
      try {
        const stat = await fs.stat(markerPath);
        if (now - stat.mtimeMs <= maxAgeMs) return true;
      } catch {
        // Keep scanning older backups.
      }
    }
  } catch {
    return false;
  }
  return false;
}

async function recentMetricsSnapshotOk() {
  const metricsLog =
    process.env.BABBLEDECK_METRICS_LOG ??
    "/srv/aialra/logs/babbledeck/metrics.jsonl";
  const maxAgeMinutes = Number(
    process.env.BABBLEDECK_METRICS_MAX_AGE_MINUTES ?? 15,
  );
  const maxAgeMs =
    Number.isFinite(maxAgeMinutes) && maxAgeMinutes > 0
      ? maxAgeMinutes * 60 * 1000
      : 15 * 60 * 1000;
  try {
    const stat = await fs.stat(metricsLog);
    if (Date.now() - stat.mtimeMs > maxAgeMs) {
      return {
        ok: false,
        message: `Production metrics snapshot is older than ${Math.round(maxAgeMs / 60000)} minutes.`,
      };
    }

    const contents = await fs.readFile(metricsLog, "utf8");
    const latest = contents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .at(-1);
    if (!latest) {
      return {
        ok: false,
        message: "Production metrics log exists but has no JSONL records.",
      };
    }

    const record = JSON.parse(latest);
    const collectedAtMs = Date.parse(record.collectedAt);
    const freshCollectedAt =
      Number.isFinite(collectedAtMs) && Date.now() - collectedAtMs <= maxAgeMs;
    return {
      ok:
        record.app === "babbledeck" &&
        Number(record.windowSeconds) > 0 &&
        freshCollectedAt,
      message:
        record.app === "babbledeck" && freshCollectedAt
          ? "A recent production metrics JSONL snapshot exists."
          : "Latest production metrics JSONL snapshot is missing required fields or is stale.",
    };
  } catch {
    return {
      ok: false,
      message: "Production metrics JSONL snapshot could not be checked.",
    };
  }
}

async function recentBuildCacheCleanupOk() {
  const cleanupLog =
    process.env.BABBLEDECK_BUILD_CACHE_CLEANUP_LOG ??
    "/srv/aialra/logs/babbledeck/build-cache-cleanups.jsonl";
  const maxAgeHours = Number(
    process.env.BABBLEDECK_BUILD_CACHE_CLEANUP_MAX_AGE_HOURS ?? 48,
  );
  const maxAgeMs =
    Number.isFinite(maxAgeHours) && maxAgeHours > 0
      ? maxAgeHours * 60 * 60 * 1000
      : 48 * 60 * 60 * 1000;
  try {
    const stat = await fs.stat(cleanupLog);
    if (Date.now() - stat.mtimeMs > maxAgeMs) {
      return {
        ok: false,
        message: `Production build-cache cleanup is older than ${Math.round(maxAgeMs / 3600000)} hours.`,
      };
    }

    const contents = await fs.readFile(cleanupLog, "utf8");
    const records = contents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const latest = records
      .slice()
      .reverse()
      .find((record) => record.dryRun === false);
    if (!latest) {
      return {
        ok: false,
        message:
          "Production build-cache cleanup log exists but has no non-dry-run JSONL records.",
      };
    }

    const record = latest;
    const finishedAtMs = Date.parse(record.finishedAt);
    const freshFinishedAt =
      Number.isFinite(finishedAtMs) && Date.now() - finishedAtMs <= maxAgeMs;
    const diskOk =
      record.skipped === true ||
      (Number.isFinite(Number(record.disk?.beforeAvailableMb)) &&
        Number.isFinite(Number(record.disk?.afterAvailableMb)) &&
        Number.isFinite(Number(record.disk?.plannedRemovedMb)));
    return {
      ok:
        record.app === "babbledeck" &&
        record.dryRun === false &&
        freshFinishedAt &&
        diskOk,
      message:
        record.app === "babbledeck" &&
        record.dryRun === false &&
        freshFinishedAt &&
        diskOk
          ? record.skipped === true
            ? "Recent production build-cache cleanup skipped safely because the deployment lock was active."
            : `Recent production build-cache cleanup ran with ${Number(record.disk?.plannedRemovedMb ?? 0)}MB planned for removal.`
          : "Latest production build-cache cleanup JSONL record is missing required fields, dry-run only, failed, or is stale.",
    };
  } catch {
    return {
      ok: false,
      message:
        "Production build-cache cleanup JSONL record could not be checked.",
    };
  }
}

async function recentLoadSmokeOk() {
  const loadSmokeLog =
    process.env.BABBLEDECK_LOAD_SMOKE_LOG ??
    "/srv/aialra/logs/babbledeck/load-smoke.jsonl";
  const maxAgeHours = Number(
    process.env.BABBLEDECK_LOAD_SMOKE_MAX_AGE_HOURS ?? 168,
  );
  const maxAgeMs =
    Number.isFinite(maxAgeHours) && maxAgeHours > 0
      ? maxAgeHours * 60 * 60 * 1000
      : 168 * 60 * 60 * 1000;
  try {
    const stat = await fs.stat(loadSmokeLog);
    if (Date.now() - stat.mtimeMs > maxAgeMs) {
      return {
        ok: false,
        message: `Production load smoke is older than ${Math.round(maxAgeMs / 3600000)} hours.`,
      };
    }

    const contents = await fs.readFile(loadSmokeLog, "utf8");
    const latest = contents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .at(-1);
    if (!latest) {
      return {
        ok: false,
        message: "Production load smoke log exists but has no JSONL records.",
      };
    }

    const record = JSON.parse(latest);
    const finishedAtMs = Date.parse(record.finishedAt);
    const freshFinishedAt =
      Number.isFinite(finishedAtMs) && Date.now() - finishedAtMs <= maxAgeMs;
    const viewerCount = Number(record.viewerCount ?? 0);
    const received = Number(record.transcriptFanout?.received ?? 0);
    return {
      ok:
        record.app === "babbledeck" &&
        record.ok === true &&
        viewerCount > 0 &&
        received === viewerCount &&
        freshFinishedAt,
      message:
        record.app === "babbledeck" &&
        record.ok === true &&
        received === viewerCount &&
        freshFinishedAt
          ? `Recent production load smoke passed with ${viewerCount} viewers.`
          : "Latest production load smoke JSONL record is missing required fields, failed, or is stale.",
    };
  } catch {
    return {
      ok: false,
      message: "Production load smoke JSONL record could not be checked.",
    };
  }
}

async function recentSonioxSmokeOk() {
  const sonioxSmokeLog =
    process.env.BABBLEDECK_SONIOX_SMOKE_LOG ??
    "/srv/aialra/logs/babbledeck/soniox-smoke.jsonl";
  const maxAgeHours = Number(
    process.env.BABBLEDECK_SONIOX_SMOKE_MAX_AGE_HOURS ?? 168,
  );
  const maxAgeMs =
    Number.isFinite(maxAgeHours) && maxAgeHours > 0
      ? maxAgeHours * 60 * 60 * 1000
      : 168 * 60 * 60 * 1000;
  try {
    const stat = await fs.stat(sonioxSmokeLog);
    if (Date.now() - stat.mtimeMs > maxAgeMs) {
      return {
        ok: false,
        message: `Production Soniox recorder smoke is older than ${Math.round(maxAgeMs / 3600000)} hours.`,
      };
    }

    const contents = await fs.readFile(sonioxSmokeLog, "utf8");
    const latest = contents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .at(-1);
    if (!latest) {
      return {
        ok: false,
        message: "Production Soniox smoke log exists but has no JSONL records.",
      };
    }

    const record = JSON.parse(latest);
    const finishedAtMs = Date.parse(record.finishedAt);
    const freshFinishedAt =
      Number.isFinite(finishedAtMs) && Date.now() - finishedAtMs <= maxAgeMs;
    const probeDurationMs = Number(record.probeDurationMs ?? 0);
    const usageAudioMs = Array.isArray(record.providerUsage)
      ? record.providerUsage.reduce(
          (sum: number, item: { audioMs?: number | null }) =>
            sum + Number(item?.audioMs ?? 0),
          0,
        )
      : 0;
    return {
      ok:
        record.app === "babbledeck" &&
        record.ok === true &&
        record.recorderWs?.ready === true &&
        record.recorderWs?.ack === true &&
        Number(record.audioChunks) === 1 &&
        Number(record.providerErrors) === 0 &&
        usageAudioMs >= probeDurationMs &&
        freshFinishedAt,
      message:
        record.app === "babbledeck" &&
        record.ok === true &&
        Number(record.providerErrors) === 0 &&
        freshFinishedAt
          ? `Recent production Soniox recorder smoke passed with ${usageAudioMs}ms provider usage.`
          : "Latest production Soniox smoke JSONL record is missing required fields, failed, or is stale.",
    };
  } catch {
    return {
      ok: false,
      message: "Production Soniox smoke JSONL record could not be checked.",
    };
  }
}

async function recentSonioxUiSmokeOk() {
  const sonioxUiSmokeLog =
    process.env.BABBLEDECK_SONIOX_UI_SMOKE_LOG ??
    "/srv/aialra/logs/babbledeck/soniox-ui-smoke.jsonl";
  const maxAgeHours = Number(
    process.env.BABBLEDECK_SONIOX_UI_SMOKE_MAX_AGE_HOURS ?? 168,
  );
  const maxAgeMs =
    Number.isFinite(maxAgeHours) && maxAgeHours > 0
      ? maxAgeHours * 60 * 60 * 1000
      : 168 * 60 * 60 * 1000;
  try {
    const stat = await fs.stat(sonioxUiSmokeLog);
    if (Date.now() - stat.mtimeMs > maxAgeMs) {
      return {
        ok: false,
        message: `Production Soniox UI smoke is older than ${Math.round(maxAgeMs / 3600000)} hours.`,
      };
    }

    const contents = await fs.readFile(sonioxUiSmokeLog, "utf8");
    const latest = contents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .at(-1);
    if (!latest) {
      return {
        ok: false,
        message:
          "Production Soniox UI smoke log exists but has no JSONL records.",
      };
    }

    const record = JSON.parse(latest);
    const finishedAtMs = Date.parse(record.finishedAt);
    const freshFinishedAt =
      Number.isFinite(finishedAtMs) && Date.now() - finishedAtMs <= maxAgeMs;
    return {
      ok:
        record.app === "babbledeck" &&
        record.ok === true &&
        Number(record.playwright?.status) === 0 &&
        record.playwright?.passed === true &&
        record.fakeAudio?.generated === true &&
        freshFinishedAt,
      message:
        record.app === "babbledeck" &&
        record.ok === true &&
        record.playwright?.passed === true &&
        freshFinishedAt
          ? "Recent production Soniox UI smoke passed through Chromium fake-microphone capture."
          : "Latest production Soniox UI smoke JSONL record is missing required fields, failed, or is stale.",
    };
  } catch {
    return {
      ok: false,
      message: "Production Soniox UI smoke JSONL record could not be checked.",
    };
  }
}

async function recentSonioxTraceOk() {
  const sonioxTraceLog =
    process.env.BABBLEDECK_SONIOX_TRACE_LOG ??
    "/srv/aialra/logs/babbledeck/soniox-trace.jsonl";
  const maxAgeHours = Number(
    process.env.BABBLEDECK_SONIOX_TRACE_MAX_AGE_HOURS ?? 168,
  );
  const maxAgeMs =
    Number.isFinite(maxAgeHours) && maxAgeHours > 0
      ? maxAgeHours * 60 * 60 * 1000
      : 168 * 60 * 60 * 1000;
  try {
    const stat = await fs.stat(sonioxTraceLog);
    if (Date.now() - stat.mtimeMs > maxAgeMs) {
      return {
        ok: false,
        message: `Production Soniox trace is older than ${Math.round(maxAgeMs / 3600000)} hours.`,
      };
    }

    const contents = await fs.readFile(sonioxTraceLog, "utf8");
    const latest = contents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .at(-1);
    if (!latest) {
      return {
        ok: false,
        message: "Production Soniox trace log exists but has no JSONL records.",
      };
    }

    const record = JSON.parse(latest);
    const finishedAtMs = Date.parse(record.finishedAt);
    const freshFinishedAt =
      Number.isFinite(finishedAtMs) && Date.now() - finishedAtMs <= maxAgeMs;
    const expectedMatches = Array.isArray(
      record.transcript?.expectedTextMatches,
    )
      ? record.transcript.expectedTextMatches
      : [];
    const allExpectedMatched =
      expectedMatches.length > 0 &&
      expectedMatches.every((item: { matched?: boolean }) => item.matched);
    const minUsageMs = Number(record.thresholds?.minUsageMs ?? 0);
    const minAudioChunks = Number(record.thresholds?.minAudioChunks ?? 0);
    const minSegments = Number(record.thresholds?.minSegments ?? 0);
    const providerUsageMs = Number(record.providerUsage?.totalAudioMs ?? 0);
    const audioChunks = Number(record.audioChunks?.count ?? 0);
    const segmentCount = Number(record.transcript?.segmentCount ?? 0);
    return {
      ok:
        record.app === "babbledeck" &&
        record.ok === true &&
        record.archived === true &&
        Number(record.playwright?.status) === 0 &&
        record.playwright?.passed === true &&
        record.fakeAudio?.generated === true &&
        Number(record.providerErrors) === 0 &&
        providerUsageMs >= minUsageMs &&
        audioChunks >= minAudioChunks &&
        segmentCount >= minSegments &&
        allExpectedMatched &&
        freshFinishedAt,
      message:
        record.app === "babbledeck" &&
        record.ok === true &&
        Number(record.providerErrors) === 0 &&
        allExpectedMatched &&
        freshFinishedAt
          ? `Recent production Soniox long trace passed with ${providerUsageMs}ms provider usage, ${audioChunks} audio chunks, and ${segmentCount} transcript segment(s).`
          : "Latest production Soniox trace JSONL record is missing required fields, failed, or is stale.",
    };
  } catch {
    return {
      ok: false,
      message: "Production Soniox trace JSONL record could not be checked.",
    };
  }
}

async function recentLiveKitUiSmokeOk() {
  const liveKitUiSmokeLog =
    process.env.BABBLEDECK_LIVEKIT_UI_SMOKE_LOG ??
    "/srv/aialra/logs/babbledeck/livekit-ui-smoke.jsonl";
  const maxAgeHours = Number(
    process.env.BABBLEDECK_LIVEKIT_UI_SMOKE_MAX_AGE_HOURS ?? 168,
  );
  const maxAgeMs =
    Number.isFinite(maxAgeHours) && maxAgeHours > 0
      ? maxAgeHours * 60 * 60 * 1000
      : 168 * 60 * 60 * 1000;
  try {
    const stat = await fs.stat(liveKitUiSmokeLog);
    if (Date.now() - stat.mtimeMs > maxAgeMs) {
      return {
        ok: false,
        message: `Production LiveKit UI smoke is older than ${Math.round(maxAgeMs / 3600000)} hours.`,
      };
    }

    const contents = await fs.readFile(liveKitUiSmokeLog, "utf8");
    const latest = contents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .at(-1);
    if (!latest) {
      return {
        ok: false,
        message:
          "Production LiveKit UI smoke log exists but has no JSONL records.",
      };
    }

    const record = JSON.parse(latest);
    const finishedAtMs = Date.parse(record.finishedAt);
    const freshFinishedAt =
      Number.isFinite(finishedAtMs) && Date.now() - finishedAtMs <= maxAgeMs;
    return {
      ok:
        record.app === "babbledeck" &&
        record.ok === true &&
        Number(record.playwright?.status) === 0 &&
        record.playwright?.passed === true &&
        freshFinishedAt,
      message:
        record.app === "babbledeck" &&
        record.ok === true &&
        record.playwright?.passed === true &&
        freshFinishedAt
          ? "Recent production LiveKit UI smoke passed through recorder publishing and viewer room audio."
          : "Latest production LiveKit UI smoke JSONL record is missing required fields, failed, or is stale.",
    };
  } catch {
    return {
      ok: false,
      message: "Production LiveKit UI smoke JSONL record could not be checked.",
    };
  }
}

function normalizedUrl(value: unknown) {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
  } catch {
    return value.replace(/\/+$/, "");
  }
}

function validDeviceRuntimeRecord(input: {
  record: Record<string, unknown>;
  platform: string;
  baseUrl: string;
  maxAgeMs: number;
  releaseCommit?: string | null;
}) {
  const recordedAtMs = Date.parse(String(input.record.recordedAt ?? ""));
  const fresh =
    Number.isFinite(recordedAtMs) &&
    Date.now() - recordedAtMs <= input.maxAgeMs;
  const checks =
    input.record.checks &&
    typeof input.record.checks === "object" &&
    !Array.isArray(input.record.checks)
      ? (input.record.checks as Record<string, unknown>)
      : {};
  const checksOk = [
    "productionUrlOpened",
    "microphoneGranted",
    "recordingStarted",
    "captionsVisible",
    "audioBackupConfirmed",
  ].every((name) => checks[name] === true);
  const release =
    input.record.release &&
    typeof input.record.release === "object" &&
    !Array.isArray(input.record.release)
      ? (input.record.release as Record<string, unknown>)
      : {};
  const releaseCommitOk =
    !input.releaseCommit || release.commit === input.releaseCommit;

  return (
    input.record.app === "babbledeck" &&
    input.record.platform === input.platform &&
    input.record.ok === true &&
    normalizedUrl(input.record.baseUrl) === normalizedUrl(input.baseUrl) &&
    fresh &&
    checksOk &&
    releaseCommitOk
  );
}

async function recentDeviceRuntimeEvidenceOk(
  baseUrl: string,
  releaseCommit?: string | null,
) {
  const deviceRuntimeLog =
    process.env.BABBLEDECK_DEVICE_RUNTIME_LOG ??
    "/srv/aialra/logs/babbledeck/device-runtime.jsonl";
  const maxAgeHours = Number(
    process.env.BABBLEDECK_DEVICE_RUNTIME_MAX_AGE_HOURS ?? 720,
  );
  const maxAgeMs =
    Number.isFinite(maxAgeHours) && maxAgeHours > 0
      ? maxAgeHours * 60 * 60 * 1000
      : 720 * 60 * 60 * 1000;
  const platforms = ["android", "ios", "desktop"];

  try {
    const contents = await fs.readFile(deviceRuntimeLog, "utf8");
    const records = contents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    const missingOrInvalid = platforms.filter((platform) => {
      const latest = records
        .filter((record) => record.platform === platform)
        .sort((a, b) =>
          String(b.recordedAt ?? "").localeCompare(String(a.recordedAt ?? "")),
        )[0];
      return (
        !latest ||
        !validDeviceRuntimeRecord({
          record: latest,
          platform,
          baseUrl,
          maxAgeMs,
          releaseCommit,
        })
      );
    });

    return {
      ok: missingOrInvalid.length === 0,
      message:
        missingOrInvalid.length === 0
          ? `Recent production device runtime evidence passed for Android, iOS, and desktop wrappers${releaseCommit ? ` on release ${releaseCommit}` : ""}.`
          : `Missing, stale, or release-mismatched production device runtime evidence for ${missingOrInvalid.join(", ")}.`,
    };
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return {
        ok: false,
        message:
          "Missing production device runtime evidence for android, ios, desktop.",
      };
    }
    return {
      ok: false,
      message:
        "Production device runtime evidence JSONL record could not be checked.",
    };
  }
}

async function recentSecurityBaselineOk() {
  const securityLog =
    process.env.BABBLEDECK_SECURITY_BASELINE_LOG ??
    "/srv/aialra/logs/babbledeck/security-baseline.jsonl";
  const maxAgeHours = Number(
    process.env.BABBLEDECK_SECURITY_BASELINE_MAX_AGE_HOURS ?? 168,
  );
  const maxAgeMs =
    Number.isFinite(maxAgeHours) && maxAgeHours > 0
      ? maxAgeHours * 60 * 60 * 1000
      : 168 * 60 * 60 * 1000;
  try {
    const stat = await fs.stat(securityLog);
    if (Date.now() - stat.mtimeMs > maxAgeMs) {
      return {
        ok: false,
        message: `Production security baseline audit is older than ${Math.round(maxAgeMs / 3600000)} hours.`,
      };
    }

    const contents = await fs.readFile(securityLog, "utf8");
    const latest = contents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .at(-1);
    if (!latest) {
      return {
        ok: false,
        message:
          "Production security baseline log exists but has no JSONL records.",
      };
    }

    const record = JSON.parse(latest);
    const checkedAtMs = Date.parse(record.checkedAt);
    const freshCheckedAt =
      Number.isFinite(checkedAtMs) && Date.now() - checkedAtMs <= maxAgeMs;
    const checks = Array.isArray(record.checks) ? record.checks : [];
    const checksOk =
      checks.length > 0 && checks.every((item) => item?.ok === true);
    return {
      ok:
        record.app === "babbledeck" &&
        record.ok === true &&
        checksOk &&
        freshCheckedAt,
      message:
        record.app === "babbledeck" &&
        record.ok === true &&
        checksOk &&
        freshCheckedAt
          ? `Recent production security baseline audit passed with ${checks.length} checks.`
          : "Latest production security baseline JSONL record is missing required fields, failed, or is stale.",
    };
  } catch {
    return {
      ok: false,
      message:
        "Production security baseline JSONL record could not be checked.",
    };
  }
}

async function logrotateConfigOk() {
  const configPath =
    process.env.BABBLEDECK_LOGROTATE_CONFIG ??
    "/etc/logrotate.d/aialra-babbledeck";
  try {
    const contents = await fs.readFile(configPath, "utf8");
    return (
      contents.includes("/srv/aialra/logs/babbledeck/*.log") &&
      contents.includes("/srv/aialra/logs/babbledeck/*.jsonl") &&
      contents.includes("copytruncate")
    );
  } catch {
    return false;
  }
}

async function main() {
  const strict = boolFlag("--strict");
  const checkSonioxLive =
    boolFlag("--check-soniox-live") ||
    process.env.SONIOX_READINESS_LIVE_CHECK === "true";
  const baseUrl =
    argValue("--base-url") ??
    process.env.PRODUCTION_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "https://babbledeck.aialra.online";
  const expectedReleaseCommit =
    argValue("--expected-release-commit") ??
    process.env.BABBLEDECK_EXPECT_RELEASE_COMMIT;
  const checks: ReadinessCheck[] = [];

  check(checks, {
    name: "database_url",
    ok: Boolean(process.env.DATABASE_URL),
    message: process.env.DATABASE_URL
      ? "DATABASE_URL is configured."
      : "DATABASE_URL is missing.",
  });

  const seedCheck = await seedAdminMatchesEnv();
  check(checks, {
    name: "seed_admin_credentials",
    ok: seedCheck.ok,
    message: seedCheck.message,
  });

  check(checks, {
    name: "soniox_api_key",
    ok: Boolean(process.env.SONIOX_API_KEY),
    message: process.env.SONIOX_API_KEY
      ? "SONIOX_API_KEY is configured."
      : "SONIOX_API_KEY is missing.",
  });

  const liveKitReady = liveKitConfigured();
  check(checks, {
    name: "livekit_credentials",
    ok: liveKitReady,
    message: liveKitReady
      ? "LiveKit room-audio credentials are configured."
      : "LiveKit room-audio credentials are missing.",
  });

  if (checkSonioxLive) {
    const sonioxLive = await checkSonioxRealtimeConnectivity({
      sessionId: `readiness-${Date.now()}`,
      targetLanguage: process.env.SONIOX_DEFAULT_TARGET_LANGUAGE ?? "zh",
      sourceLanguageMode: "auto",
    });
    check(checks, {
      name: "soniox_realtime_connectivity",
      ok: sonioxLive.ok,
      message: sonioxLive.ok
        ? `${sonioxLive.message} Audio processed: ${sonioxLive.audioProcessedMs ?? 0}ms.`
        : sonioxLive.message,
    });
  }

  const coreServices = [
    "aialra-babbledeck.service",
    "aialra-babbledeck-ws.service",
    ...(liveKitReady ? ["aialra-babbledeck-livekit.service"] : []),
  ];
  for (const service of [
    ...coreServices,
    "aialra-babbledeck-backup.timer",
    "aialra-babbledeck-backup-verify.timer",
    "aialra-babbledeck-audio-retention.timer",
    "aialra-babbledeck-health-monitor.timer",
    "aialra-babbledeck-metrics.timer",
    "aialra-babbledeck-build-cache-cleanup.timer",
  ]) {
    const state = await serviceState(service);
    check(checks, {
      name: service,
      ok: state.active,
      message: state.active
        ? `${service} is active.`
        : `${service} is not active.`,
    });
    if (coreServices.includes(service)) {
      check(checks, {
        name: `${service}_restart_count`,
        ok: state.nRestarts === 0,
        message:
          state.nRestarts === 0
            ? `${service} has not auto-restarted since the current service start.`
            : `${service} has auto-restarted ${state.nRestarts ?? "an unknown number of"} time(s); inspect service logs before release.`,
      });
    }
  }

  check(checks, {
    name: "https",
    ok: await httpsOk(baseUrl),
    message: `${baseUrl} responds over HTTPS.`,
  });

  const securityHeaders = await securityHeadersOk(baseUrl);
  check(checks, {
    name: "security_headers",
    ok: securityHeaders.ok,
    message: securityHeaders.message,
  });

  check(checks, {
    name: "standalone_static_assets",
    ok: await staticAssetOk(baseUrl),
    message: "Standalone static assets are served with the expected MIME type.",
  });

  const healthEndpoint = await healthEndpointOk(baseUrl, expectedReleaseCommit);
  check(checks, {
    name: "health_endpoint",
    ok: healthEndpoint.ok,
    message: healthEndpoint.message,
  });

  const healthAlert = await healthAlertStateOk();
  check(checks, {
    name: "health_alert_state",
    ok: healthAlert.ok,
    message: healthAlert.message,
  });

  check(checks, {
    name: "latest_backup_present",
    ok: await latestBackupOk(),
    message: "At least one production backup directory exists.",
  });

  check(checks, {
    name: "recent_backup_verification",
    ok: await recentBackupVerificationOk(),
    message: "A recent production backup restore verification exists.",
  });

  const metricsSnapshot = await recentMetricsSnapshotOk();
  check(checks, {
    name: "recent_metrics_snapshot",
    ok: metricsSnapshot.ok,
    message: metricsSnapshot.message,
  });

  const buildCacheCleanup = await recentBuildCacheCleanupOk();
  check(checks, {
    name: "recent_build_cache_cleanup",
    ok: buildCacheCleanup.ok,
    message: buildCacheCleanup.message,
  });

  const loadSmoke = await recentLoadSmokeOk();
  check(checks, {
    name: "recent_load_smoke",
    ok: loadSmoke.ok,
    message: loadSmoke.message,
  });

  const sonioxSmoke = await recentSonioxSmokeOk();
  check(checks, {
    name: "recent_soniox_smoke",
    ok: sonioxSmoke.ok,
    message: sonioxSmoke.message,
  });

  const sonioxUiSmoke = await recentSonioxUiSmokeOk();
  check(checks, {
    name: "recent_soniox_ui_smoke",
    ok: sonioxUiSmoke.ok,
    message: sonioxUiSmoke.message,
  });

  const sonioxTrace = await recentSonioxTraceOk();
  check(checks, {
    name: "recent_soniox_trace",
    ok: sonioxTrace.ok,
    message: sonioxTrace.message,
  });

  if (liveKitReady) {
    const liveKitUiSmoke = await recentLiveKitUiSmokeOk();
    check(checks, {
      name: "recent_livekit_ui_smoke",
      ok: liveKitUiSmoke.ok,
      message: liveKitUiSmoke.message,
    });
  }

  const securityBaseline = await recentSecurityBaselineOk();
  check(checks, {
    name: "recent_security_baseline",
    ok: securityBaseline.ok,
    message: securityBaseline.message,
  });

  const deviceRuntime = await recentDeviceRuntimeEvidenceOk(
    baseUrl,
    healthEndpoint.releaseCommit,
  );
  check(checks, {
    name: "recent_device_runtime_evidence",
    ok: deviceRuntime.ok,
    severity: "external",
    message: deviceRuntime.message,
  });

  check(checks, {
    name: "logrotate_config",
    ok: await logrotateConfigOk(),
    message: "Production logrotate config is installed for BabbleDeck logs.",
  });

  const audioStorage = await productionAudioStorageStatus();
  check(checks, {
    name: "production_audio_storage",
    ok: audioStorage.ok,
    message: audioStorage.message,
  });

  if (audioStorage.ok && audioStorage.target) {
    const migrated = await audioChunksOnCurrentTarget(audioStorage.target);
    check(checks, {
      name: "audio_chunks_on_current_storage",
      ok: migrated.ok,
      message: migrated.message,
    });
  }

  const requiredOk = checks.every(
    (item) => item.severity !== "required" || item.ok,
  );
  const externalOk = checks.every(
    (item) => item.severity !== "external" || item.ok,
  );
  const result = {
    baseUrl,
    requiredOk,
    externalOk,
    productionReady: requiredOk && externalOk,
    strict,
    checks,
  };

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!requiredOk || (strict && !externalOk)) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Production readiness failed.",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
