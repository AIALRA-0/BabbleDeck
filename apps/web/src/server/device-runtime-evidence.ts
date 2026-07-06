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
  source: "admin_settings";
  client: DeviceRuntimeClient;
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

export function buildDeviceRuntimeEvidenceRecord(input: {
  platform: DeviceRuntimePlatform;
  passed: boolean;
  checks: DeviceRuntimeChecks;
  release?: DeviceRuntimeRelease;
  baseUrl?: string;
  notes?: string | null;
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
    source: "admin_settings",
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
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  await fs.appendFile(logPath, `${JSON.stringify(record)}\n`, {
    mode: 0o600,
  });
}
