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

async function main() {
  const platform = requiredPlatform();
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
    baseUrl: baseUrl(),
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
