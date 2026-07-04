import { fail, ok } from "@/server/api";
import { prisma } from "@/server/db";
import { getSessionByShareToken } from "@/server/session-service";
import {
  serializeEvent,
  serializeSegment,
  serializeSession,
} from "@/server/serializers";

export async function GET(
  request: Request,
  context: { params: Promise<{ shareToken: string }> },
) {
  const { shareToken } = await context.params;
  const session = await getSessionByShareToken(shareToken);
  if (!session) return fail("NOT_FOUND", "Session link not found.", 404);
  const url = new URL(request.url);
  const after = Number(url.searchParams.get("after") ?? 0);
  const events = await prisma.transcriptEvent.findMany({
    where: {
      sessionId: session.id,
      sequenceNo: Number.isFinite(after) ? { gt: after } : undefined,
    },
    orderBy: { sequenceNo: "asc" },
    take: 100,
  });
  return ok({
    session: serializeSession(session),
    events: events.map(serializeEvent),
    segments: session.transcriptSegments.map(serializeSegment),
  });
}
