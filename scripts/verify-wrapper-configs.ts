import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

type CapacitorConfig = {
  appId?: string;
  appName?: string;
  webDir?: string;
  server?: {
    url?: string;
    cleartext?: boolean;
    allowNavigation?: string[];
  };
};

type TauriConfig = {
  productName?: string;
  identifier?: string;
  build?: {
    devUrl?: string;
    frontendDist?: string;
  };
  app?: {
    withGlobalTauri?: boolean;
    security?: {
      capabilities?: unknown[];
    };
    windows?: Array<{
      label?: string;
      title?: string;
      width?: number;
      height?: number;
    }>;
  };
};

const productionUrl = new URL("https://babbledeck.aialra.online");
const expectedAppId = "online.aialra.babbledeck";

async function findWorkspaceRoot() {
  let candidate = process.cwd();
  while (true) {
    const packagePath = path.join(candidate, "package.json");
    try {
      const manifest = JSON.parse(await readFile(packagePath, "utf8")) as {
        name?: string;
      };
      if (manifest.name === "babbledeck") return candidate;
    } catch {
      // Keep walking upward until the root package is found.
    }

    const parent = path.dirname(candidate);
    if (parent === candidate) {
      throw new Error("Could not find the BabbleDeck workspace root.");
    }
    candidate = parent;
  }
}

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function assertProductionHttpsUrl(value: string | undefined, label: string) {
  assert(value, `${label} is missing.`);
  const url = new URL(value);
  assert(url.protocol === "https:", `${label} must use HTTPS.`);
  assert(
    url.hostname === productionUrl.hostname,
    `${label} must point at ${productionUrl.hostname}.`,
  );
  return url;
}

async function checkMobile(rootDir: string) {
  const configUrl = pathToFileURL(
    path.join(rootDir, "apps/mobile/capacitor.config.ts"),
  ).toString();
  const imported = (await import(configUrl)) as { default: CapacitorConfig };
  const config = imported.default;

  assert(config.appId === expectedAppId, "Capacitor appId is unexpected.");
  assert(config.appName === "BabbleDeck", "Capacitor appName is unexpected.");
  assert(config.webDir === "www", "Capacitor webDir must be www.");
  await access(path.join(rootDir, "apps/mobile/www/index.html"));

  const serverUrl = assertProductionHttpsUrl(
    config.server?.url,
    "Capacitor server.url",
  );
  assert(
    config.server?.cleartext === false,
    "Capacitor cleartext traffic must be disabled for the production URL.",
  );
  assert(
    config.server?.allowNavigation?.includes(serverUrl.hostname),
    "Capacitor allowNavigation must include the production host.",
  );

  const androidDir = path.join(rootDir, "apps/mobile/android");
  await access(path.join(androidDir, "gradlew"));
  await access(path.join(androidDir, "app/build.gradle"));
  await access(path.join(androidDir, "app/src/main/AndroidManifest.xml"));
  await access(
    path.join(
      rootDir,
      "apps/mobile/node_modules/@capacitor/android/capacitor/build.gradle",
    ),
  );
  const androidSettings = await readFile(
    path.join(androidDir, "capacitor.settings.gradle"),
    "utf8",
  );
  const androidManifest = await readFile(
    path.join(androidDir, "app/src/main/AndroidManifest.xml"),
    "utf8",
  );
  assert(
    androidSettings.includes("../node_modules/@capacitor/android/capacitor"),
    "Capacitor Android settings must use the workspace package symlink path.",
  );
  assert(
    androidManifest.includes("android.permission.INTERNET") &&
      androidManifest.includes("android.permission.RECORD_AUDIO"),
    "Capacitor Android manifest must request internet and microphone permissions.",
  );

  const iosDir = path.join(rootDir, "apps/mobile/ios/App");
  await access(path.join(iosDir, "App.xcodeproj/project.pbxproj"));
  await access(path.join(iosDir, "CapApp-SPM/Package.swift"));
  const iosInfoPlist = await readFile(
    path.join(iosDir, "App/Info.plist"),
    "utf8",
  );
  const iosProject = await readFile(
    path.join(iosDir, "App.xcodeproj/project.pbxproj"),
    "utf8",
  );
  assert(
    iosInfoPlist.includes("<string>BabbleDeck</string>"),
    "Capacitor iOS display name must be BabbleDeck.",
  );
  assert(
    iosInfoPlist.includes("NSMicrophoneUsageDescription"),
    "Capacitor iOS Info.plist must include a microphone usage description.",
  );
  assert(
    iosProject.includes("PRODUCT_BUNDLE_IDENTIFIER = online.aialra.babbledeck"),
    "Capacitor iOS bundle identifier is unexpected.",
  );
}

async function checkDesktop(rootDir: string) {
  const configPath = path.join(
    rootDir,
    "apps/desktop/src-tauri/tauri.conf.json",
  );
  const config = JSON.parse(await readFile(configPath, "utf8")) as TauriConfig;

  assert(
    config.productName === "BabbleDeck",
    "Tauri productName is unexpected.",
  );
  assert(
    config.identifier === expectedAppId,
    "Tauri identifier is unexpected.",
  );
  assertProductionHttpsUrl(config.build?.devUrl, "Tauri build.devUrl");
  assertProductionHttpsUrl(
    config.build?.frontendDist,
    "Tauri build.frontendDist",
  );
  assert(
    config.app?.withGlobalTauri === false,
    "Tauri must not expose window.__TAURI__ to the remote page.",
  );
  assert(
    Array.isArray(config.app?.security?.capabilities) &&
      config.app?.security?.capabilities.length === 0,
    "Tauri remote page must not receive local capabilities by default.",
  );
  assert(
    Array.isArray(config.app?.windows) && config.app.windows.length === 1,
    "Tauri must define exactly one primary window.",
  );
  assert(
    config.app?.windows?.[0]?.title === "BabbleDeck",
    "Tauri primary window title is unexpected.",
  );
}

async function main() {
  const rootDir = await findWorkspaceRoot();
  const onlyMobile = hasFlag("--mobile");
  const onlyDesktop = hasFlag("--desktop");
  if (!onlyMobile && !onlyDesktop) {
    await checkMobile(rootDir);
    await checkDesktop(rootDir);
    return;
  }
  if (onlyMobile) await checkMobile(rootDir);
  if (onlyDesktop) await checkDesktop(rootDir);
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Wrapper config verification failed."}\n`,
  );
  process.exitCode = 1;
});
