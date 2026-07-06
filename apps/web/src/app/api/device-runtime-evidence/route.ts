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

export async function POST(request: Request) {
  const csrfResponse = requireSameOriginMutation(request);
  if (csrfResponse) return csrfResponse;

  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const { user } = auth;

  let parsed;
  try {
    parsed = deviceRuntimeEvidenceSchema.parse(await request.json());
  } catch (error) {
    return validationError(error);
  }

  let record;
  try {
    record = buildDeviceRuntimeEvidenceRecord({
      platform: parsed.platform,
      passed: parsed.passed,
      checks: parsed.checks,
      release: currentDeviceEvidenceRelease(),
      baseUrl: productionDeviceEvidenceBaseUrl(),
      notes: parsed.notes,
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
    actorUserId: user.id,
    action: "device_runtime_evidence.recorded",
    entityType: "device_runtime_evidence",
    entityId: `${record.platform}:${record.release.commit}`,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    metadata: {
      platform: record.platform,
      release: record.release,
      ok: record.ok,
      source: record.source,
      client: {
        viewportWidth: record.client.viewportWidth,
        viewportHeight: record.client.viewportHeight,
        displayMode: record.client.displayMode,
      },
    },
  });

  return ok({
    recordedAt: record.recordedAt,
    platform: record.platform,
    release: record.release,
  });
}
