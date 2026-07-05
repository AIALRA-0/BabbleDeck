import { afterEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createLiveKitJoinToken: vi.fn(),
  prisma: {
    liveSession: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("server-only", () => ({}));

vi.mock("@/server/livekit", () => ({
  createLiveKitJoinToken: mocks.createLiveKitJoinToken,
}));

vi.mock("@/server/db", () => ({ prisma: mocks.prisma }));

import { POST } from "./route";

afterEach(() => {
  vi.clearAllMocks();
});

describe("viewer LiveKit token route", () => {
  test("returns a subscriber token for a valid share link", async () => {
    mocks.prisma.liveSession.findUnique.mockResolvedValue({
      id: "session-1",
      archivedAt: null,
    });
    mocks.createLiveKitJoinToken.mockResolvedValue({
      url: "wss://livekit.example.test",
      token: "jwt",
      room: "babbledeck-session-1",
      identity: "viewer-token",
      role: "subscriber",
      expiresInSeconds: 900,
    });

    const response = await POST(
      new Request(
        "https://babbledeck.test/api/viewer/session/share-token/livekit-token",
        { method: "POST" },
      ),
      { params: Promise.resolve({ shareToken: "share-token" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      data: {
        token: "jwt",
        role: "subscriber",
      },
    });
    expect(mocks.createLiveKitJoinToken).toHaveBeenCalledWith({
      sessionId: "session-1",
      role: "subscriber",
      identityPrefix: "viewer",
    });
  });

  test("does not issue tokens for archived share links", async () => {
    mocks.prisma.liveSession.findUnique.mockResolvedValue({
      id: "session-1",
      archivedAt: new Date("2026-07-05T00:00:00.000Z"),
    });

    const response = await POST(
      new Request(
        "https://babbledeck.test/api/viewer/session/share-token/livekit-token",
        { method: "POST" },
      ),
      { params: Promise.resolve({ shareToken: "share-token" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
    expect(mocks.createLiveKitJoinToken).not.toHaveBeenCalled();
  });
});
