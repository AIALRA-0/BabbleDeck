import { afterEach, describe, expect, test } from "vitest";
import {
  createLiveKitJoinToken,
  getLiveKitConfig,
  liveKitRoomName,
} from "@/server/livekit";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

function configureLiveKit() {
  process.env.LIVEKIT_URL = "wss://livekit.example.test";
  process.env.LIVEKIT_API_KEY = "api-key";
  process.env.LIVEKIT_API_SECRET = ["api", "secret"].join("-");
  process.env.LIVEKIT_TOKEN_TTL_SECONDS = "120";
}

function jwtPayload(token: string) {
  const payload = token.split(".")[1];
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
    iss: string;
    sub: string;
    exp: number;
    video: {
      room: string;
      roomJoin: boolean;
      canPublish?: boolean;
      canPublishData?: boolean;
      canPublishSources?: string[];
      canSubscribe?: boolean;
    };
  };
}

describe("LiveKit token helpers", () => {
  test("reports missing config without exposing secret-shaped values", () => {
    delete process.env.LIVEKIT_URL;
    delete process.env.LIVEKIT_API_KEY;
    delete process.env.LIVEKIT_API_SECRET;

    expect(getLiveKitConfig()).toBeNull();
  });

  test("builds stable BabbleDeck room names", () => {
    expect(liveKitRoomName("session-123")).toBe("babbledeck-session-123");
  });

  test("creates a publisher token scoped to microphone publishing", async () => {
    configureLiveKit();

    const token = await createLiveKitJoinToken({
      sessionId: "session-123",
      role: "publisher",
      identityPrefix: "Admin Recorder",
      displayName: "Host recorder",
    });

    expect(token).toMatchObject({
      url: "wss://livekit.example.test",
      room: "babbledeck-session-123",
      role: "publisher",
      expiresInSeconds: 120,
    });
    expect(token?.token).not.toContain("api-secret");

    const payload = jwtPayload(token?.token ?? "");
    expect(payload.iss).toBe("api-key");
    expect(payload.sub).toMatch(/^admin-recorder-/);
    expect(payload.video).toMatchObject({
      room: "babbledeck-session-123",
      roomJoin: true,
      canPublish: true,
      canPublishData: true,
      canPublishSources: ["microphone"],
      canSubscribe: true,
    });
  });

  test("creates a subscriber token without publish permissions", async () => {
    configureLiveKit();

    const token = await createLiveKitJoinToken({
      sessionId: "session-123",
      role: "subscriber",
      identityPrefix: "viewer",
    });

    const payload = jwtPayload(token?.token ?? "");
    expect(payload.sub).toMatch(/^viewer-/);
    expect(payload.video).toMatchObject({
      room: "babbledeck-session-123",
      roomJoin: true,
      canPublish: false,
      canPublishData: false,
      canSubscribe: true,
    });
    expect(payload.video.canPublishSources).toBeUndefined();
  });
});
