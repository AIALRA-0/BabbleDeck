import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Prisma } from "@prisma/client";
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

async function serviceActive(name: string) {
  try {
    const { stdout } = await execFileAsync("systemctl", ["is-active", name]);
    return stdout.trim() === "active";
  } catch {
    return false;
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
  const staticRoot = path.join(
    process.cwd(),
    "apps/web/.next/standalone/apps/web/.next/static/chunks",
  );
  try {
    const entries = await fs.readdir(staticRoot);
    const cssFile = entries.find((entry) => entry.endsWith(".css"));
    if (!cssFile) return false;
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

async function healthEndpointOk(baseUrl: string) {
  try {
    const response = await fetch(new URL("/api/health", baseUrl), {
      headers: { Accept: "application/json" },
    });
    const body = await response.json();
    const databaseOk = body?.data?.checks?.database?.ok === true;
    const storageOk = body?.data?.checks?.audioStorage?.ok === true;
    return {
      ok: response.ok && body?.ok === true && databaseOk && storageOk,
      message:
        response.ok && body?.ok === true && databaseOk && storageOk
          ? "Production health endpoint reports core service readiness."
          : "Production health endpoint did not report core service readiness.",
    };
  } catch {
    return {
      ok: false,
      message: "Production health endpoint could not be checked.",
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

function configuredEnvName(names: string[]) {
  return names.find((name) => Boolean(process.env[name]));
}

function offHostAudioStorageStatus() {
  const driverSetting = process.env.AUDIO_STORAGE_DRIVER?.toLowerCase();
  if (driverSetting === "local") {
    return {
      ok: false,
      message:
        "AUDIO_STORAGE_DRIVER is local; production is still using local audio storage.",
    };
  }

  const bucketVar = configuredEnvName([
    "AUDIO_STORAGE_BUCKET",
    "R2_BUCKET",
    "S3_BUCKET",
  ]);
  const endpointVar = configuredEnvName([
    "AUDIO_STORAGE_ENDPOINT",
    "R2_ENDPOINT",
    "R2_ACCOUNT_ID",
    "S3_ENDPOINT",
  ]);
  const accessKeyVar = configuredEnvName([
    "AUDIO_STORAGE_ACCESS_KEY_ID",
    "R2_ACCESS_KEY_ID",
    "S3_ACCESS_KEY_ID",
    "AWS_ACCESS_KEY_ID",
  ]);
  const secretKeyVar = configuredEnvName([
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
    message:
      missing.length === 0
        ? "R2/S3-compatible audio storage target and credentials are configured."
        : `R2/S3-compatible audio storage is incomplete; missing ${missing.join(", ")}.`,
  };
}

async function audioChunksOnCurrentTarget() {
  const driverSetting = process.env.AUDIO_STORAGE_DRIVER?.toLowerCase();
  const bucket =
    process.env.AUDIO_STORAGE_BUCKET ??
    process.env.R2_BUCKET ??
    process.env.S3_BUCKET ??
    "";
  const targetDriver =
    driverSetting === "r2" || driverSetting === "s3" || bucket ? "s3" : "local";

  if (targetDriver !== "s3") {
    return {
      ok: false,
      message: "Current audio storage target is local.",
    };
  }

  const rows = await prisma.$queryRaw<
    { total: bigint; matching: bigint }[]
  >(Prisma.sql`
    select
      count(*)::bigint as total,
      count(*) filter (
        where metadata->>'storageDriver' = ${targetDriver}
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
        ? `All ${total} uploaded audio chunks are marked on the current off-host target.`
        : `${total - matching} of ${total} uploaded audio chunks are not marked on the current off-host target.`,
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

  for (const service of [
    "aialra-babbledeck.service",
    "aialra-babbledeck-ws.service",
    "aialra-babbledeck-backup.timer",
    "aialra-babbledeck-backup-verify.timer",
    "aialra-babbledeck-audio-retention.timer",
    "aialra-babbledeck-health-monitor.timer",
    "aialra-babbledeck-metrics.timer",
  ]) {
    const active = await serviceActive(service);
    check(checks, {
      name: service,
      ok: active,
      message: active ? `${service} is active.` : `${service} is not active.`,
    });
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

  const healthEndpoint = await healthEndpointOk(baseUrl);
  check(checks, {
    name: "health_endpoint",
    ok: healthEndpoint.ok,
    message: healthEndpoint.message,
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

  check(checks, {
    name: "logrotate_config",
    ok: await logrotateConfigOk(),
    message: "Production logrotate config is installed for BabbleDeck logs.",
  });

  const remoteStorage = offHostAudioStorageStatus();
  check(checks, {
    name: "off_host_audio_storage",
    ok: remoteStorage.ok,
    severity: "external",
    message: remoteStorage.message,
  });

  if (remoteStorage.ok) {
    const migrated = await audioChunksOnCurrentTarget();
    check(checks, {
      name: "off_host_audio_migration",
      ok: migrated.ok,
      severity: "external",
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
