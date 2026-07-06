import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  appendDeviceRuntimeEvidenceRecord,
  buildDeviceRuntimeEvidenceChecklistMarkdown,
  buildDeviceRuntimeEvidenceRecord,
  getDeviceRuntimeEvidenceStatus,
  type DeviceRuntimeChecks,
} from "@/server/device-runtime-evidence";

const completeChecks: DeviceRuntimeChecks = {
  productionUrlOpened: true,
  microphoneGranted: true,
  recordingStarted: true,
  captionsVisible: true,
  audioBackupConfirmed: true,
};

const release = {
  commit: "783585d7a975",
  branch: "main",
  builtAt: "2026-07-06T05:37:58Z",
};

let tempDir: string | null = null;

afterEach(async () => {
  if (tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

describe("device runtime evidence", () => {
  test("builds a passing release-bound record", () => {
    const record = buildDeviceRuntimeEvidenceRecord({
      platform: "android",
      passed: true,
      checks: completeChecks,
      release,
      baseUrl: "https://babbledeck.aialra.online",
      notes: " verified on device\n",
      client: {
        userAgent: "UA\nwith\tspace",
        viewportWidth: 390,
        viewportHeight: 844,
      },
      recordedAt: new Date("2026-07-06T05:40:00.000Z"),
    });

    expect(record).toMatchObject({
      app: "babbledeck",
      recordedAt: "2026-07-06T05:40:00.000Z",
      platform: "android",
      baseUrl: "https://babbledeck.aialra.online",
      release,
      ok: true,
      missingChecks: [],
      notes: "verified on device",
      source: "admin_settings",
      client: {
        userAgent: "UA with space",
        viewportWidth: 390,
        viewportHeight: 844,
      },
    });
  });

  test("preserves the recorder page source", () => {
    const record = buildDeviceRuntimeEvidenceRecord({
      platform: "desktop",
      passed: true,
      checks: completeChecks,
      release,
      baseUrl: "https://babbledeck.aialra.online",
      source: "recorder_page",
    });

    expect(record).toMatchObject({
      platform: "desktop",
      ok: true,
      source: "recorder_page",
    });
  });

  test("builds release-bound checklist markdown", () => {
    const markdown = buildDeviceRuntimeEvidenceChecklistMarkdown({
      baseUrl: "https://babbledeck.aialra.online",
      release,
      generatedAt: "2026-07-06T05:42:00.000Z",
      platforms: ["android"],
    });

    expect(markdown).toContain(
      "# BabbleDeck Device Runtime Evidence Checklist",
    );
    expect(markdown).toContain("- Release commit: 783585d7a975");
    expect(markdown).toContain("## Android");
    expect(markdown).toContain("--platform=android");
    expect(markdown).toContain("--base-url=https://babbledeck.aialra.online");
    expect(markdown).not.toContain("## iOS");
  });

  test("keeps incomplete records from satisfying readiness", () => {
    const record = buildDeviceRuntimeEvidenceRecord({
      platform: "desktop",
      passed: true,
      checks: { ...completeChecks, captionsVisible: false },
      release,
      baseUrl: "https://babbledeck.aialra.online",
    });

    expect(record.ok).toBe(false);
    expect(record.missingChecks).toEqual(["captionsVisible"]);
  });

  test("appends JSONL evidence records", async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "babbledeck-device-"));
    const logPath = path.join(tempDir, "device-runtime.jsonl");
    const record = buildDeviceRuntimeEvidenceRecord({
      platform: "ios",
      passed: true,
      checks: completeChecks,
      release,
      baseUrl: "https://babbledeck.aialra.online",
      recordedAt: new Date("2026-07-06T05:41:00.000Z"),
    });

    await appendDeviceRuntimeEvidenceRecord(record, logPath);

    const lines = (await fs.readFile(logPath, "utf8")).trim().split("\n");
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toMatchObject({
      platform: "ios",
      ok: true,
      release,
    });
  });

  test("summarizes missing device evidence by platform", async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "babbledeck-device-"));
    const status = await getDeviceRuntimeEvidenceStatus({
      logPath: path.join(tempDir, "missing.jsonl"),
      baseUrl: "https://babbledeck.aialra.online",
      releaseCommit: release.commit,
      now: new Date("2026-07-06T05:42:00.000Z"),
    });

    expect(status.ok).toBe(false);
    expect(status.logExists).toBe(false);
    expect(status.missingPlatforms).toEqual(["android", "ios", "desktop"]);
    expect(status.platforms.map((item) => item.reason)).toEqual([
      "missing",
      "missing",
      "missing",
    ]);
  });

  test("summarizes current release evidence status", async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "babbledeck-device-"));
    const logPath = path.join(tempDir, "device-runtime.jsonl");
    for (const platform of ["android", "ios", "desktop"] as const) {
      await appendDeviceRuntimeEvidenceRecord(
        buildDeviceRuntimeEvidenceRecord({
          platform,
          passed: true,
          checks: completeChecks,
          release,
          baseUrl: "https://babbledeck.aialra.online",
          recordedAt: new Date("2026-07-06T05:42:00.000Z"),
        }),
        logPath,
      );
    }

    const status = await getDeviceRuntimeEvidenceStatus({
      logPath,
      baseUrl: "https://babbledeck.aialra.online",
      releaseCommit: release.commit,
      now: new Date("2026-07-06T05:43:00.000Z"),
    });

    expect(status.ok).toBe(true);
    expect(status.missingPlatforms).toEqual([]);
    expect(status.platforms.map((item) => item.reason)).toEqual([
      "verified",
      "verified",
      "verified",
    ]);
  });

  test("uses the latest platform record when reporting release mismatch", async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "babbledeck-device-"));
    const logPath = path.join(tempDir, "device-runtime.jsonl");
    await appendDeviceRuntimeEvidenceRecord(
      buildDeviceRuntimeEvidenceRecord({
        platform: "android",
        passed: true,
        checks: completeChecks,
        release,
        baseUrl: "https://babbledeck.aialra.online",
        recordedAt: new Date("2026-07-06T05:42:00.000Z"),
      }),
      logPath,
    );
    await appendDeviceRuntimeEvidenceRecord(
      buildDeviceRuntimeEvidenceRecord({
        platform: "android",
        passed: true,
        checks: completeChecks,
        release: { ...release, commit: "deadbee" },
        baseUrl: "https://babbledeck.aialra.online",
        recordedAt: new Date("2026-07-06T05:44:00.000Z"),
      }),
      logPath,
    );

    const status = await getDeviceRuntimeEvidenceStatus({
      logPath,
      baseUrl: "https://babbledeck.aialra.online",
      releaseCommit: release.commit,
      now: new Date("2026-07-06T05:45:00.000Z"),
    });

    expect(status.ok).toBe(false);
    expect(status.platforms[0]).toMatchObject({
      platform: "android",
      ok: false,
      reason: "release_mismatch",
      releaseCommit: "deadbee",
    });
  });
});
