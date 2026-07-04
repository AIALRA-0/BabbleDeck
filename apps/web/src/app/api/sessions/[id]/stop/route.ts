import { auditLog } from "@/server/audit";
import { ok } from "@/server/api";
import { serializeSession } from "@/server/serializers";
import { prisma } from "@/server/db";
import { requireRecorderAccess } from "@/server/recorder-route-access";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const auth = await requireRecorderAccess(request, id);
  if ("response" in auth) return auth.response;
  const { access } = auth;
  const existing = access.session;
  const session = await prisma.liveSession.update({
    where: { id },
    data: {
      status:
        existing.status === "PROVIDER_DEGRADED"
          ? "PROVIDER_DEGRADED"
          : "COMPLETED",
      endedAt: existing.endedAt ?? new Date(),
    },
  });
  await auditLog({
    actorUserId: access.actorUserId,
    sessionId: id,
    action: "session.recording_stopped",
    entityType: "live_session",
    entityId: id,
    userAgent: request.headers.get("user-agent"),
    metadata: { authVia: access.kind },
  });
  return ok({ session: serializeSession(session) });
}
