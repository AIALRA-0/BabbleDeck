import { fail, ok, validationError } from "@/server/api";
import { requireRecorderAccess } from "@/server/recorder-route-access";
import { appendTranscriptEvents } from "@/server/session-service";
import { appendEventsSchema } from "@/server/schemas";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const auth = await requireRecorderAccess(request, id);
  if ("response" in auth) return auth.response;
  const { access } = auth;
  let parsed;
  try {
    parsed = appendEventsSchema.parse(await request.json());
  } catch (error) {
    return validationError(error);
  }
  const events = await appendTranscriptEvents({
    sessionId: id,
    actorUserId: access.actorUserId,
    events: parsed.events,
  });
  if (!events) return fail("NOT_FOUND", "Session not found.", 404);
  return ok({ events });
}
