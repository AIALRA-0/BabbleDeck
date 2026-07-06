import fs from "node:fs/promises";
import path from "node:path";

export const deviceRuntimePlatforms = ["android", "ios", "desktop"] as const;
export type DeviceRuntimePlatform = (typeof deviceRuntimePlatforms)[number];

export const deviceRuntimeCheckNames = [
  "productionUrlOpened",
  "microphoneGranted",
  "recordingStarted",
  "captionsVisible",
  "audioBackupConfirmed",
] as const;

export type DeviceRuntimeChecks = Record<
  (typeof deviceRuntimeCheckNames)[number],
  boolean
>;

export type DeviceRuntimeClient = {
  userAgent?: string;
  reportedUserAgent?: string;
  viewportWidth?: number;
  viewportHeight?: number;
  displayMode?: string;
  language?: string;
  timezone?: string;
};

export type DeviceRuntimeRelease = {
  commit: string;
  branch?: string;
  builtAt?: string;
};

export type DeviceRuntimeEvidenceSource =
  "admin_settings" | "recorder_page" | "session_history";

export type DeviceRuntimeEvidenceRecord = {
  app: "babbledeck";
  recordedAt: string;
  platform: DeviceRuntimePlatform;
  baseUrl: string;
  release: DeviceRuntimeRelease;
  ok: boolean;
  checks: DeviceRuntimeChecks;
  missingChecks: string[];
  notes?: string;
  source: DeviceRuntimeEvidenceSource;
  client: DeviceRuntimeClient;
};

export type DeviceRuntimeEvidenceStatusReason =
  | "verified"
  | "missing"
  | "failed"
  | "release_mismatch"
  | "base_url_mismatch"
  | "checks_incomplete"
  | "invalid_timestamp"
  | "stale";

export type DeviceRuntimeEvidencePlatformStatus = {
  platform: DeviceRuntimePlatform;
  ok: boolean;
  reason: DeviceRuntimeEvidenceStatusReason;
  recordedAt: string | null;
  source: DeviceRuntimeEvidenceSource | null;
  releaseCommit: string | null;
  missingChecks: string[];
};

export type DeviceRuntimeEvidenceStatusSummary = {
  ok: boolean;
  generatedAt: string;
  baseUrl: string;
  releaseCommit: string | null;
  maxAgeHours: number;
  logExists: boolean;
  invalidLineCount: number;
  unreadable: boolean;
  platforms: DeviceRuntimeEvidencePlatformStatus[];
  missingPlatforms: DeviceRuntimePlatform[];
};

function cleanText(value: string | undefined | null, maxLength = 300) {
  if (!value) return undefined;
  const cleaned = value
    .replace(/[\r\n\t]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
  return cleaned || undefined;
}

function releaseValue(value: string | undefined, pattern: RegExp) {
  const cleaned = cleanText(value, 120);
  return cleaned && pattern.test(cleaned) ? cleaned : undefined;
}

export function currentDeviceEvidenceRelease(): DeviceRuntimeRelease {
  const commit = releaseValue(
    process.env.BABBLEDECK_RELEASE_COMMIT,
    /^[0-9a-f]{7,40}$/i,
  );
  if (!commit) {
    throw new Error("BABBLEDECK_RELEASE_COMMIT is required.");
  }
  return {
    commit,
    branch: releaseValue(
      process.env.BABBLEDECK_RELEASE_BRANCH,
      /^[A-Za-z0-9._/-]{1,120}$/,
    ),
    builtAt: releaseValue(
      process.env.BABBLEDECK_RELEASE_BUILT_AT,
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/,
    ),
  };
}

export function productionDeviceEvidenceBaseUrl() {
  return (
    cleanText(process.env.BABBLEDECK_BASE_URL, 200) ??
    "https://babbledeck.aialra.online"
  );
}

export function deviceRuntimeEvidenceLogPath() {
  return (
    process.env.BABBLEDECK_DEVICE_RUNTIME_LOG ??
    "/srv/aialra/logs/babbledeck/device-runtime.jsonl"
  );
}

export function deviceRuntimeEvidenceMaxAgeMs() {
  const maxAgeHours = Number(
    process.env.BABBLEDECK_DEVICE_RUNTIME_MAX_AGE_HOURS ?? 720,
  );
  return Number.isFinite(maxAgeHours) && maxAgeHours > 0
    ? maxAgeHours * 60 * 60 * 1000
    : 720 * 60 * 60 * 1000;
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

function recordObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function recordSource(value: unknown): DeviceRuntimeEvidenceSource | null {
  return value === "admin_settings" ||
    value === "recorder_page" ||
    value === "session_history"
    ? value
    : null;
}

function deviceRuntimeRecordStatus(input: {
  record: Record<string, unknown>;
  platform: DeviceRuntimePlatform;
  baseUrl: string;
  maxAgeMs: number;
  releaseCommit?: string | null;
  now?: Date;
}): DeviceRuntimeEvidencePlatformStatus {
  const record = input.record;
  const checks = recordObject(record.checks);
  const release = recordObject(record.release);
  const missingChecks = deviceRuntimeCheckNames.filter(
    (name) => checks[name] !== true,
  );
  const recordedAt =
    typeof record.recordedAt === "string" ? record.recordedAt : null;
  const recordedAtMs = recordedAt ? Date.parse(recordedAt) : Number.NaN;
  const fresh =
    Number.isFinite(recordedAtMs) &&
    (input.now ?? new Date()).getTime() - recordedAtMs <= input.maxAgeMs;
  const releaseCommit =
    typeof release.commit === "string" ? release.commit : null;
  const releaseOk =
    !input.releaseCommit || release.commit === input.releaseCommit;
  const baseUrlOk =
    normalizedUrl(record.baseUrl) === normalizedUrl(input.baseUrl);
  const source = recordSource(record.source);

  let reason: DeviceRuntimeEvidenceStatusReason = "verified";
  if (
    record.app !== "babbledeck" ||
    record.platform !== input.platform ||
    record.ok !== true
  ) {
    reason = "failed";
  } else if (!releaseOk) {
    reason = "release_mismatch";
  } else if (!baseUrlOk) {
    reason = "base_url_mismatch";
  } else if (missingChecks.length > 0) {
    reason = "checks_incomplete";
  } else if (!Number.isFinite(recordedAtMs)) {
    reason = "invalid_timestamp";
  } else if (!fresh) {
    reason = "stale";
  }

  return {
    platform: input.platform,
    ok: reason === "verified",
    reason,
    recordedAt,
    source,
    releaseCommit,
    missingChecks,
  };
}

function latestRecordForPlatform(
  records: Record<string, unknown>[],
  platform: DeviceRuntimePlatform,
) {
  return records
    .filter((record) => record.platform === platform)
    .sort((a, b) =>
      String(b.recordedAt ?? "").localeCompare(String(a.recordedAt ?? "")),
    )[0];
}

export async function getDeviceRuntimeEvidenceStatus(input?: {
  baseUrl?: string;
  releaseCommit?: string | null;
  logPath?: string;
  maxAgeMs?: number;
  now?: Date;
}): Promise<DeviceRuntimeEvidenceStatusSummary> {
  const baseUrl = input?.baseUrl ?? productionDeviceEvidenceBaseUrl();
  const maxAgeMs = input?.maxAgeMs ?? deviceRuntimeEvidenceMaxAgeMs();
  const generatedAt = (input?.now ?? new Date()).toISOString();
  const logPath = input?.logPath ?? deviceRuntimeEvidenceLogPath();
  let logExists = true;
  let unreadable = false;
  let invalidLineCount = 0;
  let records: Record<string, unknown>[] = [];

  try {
    const contents = await fs.readFile(
      /*turbopackIgnore: true*/ logPath,
      "utf8",
    );
    records = contents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .flatMap((line) => {
        try {
          return [JSON.parse(line) as Record<string, unknown>];
        } catch {
          invalidLineCount += 1;
          return [];
        }
      });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      logExists = false;
    } else {
      unreadable = true;
    }
  }

  const platforms = deviceRuntimePlatforms.map((platform) => {
    const latest = latestRecordForPlatform(records, platform);
    return latest
      ? deviceRuntimeRecordStatus({
          record: latest,
          platform,
          baseUrl,
          maxAgeMs,
          releaseCommit: input?.releaseCommit,
          now: input?.now,
        })
      : {
          platform,
          ok: false,
          reason: "missing" as const,
          recordedAt: null,
          source: null,
          releaseCommit: null,
          missingChecks: [...deviceRuntimeCheckNames],
        };
  });
  const missingPlatforms = platforms
    .filter((status) => !status.ok)
    .map((status) => status.platform);

  return {
    ok:
      logExists &&
      !unreadable &&
      invalidLineCount === 0 &&
      missingPlatforms.length === 0,
    generatedAt,
    baseUrl,
    releaseCommit: input?.releaseCommit ?? null,
    maxAgeHours: Math.round(maxAgeMs / (60 * 60 * 1000)),
    logExists,
    invalidLineCount,
    unreadable,
    platforms,
    missingPlatforms,
  };
}

export function buildDeviceRuntimeEvidenceRecord(input: {
  platform: DeviceRuntimePlatform;
  passed: boolean;
  checks: DeviceRuntimeChecks;
  release?: DeviceRuntimeRelease;
  baseUrl?: string;
  notes?: string | null;
  source?: DeviceRuntimeEvidenceSource;
  client?: DeviceRuntimeClient;
  recordedAt?: Date;
}): DeviceRuntimeEvidenceRecord {
  const missingChecks = deviceRuntimeCheckNames.filter(
    (name) => input.checks[name] !== true,
  );
  const client = input.client ?? {};
  return {
    app: "babbledeck",
    recordedAt: (input.recordedAt ?? new Date()).toISOString(),
    platform: input.platform,
    baseUrl: input.baseUrl ?? productionDeviceEvidenceBaseUrl(),
    release: input.release ?? currentDeviceEvidenceRelease(),
    ok: input.passed && missingChecks.length === 0,
    checks: input.checks,
    missingChecks,
    notes: cleanText(input.notes),
    source: input.source ?? "admin_settings",
    client: {
      userAgent: cleanText(client.userAgent),
      reportedUserAgent: cleanText(client.reportedUserAgent),
      viewportWidth: client.viewportWidth,
      viewportHeight: client.viewportHeight,
      displayMode: cleanText(client.displayMode, 80),
      language: cleanText(client.language, 40),
      timezone: cleanText(client.timezone, 80),
    },
  };
}

export async function appendDeviceRuntimeEvidenceRecord(
  record: DeviceRuntimeEvidenceRecord,
  logPath = deviceRuntimeEvidenceLogPath(),
) {
  await fs.mkdir(path.dirname(/*turbopackIgnore: true*/ logPath), {
    recursive: true,
  });
  await fs.appendFile(
    /*turbopackIgnore: true*/ logPath,
    `${JSON.stringify(record)}\n`,
    {
      mode: 0o600,
    },
  );
}
