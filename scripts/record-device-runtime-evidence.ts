type Platform = "android" | "ios" | "desktop";

const platforms = new Set<Platform>(["android", "ios", "desktop"]);

function argValue(name: string) {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

function boolFlag(name: string) {
  return process.argv.includes(name);
}

function requiredPlatform() {
  const value = argValue("--platform");
  if (!platforms.has(value as Platform)) {
    throw new Error("--platform must be android, ios, or desktop.");
  }
  return value as Platform;
}

function safeText(value: string | undefined) {
  if (!value) return undefined;
  return value
    .replace(/[\r\n\t]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

function baseUrl() {
  return (
    argValue("--base-url") ??
    process.env.BABBLEDECK_BASE_URL ??
    "https://babbledeck.aialra.online"
  );
}

function safeReleaseText(value: unknown) {
  return typeof value === "string" && value.trim()
    ? safeText(value)
    : undefined;
}

async function productionRelease(baseUrl: string) {
  const response = await fetch(new URL("/api/health", baseUrl), {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(
      `Production health endpoint returned HTTP ${response.status}.`,
    );
  }
  const body = await response.json();
  const release = body?.data?.release;
  const commit = safeReleaseText(release?.commit);
  if (!commit) {
    throw new Error(
      "Production health endpoint did not report release.commit.",
    );
  }
  return {
    commit,
    branch: safeReleaseText(release?.branch),
    builtAt: safeReleaseText(release?.builtAt),
  };
}

async function main() {
  const platform = requiredPlatform();
  const url = baseUrl();
  const release = await productionRelease(url);
  const checks = {
    productionUrlOpened: boolFlag("--production-url-opened"),
    microphoneGranted: boolFlag("--microphone-granted"),
    recordingStarted: boolFlag("--recording-started"),
    captionsVisible: boolFlag("--captions-visible"),
    audioBackupConfirmed: boolFlag("--audio-backup-confirmed"),
  };
  const missingChecks = Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => name);
  const ok = boolFlag("--passed") && missingChecks.length === 0;
  const record = {
    app: "babbledeck",
    recordedAt: new Date().toISOString(),
    platform,
    baseUrl: url,
    release,
    ok,
    checks,
    missingChecks,
    notes: safeText(argValue("--notes")),
  };

  process.stdout.write(`${JSON.stringify(record)}\n`);
  if (!ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : "Device runtime evidence recording failed.",
  );
  process.exitCode = 1;
});
