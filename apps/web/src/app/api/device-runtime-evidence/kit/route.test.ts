import { afterEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildDeviceRuntimeEvidenceChecklist: vi.fn(),
  deviceRuntimeEvidenceCommand: vi.fn(),
  fail: vi.fn(),
  getAndroidDebugApkArtifact: vi.fn(),
  getDesktopReleaseBinaryArtifact: vi.fn(),
  getDeviceRuntimeEvidenceStatus: vi.fn(),
  requireApiUser: vi.fn(),
}));

vi.mock("@/server/api", () => ({
  fail: mocks.fail,
  requireApiUser: mocks.requireApiUser,
}));

vi.mock("@/server/device-runtime-evidence", () => ({
  buildDeviceRuntimeEvidenceChecklist:
    mocks.buildDeviceRuntimeEvidenceChecklist,
  deviceRuntimeEvidenceCommand: mocks.deviceRuntimeEvidenceCommand,
  getDeviceRuntimeEvidenceStatus: mocks.getDeviceRuntimeEvidenceStatus,
}));

vi.mock("@/server/wrapper-artifacts", () => ({
  getAndroidDebugApkArtifact: mocks.getAndroidDebugApkArtifact,
  getDesktopReleaseBinaryArtifact: mocks.getDesktopReleaseBinaryArtifact,
}));

import { GET } from "./route";

afterEach(() => {
  vi.clearAllMocks();
  mocks.fail.mockImplementation((code: string, message: string, status = 400) =>
    Response.json({ ok: false, error: { code, message } }, { status }),
  );
  mocks.deviceRuntimeEvidenceCommand.mockImplementation(
    (platform: string) =>
      `pnpm device:evidence:production -- --platform=${platform}`,
  );
});

describe("device runtime verification kit route", () => {
  test("requires an authenticated admin session", async () => {
    mocks.requireApiUser.mockResolvedValue({
      response: new Response("auth required", { status: 401 }),
    });

    const response = await GET();

    expect(response.status).toBe(401);
    expect(await response.text()).toBe("auth required");
    expect(mocks.buildDeviceRuntimeEvidenceChecklist).not.toHaveBeenCalled();
  });

  test("returns 500 when release metadata is unavailable", async () => {
    mocks.requireApiUser.mockResolvedValue({
      user: { id: "user-1", email: "admin@example.test" },
    });
    mocks.buildDeviceRuntimeEvidenceChecklist.mockImplementation(() => {
      throw new Error("missing release");
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });

  test("returns a release-bound verification kit attachment", async () => {
    mocks.requireApiUser.mockResolvedValue({
      user: { id: "user-1", email: "admin@example.test" },
    });
    mocks.buildDeviceRuntimeEvidenceChecklist.mockReturnValue({
      app: "babbledeck",
      kind: "device-runtime-evidence-checklist",
      generatedAt: "2026-07-06T07:00:00.000Z",
      baseUrl: "https://babbledeck.aialra.online",
      release: { commit: "2d44be7657ad", branch: "main" },
      platforms: ["android", "ios", "desktop"],
      markdown: "# checklist",
    });
    mocks.getDeviceRuntimeEvidenceStatus.mockResolvedValue({
      ok: false,
      missingPlatforms: ["android", "ios", "desktop"],
    });
    mocks.getAndroidDebugApkArtifact.mockResolvedValue({
      exists: true,
      path: "/tmp/app-debug.apk",
      sizeBytes: 123,
      sha256: "a".repeat(64),
    });
    mocks.getDesktopReleaseBinaryArtifact.mockResolvedValue({
      exists: true,
      path: "/tmp/babbledeck-desktop",
      sizeBytes: 456,
      sha256: "b".repeat(64),
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="babbledeck-device-runtime-kit-2d44be7657ad.json"',
    );
    expect(body.data).toMatchObject({
      kind: "device-runtime-verification-kit",
      baseUrl: "https://babbledeck.aialra.online",
      release: { commit: "2d44be7657ad" },
      checklist: {
        url: "/api/device-runtime-evidence/checklist",
      },
      artifacts: {
        androidDebugApk: {
          url: "/api/wrappers/android-debug-apk",
          exists: true,
          sizeBytes: 123,
          sha256: "a".repeat(64),
        },
        desktopReleaseBinary: {
          url: "/api/wrappers/desktop-release-binary",
          exists: true,
          sizeBytes: 456,
          sha256: "b".repeat(64),
        },
      },
      evidence: {
        status: { ok: false, missingPlatforms: ["android", "ios", "desktop"] },
      },
    });
    expect(body.data.evidence.commands.android).toContain("--platform=android");
    expect(body.data.finalVerificationCommand).toContain("2d44be7657ad");
  });
});
