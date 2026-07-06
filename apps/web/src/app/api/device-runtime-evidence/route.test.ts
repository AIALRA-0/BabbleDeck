import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  appendDeviceRuntimeEvidenceRecord: vi.fn(),
  auditLog: vi.fn(),
  buildDeviceRuntimeEvidenceRecord: vi.fn(),
  currentDeviceEvidenceRelease: vi.fn(),
  fail: vi.fn(),
  getSessionForRecorderToken: vi.fn(),
  ok: vi.fn(),
  productionDeviceEvidenceBaseUrl: vi.fn(),
  requireApiUser: vi.fn(),
  requireSameOriginMutation: vi.fn(),
  validationError: vi.fn(),
}));

vi.mock("@/server/api", () => ({
  fail: mocks.fail,
  ok: mocks.ok,
  requireApiUser: mocks.requireApiUser,
  requireSameOriginMutation: mocks.requireSameOriginMutation,
  validationError: mocks.validationError,
  getClientIp: () => "203.0.113.10",
}));

vi.mock("@/server/audit", () => ({
  auditLog: mocks.auditLog,
}));

vi.mock("@/server/device-runtime-evidence", () => ({
  appendDeviceRuntimeEvidenceRecord: mocks.appendDeviceRuntimeEvidenceRecord,
  buildDeviceRuntimeEvidenceRecord: mocks.buildDeviceRuntimeEvidenceRecord,
  currentDeviceEvidenceRelease: mocks.currentDeviceEvidenceRelease,
  productionDeviceEvidenceBaseUrl: mocks.productionDeviceEvidenceBaseUrl,
}));

vi.mock("@/server/session-service", () => ({
  getSessionForRecorderToken: mocks.getSessionForRecorderToken,
}));

import { POST } from "./route";

const release = {
  commit: "de836ba2e7ca",
  branch: "main",
  builtAt: "2026-07-06T07:31:49Z",
};

const completeChecks = {
  productionUrlOpened: true,
  microphoneGranted: true,
  recordingStarted: true,
  captionsVisible: true,
  audioBackupConfirmed: true,
};

const recorderSessionId = "00000000-0000-4000-8000-000000000001";
const recorderToken = "recorder_token_abcdefghijklmnopqrstuvwxyz";

function evidenceRequest(body: Record<string, unknown>) {
  return new Request(
    "https://babbledeck.aialra.online/api/device-runtime-evidence",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://babbledeck.aialra.online",
        "User-Agent": "vitest",
      },
      body: JSON.stringify(body),
    },
  );
}

function evidenceBody(overrides?: Record<string, unknown>) {
  return {
    platform: "android",
    source: "recorder_page",
    passed: true,
    checks: completeChecks,
    recorderSessionId,
    recorderToken,
    client: {
      viewportWidth: 390,
      viewportHeight: 844,
      displayMode: "standalone",
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fail.mockImplementation((code: string, message: string, status = 400) =>
    Response.json({ ok: false, error: { code, message } }, { status }),
  );
  mocks.ok.mockImplementation((data: unknown) =>
    Response.json({ ok: true, data }),
  );
  mocks.validationError.mockImplementation(() =>
    Response.json(
      { ok: false, error: { code: "VALIDATION_ERROR" } },
      {
        status: 400,
      },
    ),
  );
  mocks.requireSameOriginMutation.mockReturnValue(null);
  mocks.currentDeviceEvidenceRelease.mockReturnValue(release);
  mocks.productionDeviceEvidenceBaseUrl.mockReturnValue(
    "https://babbledeck.aialra.online",
  );
  mocks.buildDeviceRuntimeEvidenceRecord.mockImplementation((input) => ({
    app: "babbledeck",
    receiptId: "abcd1234abcd1234abcd1234",
    recordedAt: "2026-07-06T07:40:00.000Z",
    platform: input.platform,
    sessionId: input.sessionId,
    release: input.release,
    baseUrl: input.baseUrl,
    ok: input.passed,
    checks: input.checks,
    missingChecks: [],
    source: input.source,
    client: input.client,
  }));
});

describe("device runtime evidence route", () => {
  test("rejects unauthenticated requests without recorder token auth", async () => {
    mocks.requireApiUser.mockResolvedValue({
      response: new Response("auth required", { status: 401 }),
    });

    const response = await POST(
      evidenceRequest(
        evidenceBody({
          recorderSessionId: undefined,
          recorderToken: undefined,
        }),
      ),
    );

    expect(response.status).toBe(401);
    expect(await response.text()).toBe("auth required");
    expect(mocks.getSessionForRecorderToken).not.toHaveBeenCalled();
    expect(mocks.appendDeviceRuntimeEvidenceRecord).not.toHaveBeenCalled();
  });

  test("allows recorder-token evidence from the recorder page", async () => {
    mocks.requireApiUser.mockResolvedValue({
      response: new Response("auth required", { status: 401 }),
    });
    mocks.getSessionForRecorderToken.mockResolvedValue({
      id: recorderSessionId,
    });

    const response = await POST(evidenceRequest(evidenceBody()));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      data: {
        receiptId: "abcd1234abcd1234abcd1234",
        platform: "android",
        source: "recorder_page",
        sessionId: recorderSessionId,
        release,
      },
    });
    expect(mocks.getSessionForRecorderToken).toHaveBeenCalledWith(
      recorderSessionId,
      recorderToken,
    );
    expect(mocks.buildDeviceRuntimeEvidenceRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "recorder_page",
        sessionId: recorderSessionId,
      }),
    );
    expect(mocks.auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: null,
        sessionId: recorderSessionId,
        entityId: "abcd1234abcd1234abcd1234",
        metadata: expect.objectContaining({
          authVia: "recorder_token",
          receiptId: "abcd1234abcd1234abcd1234",
        }),
      }),
    );
  });

  test("does not let recorder tokens submit non-recorder evidence sources", async () => {
    mocks.requireApiUser.mockResolvedValue({
      response: new Response("auth required", { status: 401 }),
    });

    const response = await POST(
      evidenceRequest(evidenceBody({ source: "admin_settings" })),
    );

    expect(response.status).toBe(401);
    expect(mocks.getSessionForRecorderToken).not.toHaveBeenCalled();
    expect(mocks.appendDeviceRuntimeEvidenceRecord).not.toHaveBeenCalled();
  });
});
