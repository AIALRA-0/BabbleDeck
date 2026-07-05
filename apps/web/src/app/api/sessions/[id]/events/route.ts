import { fail, getClientIp, ok, validationError } from "@/server/api";
import { requireRecorderAccess } from "@/server/recorder-route-access";
import { appendTranscriptEvents } from "@/server/session-service";
import { appendEventsSchema } from "@/server/schemas";
import { checkTranscriptEventAppendRateLimit } from "@/server/sensitive-route-rate-limit";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const auth = await requireRecorderAccess(request, id);
  if ("response" in auth) return auth.response;
  const { access } = auth;
  const limited = checkTranscriptEventAppendRateLimit({
    sessionId: id,
    ip: getClientIp(request),
  });
  if (!limited.allowed) {
    return fail("RATE_LIMITED", "Too many transcript events submitted.", 429, {
      retryAfterSeconds: limited.retryAfterSeconds,
    });
  }
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
