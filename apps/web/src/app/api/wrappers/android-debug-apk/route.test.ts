import { afterEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  androidDebugApkPath: vi.fn(),
  fail: vi.fn(),
  readWrapperArtifact: vi.fn(),
  requireApiUser: vi.fn(),
}));

vi.mock("@/server/api", () => ({
  fail: mocks.fail,
  requireApiUser: mocks.requireApiUser,
}));

vi.mock("@/server/wrapper-artifacts", () => ({
  androidDebugApkPath: mocks.androidDebugApkPath,
  readWrapperArtifact: mocks.readWrapperArtifact,
}));

import { GET } from "./route";

afterEach(() => {
  vi.clearAllMocks();
  mocks.fail.mockImplementation((code: string, message: string, status = 400) =>
    Response.json({ ok: false, error: { code, message } }, { status }),
  );
});

describe("Android debug APK download route", () => {
  test("requires an authenticated admin session", async () => {
    mocks.requireApiUser.mockResolvedValue({
      response: new Response("auth required", { status: 401 }),
    });

    const response = await GET();

    expect(response.status).toBe(401);
    expect(await response.text()).toBe("auth required");
    expect(mocks.readWrapperArtifact).not.toHaveBeenCalled();
  });

  test("returns 404 when the APK is missing", async () => {
    mocks.requireApiUser.mockResolvedValue({
      user: { id: "user-1", email: "admin@example.test" },
    });
    mocks.androidDebugApkPath.mockReturnValue("/tmp/missing.apk");
    mocks.readWrapperArtifact.mockRejectedValue(new Error("missing"));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  test("returns the APK as an authenticated attachment", async () => {
    mocks.requireApiUser.mockResolvedValue({
      user: { id: "user-1", email: "admin@example.test" },
    });
    mocks.androidDebugApkPath.mockReturnValue("/tmp/app-debug.apk");
    mocks.readWrapperArtifact.mockResolvedValue({
      contents: Buffer.from("apk bytes"),
      artifact: {
        exists: true,
        path: "/tmp/app-debug.apk",
        sizeBytes: 9,
        sha256: "a".repeat(64),
      },
    });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/vnd.android.package-archive",
    );
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="babbledeck-debug.apk"',
    );
    expect(response.headers.get("x-babbledeck-artifact-sha256")).toBe(
      "a".repeat(64),
    );
    expect(await response.text()).toBe("apk bytes");
  });
});
