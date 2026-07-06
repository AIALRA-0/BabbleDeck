import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  appendDeviceRuntimeEvidenceRecord,
  buildDeviceRuntimeEvidenceRecord,
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
});
