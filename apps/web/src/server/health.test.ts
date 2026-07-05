import { afterEach, describe, expect, test } from "vitest";
import { getHealthStatus } from "@/server/health";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("health status", () => {
  test("reports core readiness without exposing secrets", async () => {
    process.env.AUDIO_STORAGE_DRIVER = "local";
    process.env.AUDIO_STORAGE_DIR = "/tmp/babbledeck-health";
    process.env.SONIOX_API_KEY = "test-key";
    process.env.LIVEKIT_URL = "wss://livekit.example.test";
    process.env.LIVEKIT_API_KEY = "livekit-key";
    process.env.LIVEKIT_API_SECRET = ["livekit", "secret"].join("-");

    const health = await getHealthStatus({
      databaseCheck: async () => true,
      now: new Date("2026-07-05T00:00:00.000Z"),
    });

    expect(health).toMatchObject({
      service: "babbledeck",
      status: "ok",
      generatedAt: "2026-07-05T00:00:00.000Z",
      checks: {
        database: { ok: true },
        audioStorage: {
          ok: true,
          driver: "local",
          offHostReady: false,
        },
        providers: {
          soniox: { configured: true },
          livekit: { configured: true },
        },
      },
    });
    expect(JSON.stringify(health)).not.toContain("test-key");
    expect(JSON.stringify(health)).not.toContain("livekit-secret");
  });

  test("marks off-host storage ready only when target credentials are present", async () => {
    process.env.AUDIO_STORAGE_DRIVER = "r2";
    process.env.R2_ACCOUNT_ID = "account-id";
    process.env.R2_BUCKET = "babbledeck-prod";
    process.env.R2_ACCESS_KEY_ID = "access-key";
    process.env.R2_SECRET_ACCESS_KEY = "secret-key";

    await expect(
      getHealthStatus({ databaseCheck: async () => true }),
    ).resolves.toMatchObject({
      status: "ok",
      checks: {
        audioStorage: {
          ok: true,
          driver: "s3",
          offHostReady: true,
        },
      },
    });
  });

  test("degrades when the database check fails", async () => {
    process.env.AUDIO_STORAGE_DRIVER = "local";

    await expect(
      getHealthStatus({ databaseCheck: async () => false }),
    ).resolves.toMatchObject({
      status: "degraded",
      checks: {
        database: { ok: false },
      },
    });
  });
});
