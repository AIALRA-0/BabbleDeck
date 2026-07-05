import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

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

async function main() {
  const rootDir = await findWorkspaceRoot();
  const settingsPath = path.join(
    rootDir,
    "apps/mobile/android/capacitor.settings.gradle",
  );
  const moduleBuildPath = path.join(
    rootDir,
    "apps/mobile/node_modules/@capacitor/android/capacitor/build.gradle",
  );

  await access(moduleBuildPath);

  const contents = await readFile(settingsPath, "utf8");
  const desiredProjectDir =
    "project(':capacitor-android').projectDir = new File('../node_modules/@capacitor/android/capacitor')";
  const next = contents.replace(
    /^project\(':capacitor-android'\)\.projectDir = new File\('.*'\)$/m,
    desiredProjectDir,
  );

  if (!next.includes("include ':capacitor-android'")) {
    throw new Error(
      "Capacitor Android settings are missing the module include.",
    );
  }
  if (next === contents && !contents.includes(desiredProjectDir)) {
    throw new Error("Could not update Capacitor Android projectDir.");
  }

  await writeFile(settingsPath, next);
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Could not fix Capacitor Android settings."}\n`,
  );
  process.exitCode = 1;
});
