import { fail, ok, requireApiUser } from "@/server/api";
import { getSessionForAdmin } from "@/server/session-service";
import { serializeSegment, serializeSession } from "@/server/serializers";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const { id } = await context.params;
  const session = await getSessionForAdmin(id, user.id);
  if (!session) return fail("NOT_FOUND", "Session not found.", 404);
  return ok({
    session: serializeSession(session),
    segments: session.transcriptSegments.map(serializeSegment),
  });
}
