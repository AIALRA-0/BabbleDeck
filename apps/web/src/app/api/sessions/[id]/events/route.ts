import { fail, ok, requireApiUser, validationError } from "@/server/api";
import { appendTranscriptEvents } from "@/server/session-service";
import { appendEventsSchema } from "@/server/schemas";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const { id } = await context.params;
  let parsed;
  try {
    parsed = appendEventsSchema.parse(await request.json());
  } catch (error) {
    return validationError(error);
  }
  const events = await appendTranscriptEvents({
    sessionId: id,
    actorUserId: user.id,
    events: parsed.events,
  });
  if (!events) return fail("NOT_FOUND", "Session not found.", 404);
  return ok({ events });
}
