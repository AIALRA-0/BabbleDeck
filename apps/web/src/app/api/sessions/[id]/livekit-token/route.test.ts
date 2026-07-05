import { afterEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createLiveKitJoinToken: vi.fn(),
  requireRecorderAccess: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/server/livekit", () => ({
  createLiveKitJoinToken: mocks.createLiveKitJoinToken,
}));

vi.mock("@/server/recorder-route-access", () => ({
  requireRecorderAccess: mocks.requireRecorderAccess,
}));

import { POST } from "./route";

afterEach(() => {
  vi.clearAllMocks();
});

describe("session LiveKit token route", () => {
  test("returns a publisher token for an authorized recorder", async () => {
    mocks.requireRecorderAccess.mockResolvedValue({
      access: {
        kind: "admin",
        actorUserId: "user-1",
        session: { id: "session-1" },
      },
    });
    mocks.createLiveKitJoinToken.mockResolvedValue({
      url: "wss://livekit.example.test",
      token: "jwt",
      room: "babbledeck-session-1",
      identity: "admin-recorder-token",
      role: "publisher",
      expiresInSeconds: 900,
    });

    const response = await POST(
      new Request(
        "https://babbledeck.test/api/sessions/session-1/livekit-token",
        {
          method: "POST",
          body: JSON.stringify({ role: "publisher", displayName: "Host" }),
        },
      ),
      { params: Promise.resolve({ id: "session-1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      data: {
        token: "jwt",
        role: "publisher",
      },
    });
    expect(mocks.createLiveKitJoinToken).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "session-1",
        role: "publisher",
        identityPrefix: "admin-recorder",
        displayName: "Host",
      }),
    );
  });

  test("returns a provider configuration error when LiveKit is disabled", async () => {
    mocks.requireRecorderAccess.mockResolvedValue({
      access: {
        kind: "recorder_token",
        actorUserId: null,
        session: { id: "session-1" },
      },
    });
    mocks.createLiveKitJoinToken.mockResolvedValue(null);

    const response = await POST(
      new Request(
        "https://babbledeck.test/api/sessions/session-1/livekit-token",
        {
          method: "POST",
          body: JSON.stringify({ role: "publisher" }),
        },
      ),
      { params: Promise.resolve({ id: "session-1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      ok: false,
      error: { code: "PROVIDER_NOT_CONFIGURED" },
    });
  });
});
