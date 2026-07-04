import { auditLog } from "@/server/audit";
import { getCurrentUser } from "@/server/auth";
import { fail, ok } from "@/server/api";
import { prisma } from "@/server/db";
import { serializeSession } from "@/server/serializers";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED", "Authentication required.", 401);
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
