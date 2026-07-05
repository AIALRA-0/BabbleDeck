import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";

type CommandResult = {
  available: boolean;
  ok: boolean;
  stdout: string;
  stderr: string;
  error?: string;
  exitCode?: number | string;
  signal?: NodeJS.Signals | null;
};

type Artifact = {
  path: string;
  exists: boolean;
  sizeBytes?: number;
  sha256?: string;
};

function boolFlag(name: string) {
  return process.argv.includes(name);
}

function argValue(name: string) {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

async function exists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function runCommand(
  command: string,
  args: string[] = [],
  timeoutMs = 15_000,
) {
  return new Promise<CommandResult>((resolve) => {
    execFile(
      command,
      args,
      { timeout: timeoutMs, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          const nodeError = error as NodeJS.ErrnoException & {
            code?: string | number;
            signal?: NodeJS.Signals | null;
          };
          resolve({
            available: nodeError.code !== "ENOENT",
            ok: false,
            stdout,
            stderr,
            error: nodeError.message,
            exitCode: nodeError.code,
            signal: nodeError.signal,
          });
          return;
        }

        resolve({
          available: true,
          ok: true,
          stdout,
          stderr,
        });
      },
    );
  });
}

async function artifact(filePath: string): Promise<Artifact> {
  try {
    const [stat, contents] = await Promise.all([
      fs.stat(filePath),
      fs.readFile(filePath),
    ]);
    return {
      path: filePath,
      exists: stat.isFile(),
      sizeBytes: stat.size,
      sha256: createHash("sha256").update(contents).digest("hex"),
    };
  } catch {
    return {
      path: filePath,
      exists: false,
    };
  }
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", "'\"'\"'")}'`;
}

async function desktopHeadlessSmoke(binaryPath: string) {
  const result = await runCommand(
    "bash",
    [
      "-lc",
      [
        "timeout 15s",
        "env WEBKIT_DISABLE_COMPOSITING_MODE=1 GDK_BACKEND=x11 NO_AT_BRIDGE=1",
        `xvfb-run -a ${shellQuote(binaryPath)}`,
      ].join(" "),
    ],
    20_000,
  );
  const timedOutAfterHealthyLaunch = result.exitCode === 124;
  return {
    checked: true,
    ok: result.ok || timedOutAfterHealthyLaunch,
    exitCode: result.exitCode,
    signal: result.signal,
    timeoutAccepted: timedOutAfterHealthyLaunch,
    stderrPreview: result.stderr.trim().slice(0, 500),
  };
}

function parseAdbDevices(output: string) {
  const stateCounts: Record<string, number> = {};
  let connected = 0;
  let physical = 0;
  let emulators = 0;

  for (const line of output.split(/\r?\n/).slice(1)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const [serial = "", state = "unknown", ...details] = trimmed.split(/\s+/);
    stateCounts[state] = (stateCounts[state] ?? 0) + 1;
    if (state !== "device") continue;
    connected += 1;

    const detailText = details.join(" ").toLowerCase();
    const emulator =
      serial.startsWith("emulator-") ||
      detailText.includes("model:sdk_") ||
      detailText.includes("product:sdk_") ||
      detailText.includes("model:emulator");
    if (emulator) {
      emulators += 1;
    } else {
      physical += 1;
    }
  }

  return {
    connectedDevices: connected,
    physicalDevices: physical,
    emulators,
    stateCounts,
  };
}

async function productionReachable(baseUrl: string) {
  try {
    const response = await fetch(baseUrl, { method: "HEAD" });
    return {
      ok: response.ok,
      status: response.status,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Production URL could not be reached.",
    };
  }
}

async function main() {
  const strict = boolFlag("--strict");
  const productionUrl =
    argValue("--base-url") ??
    process.env.BABBLEDECK_BASE_URL ??
    "https://babbledeck.aialra.online";
  const workspaceRoot = process.cwd();
  const androidApkPath = path.join(
    workspaceRoot,
    "apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk",
  );
  const iosProjectPath = path.join(
    workspaceRoot,
    "apps/mobile/ios/App/App.xcodeproj/project.pbxproj",
  );
  const desktopBinaryPath = path.join(
    workspaceRoot,
    "apps/desktop/src-tauri/target/release/babbledeck-desktop",
  );
  const desktopTauriCliPath = path.join(
    workspaceRoot,
    "apps/desktop/node_modules/.bin/tauri",
  );

  const checkDesktopHeadless =
    boolFlag("--check-desktop-headless") ||
    process.env.BABBLEDECK_DEVICE_CHECK_DESKTOP_HEADLESS === "true";
  const [
    production,
    androidApk,
    iosProjectExists,
    desktopBinary,
    desktopTauriCliExists,
    adb,
    xcodebuild,
  ] = await Promise.all([
    productionReachable(productionUrl),
    artifact(androidApkPath),
    exists(iosProjectPath),
    artifact(desktopBinaryPath),
    exists(desktopTauriCliPath),
    runCommand("adb", ["devices", "-l"]),
    runCommand("xcodebuild", ["-version"]),
  ]);
  const headlessSmoke = checkDesktopHeadless
    ? await desktopHeadlessSmoke(desktopBinaryPath)
    : { checked: false };

  const androidDevices = adb.available ? parseAdbDevices(adb.stdout) : null;
  const displayAvailable = Boolean(
    process.env.DISPLAY || process.env.WAYLAND_DISPLAY,
  );
  const androidReady =
    adb.available && Boolean(androidDevices?.physicalDevices);
  const iosReady =
    process.platform === "darwin" && xcodebuild.available && iosProjectExists;
  const desktopReady = desktopTauriCliExists && displayAvailable;
  const ready = production.ok && androidReady && iosReady && desktopReady;

  const result = {
    app: "babbledeck",
    checkedAt: new Date().toISOString(),
    productionUrl,
    ready,
    strict,
    production,
    android: {
      ready: androidReady,
      adbAvailable: adb.available,
      debugApkExists: androidApk.exists,
      debugApk: androidApk,
      devices: androidDevices,
      missing: [
        adb.available ? undefined : "adb",
        androidDevices?.physicalDevices
          ? undefined
          : "physical Android device in adb device state",
      ].filter((item): item is string => Boolean(item)),
      manualChecks: [
        "Install or run the wrapper on a physical Android device.",
        "Grant microphone permission against the production PWA.",
        "Start a recorder session and confirm live captions/audio backup.",
      ],
      nextCommands: [
        "pnpm device:readiness:production",
        "pnpm --filter @babbledeck/mobile native:build:android",
        "pnpm --filter @babbledeck/mobile native:run:android",
      ],
    },
    ios: {
      ready: iosReady,
      platform: process.platform,
      xcodebuildAvailable: xcodebuild.available,
      projectExists: iosProjectExists,
      missing: [
        process.platform === "darwin" ? undefined : "macOS host",
        xcodebuild.available ? undefined : "xcodebuild",
        iosProjectExists ? undefined : "Capacitor iOS project",
      ].filter((item): item is string => Boolean(item)),
      manualChecks: [
        "Run the wrapper on macOS with Xcode and an iOS simulator or device.",
        "Grant microphone permission against the production PWA.",
        "Start a recorder session and confirm live captions/audio backup.",
      ],
      nextCommands: [
        "pnpm device:readiness:production",
        "pnpm --filter @babbledeck/mobile native:check:ios",
        "pnpm --filter @babbledeck/mobile native:run:ios",
      ],
    },
    desktop: {
      ready: desktopReady,
      tauriCliExists: desktopTauriCliExists,
      releaseBinaryExists: desktopBinary.exists,
      releaseBinary: desktopBinary,
      headlessSmoke,
      displayAvailable,
      missing: [
        desktopTauriCliExists ? undefined : "Tauri CLI package binary",
        displayAvailable ? undefined : "interactive desktop display session",
      ].filter((item): item is string => Boolean(item)),
      manualChecks: [
        "Launch the desktop wrapper in an interactive desktop session.",
        "Grant microphone permission against the production PWA.",
        "Start a recorder session and confirm live captions/audio backup.",
      ],
      nextCommands: [
        "pnpm device:readiness:production",
        "pnpm device:readiness:production -- --check-desktop-headless",
        "pnpm --filter @babbledeck/desktop native:build",
        "pnpm --filter @babbledeck/desktop native:smoke:headless",
        "pnpm --filter @babbledeck/desktop native:dev",
      ],
    },
  };

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (strict && !ready) process.exitCode = 1;
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : "Device runtime readiness check failed.",
  );
  process.exitCode = 1;
});
