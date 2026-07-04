import { auditLog } from "@/server/audit";
import { fail, ok, requireApiUser } from "@/server/api";
import { prisma } from "@/server/db";
import { serializeSession } from "@/server/serializers";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const { id } = await context.params;
  const existing = await prisma.liveSession.findFirst({
    where: { id, ownerUserId: user.id },
  });
  if (!existing) return fail("NOT_FOUND", "Session not found.", 404);
  const session = await prisma.liveSession.update({
    where: { id },
    data: {
      status: "COMPLETED",
      endedAt: existing.endedAt ?? new Date(),
    },
  });
  await auditLog({
    actorUserId: user.id,
    sessionId: id,
    action: "session.recording_stopped",
    entityType: "live_session",
    entityId: id,
    userAgent: request.headers.get("user-agent"),
  });
  return ok({ session: serializeSession(session) });
}
