import { auditLog } from "@/server/audit";
import { fail, ok } from "@/server/api";
import { prisma } from "@/server/db";
import { requireRecorderAccess } from "@/server/recorder-route-access";
import { serializeSession } from "@/server/serializers";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const auth = await requireRecorderAccess(request, id);
  if ("response" in auth) return auth.response;
  const { access } = auth;
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
