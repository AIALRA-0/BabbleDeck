import { fail, ok, requireApiUser } from "@/server/api";
import {
  getSessionForAdmin,
  transcriptPayload,
} from "@/server/session-service";

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
  return ok(await transcriptPayload(id));
}
