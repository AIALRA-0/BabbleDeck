import { afterEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildDeviceRuntimeEvidenceChecklist: vi.fn(),
  fail: vi.fn(),
  requireApiUser: vi.fn(),
}));

vi.mock("@/server/api", () => ({
  fail: mocks.fail,
  requireApiUser: mocks.requireApiUser,
}));

vi.mock("@/server/device-runtime-evidence", () => ({
  buildDeviceRuntimeEvidenceChecklist:
    mocks.buildDeviceRuntimeEvidenceChecklist,
}));

import { GET } from "./route";

afterEach(() => {
  vi.clearAllMocks();
});

describe("device runtime evidence checklist route", () => {
  test("requires an authenticated admin session", async () => {
    mocks.requireApiUser.mockResolvedValue({
      response: new Response("auth required", { status: 401 }),
    });

    const response = await GET();

    expect(response.status).toBe(401);
    expect(await response.text()).toBe("auth required");
    expect(mocks.buildDeviceRuntimeEvidenceChecklist).not.toHaveBeenCalled();
  });

  test("returns a markdown attachment for the current release", async () => {
    mocks.requireApiUser.mockResolvedValue({
      user: { id: "user-1", email: "admin@example.test" },
    });
    mocks.buildDeviceRuntimeEvidenceChecklist.mockReturnValue({
      release: { commit: "61e307d0d32a" },
      markdown: "# BabbleDeck Device Runtime Evidence Checklist\n",
    });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/markdown");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="babbledeck-device-runtime-61e307d0d32a.md"',
    );
    expect(await response.text()).toContain("BabbleDeck Device Runtime");
  });
});
