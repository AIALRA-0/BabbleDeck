type Platform = "android" | "ios" | "desktop";

type ReleaseInfo = {
  commit: string;
  branch?: string;
  builtAt?: string;
};

const platforms: Platform[] = ["android", "ios", "desktop"];

function argValue(name: string) {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

function baseUrl() {
  return (
    argValue("--base-url") ??
    process.env.BABBLEDECK_BASE_URL ??
    "https://babbledeck.aialra.online"
  );
}

function selectedPlatforms() {
  const raw = argValue("--platforms");
  if (!raw) return platforms;
  const selected = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const invalid = selected.filter(
    (item) => !platforms.includes(item as Platform),
  );
  if (invalid.length > 0) {
    throw new Error(`Invalid platform(s): ${invalid.join(", ")}.`);
  }
  return selected as Platform[];
}

function safeText(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value
        .replace(/[\r\n\t]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    : undefined;
}

async function productionRelease(url: string): Promise<ReleaseInfo> {
  const response = await fetch(new URL("/api/health", url), {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(
      `Production health endpoint returned HTTP ${response.status}.`,
    );
  }
  const body = await response.json();
  const release = body?.data?.release;
  const commit = safeText(release?.commit);
  if (!commit) {
    throw new Error(
      "Production health endpoint did not report release.commit.",
    );
  }
  return {
    commit,
    branch: safeText(release?.branch),
    builtAt: safeText(release?.builtAt),
  };
}

function evidenceCommand(platform: Platform) {
  return [
    "pnpm device:evidence:production --",
    `--platform=${platform}`,
    "--passed",
    "--production-url-opened",
    "--microphone-granted",
    "--recording-started",
    "--captions-visible",
    "--audio-backup-confirmed",
    `--notes="${platform} production wrapper runtime verified on release"`,
  ].join(" ");
}

function platformChecklist(platform: Platform) {
  if (platform === "android") {
    return [
      "1. Build or refresh the Android wrapper on the server.",
      "   `pnpm --filter @babbledeck/mobile native:build:android`",
      "2. Connect a physical Android device with USB debugging enabled.",
      "   `adb devices -l`",
      "3. Install/run the wrapper against the production PWA.",
      "   `pnpm --filter @babbledeck/mobile native:run:android`",
      "4. On the device, open the production app, grant microphone permission, start a recorder session, confirm live captions are visible, and confirm the audio backup/upload indicator succeeds.",
      "5. Back on the server, record evidence:",
      `   \`${evidenceCommand("android")}\``,
    ];
  }

  if (platform === "ios") {
    return [
      "1. Use a macOS host with Xcode and the same repository checkout.",
      "2. Sync/check the iOS wrapper metadata.",
      "   `pnpm --filter @babbledeck/mobile native:check:ios`",
      "3. Run the wrapper on an iOS simulator or physical iOS device.",
      "   `pnpm --filter @babbledeck/mobile native:run:ios`",
      "4. On the device, open the production app, grant microphone permission, start a recorder session, confirm live captions are visible, and confirm the audio backup/upload indicator succeeds.",
      "5. Back on the production server, record evidence:",
      `   \`${evidenceCommand("ios")}\``,
    ];
  }

  return [
    "1. Use an interactive desktop session on a machine that can launch the Tauri wrapper.",
    "2. Build or refresh the desktop wrapper if needed.",
    "   `pnpm --filter @babbledeck/desktop native:build`",
    "3. Launch the wrapper in that interactive session.",
    "   `pnpm --filter @babbledeck/desktop native:dev`",
    "4. In the wrapper, open the production app, grant microphone permission, start a recorder session, confirm live captions are visible, and confirm the audio backup/upload indicator succeeds.",
    "5. Back on the production server, record evidence:",
    `   \`${evidenceCommand("desktop")}\``,
  ];
}

function markdown(input: {
  url: string;
  release: ReleaseInfo;
  generatedAt: string;
  selected: Platform[];
}) {
  const releaseLines = [
    `- Base URL: ${input.url}`,
    `- Release commit: ${input.release.commit}`,
    input.release.branch ? `- Branch: ${input.release.branch}` : undefined,
    input.release.builtAt ? `- Built at: ${input.release.builtAt}` : undefined,
    `- Checklist generated at: ${input.generatedAt}`,
  ].filter((line): line is string => Boolean(line));

  const platformSections = input.selected
    .map((platform) => {
      const title =
        platform === "android"
          ? "Android"
          : platform === "ios"
            ? "iOS"
            : "Desktop";
      return [`## ${title}`, "", ...platformChecklist(platform)].join("\n");
    })
    .join("\n\n");

  return [
    "# BabbleDeck Device Runtime Evidence Checklist",
    "",
    ...releaseLines,
    "",
    "This checklist is non-secret. It ties manual device verification to the currently deployed `/api/health` release. Record evidence only after the listed checks are truly complete on the real device or interactive wrapper session.",
    "",
    platformSections,
    "",
    "## Final Verification",
    "",
    "After all three platform records are written, run:",
    "",
    "`pnpm tsx scripts/check-production-readiness.ts --base-url=https://babbledeck.aialra.online --check-soniox-live --expected-release-commit=$(git rev-parse --short=12 HEAD) --strict`",
    "",
  ].join("\n");
}

async function main() {
  const url = baseUrl();
  const release = await productionRelease(url);
  const generatedAt = new Date().toISOString();
  const selected = selectedPlatforms();
  const output = {
    app: "babbledeck",
    kind: "device-runtime-evidence-checklist",
    generatedAt,
    baseUrl: url,
    release,
    platforms: selected,
  };

  if (argValue("--format") === "json") {
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    return;
  }

  process.stdout.write(
    markdown({
      url,
      release,
      generatedAt,
      selected,
    }),
  );
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : "Device runtime evidence checklist failed.",
  );
  process.exitCode = 1;
});
