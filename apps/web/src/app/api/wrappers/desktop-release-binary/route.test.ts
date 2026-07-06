import { afterEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  desktopReleaseBinaryPath: vi.fn(),
  fail: vi.fn(),
  readWrapperArtifact: vi.fn(),
  requireApiUser: vi.fn(),
}));

vi.mock("@/server/api", () => ({
  fail: mocks.fail,
  requireApiUser: mocks.requireApiUser,
}));

vi.mock("@/server/wrapper-artifacts", () => ({
  desktopReleaseBinaryPath: mocks.desktopReleaseBinaryPath,
  readWrapperArtifact: mocks.readWrapperArtifact,
}));

import { GET } from "./route";

afterEach(() => {
  vi.clearAllMocks();
  mocks.fail.mockImplementation((code: string, message: string, status = 400) =>
    Response.json({ ok: false, error: { code, message } }, { status }),
  );
});

describe("Desktop release binary download route", () => {
  test("requires an authenticated admin session", async () => {
    mocks.requireApiUser.mockResolvedValue({
      response: new Response("auth required", { status: 401 }),
    });

    const response = await GET();

    expect(response.status).toBe(401);
    expect(await response.text()).toBe("auth required");
    expect(mocks.readWrapperArtifact).not.toHaveBeenCalled();
  });

  test("returns 404 when the binary is missing", async () => {
    mocks.requireApiUser.mockResolvedValue({
      user: { id: "user-1", email: "admin@example.test" },
    });
    mocks.desktopReleaseBinaryPath.mockReturnValue("/tmp/missing-binary");
    mocks.readWrapperArtifact.mockRejectedValue(new Error("missing"));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  test("returns the binary as an authenticated attachment", async () => {
    mocks.requireApiUser.mockResolvedValue({
      user: { id: "user-1", email: "admin@example.test" },
    });
    mocks.desktopReleaseBinaryPath.mockReturnValue("/tmp/babbledeck-desktop");
    mocks.readWrapperArtifact.mockResolvedValue({
      contents: Buffer.from("desktop binary"),
      artifact: {
        exists: true,
        path: "/tmp/babbledeck-desktop",
        sizeBytes: 14,
        sha256: "b".repeat(64),
      },
    });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/octet-stream",
    );
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="babbledeck-desktop-linux-x64"',
    );
    expect(response.headers.get("x-babbledeck-artifact-sha256")).toBe(
      "b".repeat(64),
    );
    expect(await response.text()).toBe("desktop binary");
  });
});
