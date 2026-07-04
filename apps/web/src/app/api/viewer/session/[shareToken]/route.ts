import { fail, ok } from "@/server/api";
import { getSessionByShareToken } from "@/server/session-service";
import { serializeSession } from "@/server/serializers";

export async function GET(
  _request: Request,
  context: { params: Promise<{ shareToken: string }> },
) {
  const { shareToken } = await context.params;
  const session = await getSessionByShareToken(shareToken);
  if (!session) return fail("NOT_FOUND", "Session link not found.", 404);
  return ok({ session: serializeSession(session) });
}
