import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

export type WrapperArtifact = {
  path: string;
  exists: boolean;
  sizeBytes?: number;
  sha256?: string;
};

const DEFAULT_WORKSPACE_ROOT =
  "/srv/aialra/apps/codexapp/state/browser-workspaces/2026-07-04-babbledeck";

export function androidDebugApkPath() {
  return (
    process.env.BABBLEDECK_ANDROID_DEBUG_APK_PATH ??
    path.join(
      process.env.BABBLEDECK_WORKSPACE_DIR ?? DEFAULT_WORKSPACE_ROOT,
      "apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk",
    )
  );
}

export async function readWrapperArtifact(filePath: string) {
  const [stat, contents] = await Promise.all([
    fs.stat(/*turbopackIgnore: true*/ filePath),
    fs.readFile(/*turbopackIgnore: true*/ filePath),
  ]);
  if (!stat.isFile()) {
    throw new Error("Wrapper artifact is not a file.");
  }
  return {
    contents,
    artifact: {
      path: filePath,
      exists: true,
      sizeBytes: stat.size,
      sha256: createHash("sha256").update(contents).digest("hex"),
    } satisfies WrapperArtifact,
  };
}

export async function getAndroidDebugApkArtifact(): Promise<WrapperArtifact> {
  const filePath = androidDebugApkPath();
  try {
    return (await readWrapperArtifact(filePath)).artifact;
  } catch {
    return {
      path: filePath,
      exists: false,
    };
  }
}
