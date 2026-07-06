import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  androidDebugApkPath,
  getAndroidDebugApkArtifact,
  readWrapperArtifact,
} from "@/server/wrapper-artifacts";

let tempDir: string | null = null;
const originalApkPath = process.env.BABBLEDECK_ANDROID_DEBUG_APK_PATH;
const originalWorkspaceDir = process.env.BABBLEDECK_WORKSPACE_DIR;

afterEach(async () => {
  if (tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
  if (originalApkPath === undefined) {
    delete process.env.BABBLEDECK_ANDROID_DEBUG_APK_PATH;
  } else {
    process.env.BABBLEDECK_ANDROID_DEBUG_APK_PATH = originalApkPath;
  }
  if (originalWorkspaceDir === undefined) {
    delete process.env.BABBLEDECK_WORKSPACE_DIR;
  } else {
    process.env.BABBLEDECK_WORKSPACE_DIR = originalWorkspaceDir;
  }
});

describe("wrapper artifacts", () => {
  test("uses an explicit Android APK path when configured", () => {
    process.env.BABBLEDECK_ANDROID_DEBUG_APK_PATH = "/tmp/app-debug.apk";

    expect(androidDebugApkPath()).toBe("/tmp/app-debug.apk");
  });

  test("reads Android APK artifact metadata", async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "babbledeck-apk-"));
    const apkPath = path.join(tempDir, "app-debug.apk");
    await fs.writeFile(apkPath, "debug apk");
    process.env.BABBLEDECK_ANDROID_DEBUG_APK_PATH = apkPath;

    const artifact = await getAndroidDebugApkArtifact();

    expect(artifact).toMatchObject({
      path: apkPath,
      exists: true,
      sizeBytes: 9,
    });
    expect(artifact.sha256).toHaveLength(64);
  });

  test("returns missing metadata when APK cannot be read", async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "babbledeck-apk-"));
    const apkPath = path.join(tempDir, "missing.apk");
    process.env.BABBLEDECK_ANDROID_DEBUG_APK_PATH = apkPath;

    await expect(readWrapperArtifact(apkPath)).rejects.toThrow();
    expect(await getAndroidDebugApkArtifact()).toEqual({
      path: apkPath,
      exists: false,
    });
  });
});
