import { auditLog } from "@/server/audit";
import { fail, getClientIp, ok } from "@/server/api";
import { prisma } from "@/server/db";
import { requireRecorderAccess } from "@/server/recorder-route-access";
import { serializeSession } from "@/server/serializers";
import { checkRecorderControlRateLimit } from "@/server/sensitive-route-rate-limit";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const auth = await requireRecorderAccess(request, id);
  if ("response" in auth) return auth.response;
  const { access } = auth;
  const limited = checkRecorderControlRateLimit({
    sessionId: id,
    ip: getClientIp(request),
  });
  if (!limited.allowed) {
    return fail("RATE_LIMITED", "Too many recorder control requests.", 429, {
      retryAfterSeconds: limited.retryAfterSeconds,
    });
  }
  const existing = access.session;
  if (existing.status === "COMPLETED" || existing.status === "ARCHIVED") {
    return fail(
      "SESSION_ALREADY_ENDED",
      "This session has already ended.",
      409,
    );
  }
  const session = await prisma.liveSession.update({
    where: { id },
    data: {
      status:
        existing.status === "PROVIDER_DEGRADED"
          ? "PROVIDER_DEGRADED"
          : "RECORDING",
      startedAt: existing.startedAt ?? new Date(),
    },
  });
  await auditLog({
    actorUserId: access.actorUserId,
    sessionId: id,
    action: "session.recording_started",
    entityType: "live_session",
    entityId: id,
    userAgent: request.headers.get("user-agent"),
    metadata: { authVia: access.kind },
  });
  return ok({ session: serializeSession(session) });
}
