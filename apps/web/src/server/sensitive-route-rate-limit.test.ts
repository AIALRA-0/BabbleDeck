import { afterEach, describe, expect, test } from "vitest";
import {
  checkAudioChunkUploadRateLimit,
  checkExportRateLimit,
} from "@/server/sensitive-route-rate-limit";
import { resetRateLimitsForTest } from "@/server/rate-limit";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  resetRateLimitsForTest();
});

describe("sensitive route rate limits", () => {
  test("limits export generation per user and session", () => {
    process.env.EXPORT_RATE_LIMIT_PER_MINUTE = "2";

    expect(
      checkExportRateLimit({ userId: "user-1", sessionId: "session-1" }),
    ).toMatchObject({ allowed: true });
    expect(
      checkExportRateLimit({ userId: "user-1", sessionId: "session-1" }),
    ).toMatchObject({ allowed: true });
    expect(
      checkExportRateLimit({ userId: "user-1", sessionId: "session-1" }),
    ).toMatchObject({ allowed: false });
    expect(
      checkExportRateLimit({ userId: "user-1", sessionId: "session-2" }),
    ).toMatchObject({ allowed: true });
  });

  test("limits audio chunk uploads per session and source ip", () => {
    process.env.AUDIO_CHUNK_UPLOAD_RATE_LIMIT_PER_MINUTE = "2";

    expect(
      checkAudioChunkUploadRateLimit({
        sessionId: "session-1",
        ip: "203.0.113.10",
      }),
    ).toMatchObject({ allowed: true });
    expect(
      checkAudioChunkUploadRateLimit({
        sessionId: "session-1",
        ip: "203.0.113.10",
      }),
    ).toMatchObject({ allowed: true });
    expect(
      checkAudioChunkUploadRateLimit({
        sessionId: "session-1",
        ip: "203.0.113.10",
      }),
    ).toMatchObject({ allowed: false });
    expect(
      checkAudioChunkUploadRateLimit({
        sessionId: "session-1",
        ip: "203.0.113.11",
      }),
    ).toMatchObject({ allowed: true });
  });
});
