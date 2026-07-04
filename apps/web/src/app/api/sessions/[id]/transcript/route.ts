import { getCurrentUser } from "@/server/auth";
import { fail, ok } from "@/server/api";
import {
  getSessionForAdmin,
  transcriptPayload,
} from "@/server/session-service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED", "Authentication required.", 401);
  const { id } = await context.params;
  const session = await getSessionForAdmin(id, user.id);
  if (!session) return fail("NOT_FOUND", "Session not found.", 404);
  return ok(await transcriptPayload(id));
}
