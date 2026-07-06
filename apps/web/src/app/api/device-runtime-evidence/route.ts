export const runtime = "nodejs";

import { auditLog } from "@/server/audit";
import {
  fail,
  getClientIp,
  ok,
  requireApiUser,
  requireSameOriginMutation,
  validationError,
} from "@/server/api";
import {
  appendDeviceRuntimeEvidenceRecord,
  buildDeviceRuntimeEvidenceRecord,
  currentDeviceEvidenceRelease,
  productionDeviceEvidenceBaseUrl,
} from "@/server/device-runtime-evidence";
import { deviceRuntimeEvidenceSchema } from "@/server/schemas";
import { getSessionForRecorderToken } from "@/server/session-service";

export async function POST(request: Request) {
  const csrfResponse = requireSameOriginMutation(request);
  if (csrfResponse) return csrfResponse;

  let parsed;
  try {
    parsed = deviceRuntimeEvidenceSchema.parse(await request.json());
  } catch (error) {
    return validationError(error);
  }

  const auth = await requireApiUser();
  let actorUserId: string | null = null;
  let sessionId: string | null = parsed.recorderSessionId ?? null;
  let authVia: "admin" | "recorder_token" = "admin";

  if ("response" in auth) {
    if (
      parsed.source !== "recorder_page" ||
      !parsed.recorderSessionId ||
      !parsed.recorderToken
    ) {
      return auth.response;
    }

    const recorderSession = await getSessionForRecorderToken(
      parsed.recorderSessionId,
      parsed.recorderToken,
    );
    if (!recorderSession) return auth.response;
    sessionId = recorderSession.id;
    authVia = "recorder_token";
  } else {
    actorUserId = auth.user.id;
  }

  let record;
  try {
    record = buildDeviceRuntimeEvidenceRecord({
      platform: parsed.platform,
      passed: parsed.passed,
      checks: parsed.checks,
      sessionId,
      release: currentDeviceEvidenceRelease(),
      baseUrl: productionDeviceEvidenceBaseUrl(),
      notes: parsed.notes,
      source: parsed.source,
      client: {
        ...parsed.client,
        userAgent: request.headers.get("user-agent") ?? undefined,
      },
    });
  } catch {
    return fail(
      "INTERNAL_ERROR",
      "Production release metadata is unavailable.",
      500,
    );
  }

  if (!record.ok) {
    return fail(
      "VALIDATION_ERROR",
      "All runtime evidence checks must be confirmed.",
      400,
      { missingChecks: record.missingChecks },
    );
  }

  await appendDeviceRuntimeEvidenceRecord(record);
  await auditLog({
    actorUserId,
    sessionId,
    action: "device_runtime_evidence.recorded",
    entityType: "device_runtime_evidence",
    entityId: record.receiptId,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    metadata: {
      platform: record.platform,
      release: record.release,
      ok: record.ok,
      source: record.source,
      receiptId: record.receiptId,
      authVia,
      client: {
        viewportWidth: record.client.viewportWidth,
        viewportHeight: record.client.viewportHeight,
        displayMode: record.client.displayMode,
      },
    },
  });

  return ok({
    receiptId: record.receiptId,
    recordedAt: record.recordedAt,
    platform: record.platform,
    source: record.source,
    sessionId: record.sessionId ?? null,
    release: record.release,
  });
}
