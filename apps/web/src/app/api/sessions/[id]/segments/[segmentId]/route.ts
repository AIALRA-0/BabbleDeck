import {
  fail,
  getClientIp,
  ok,
  requireApiUser,
  validationError,
} from "@/server/api";
import { updateTranscriptSegment } from "@/server/session-service";
import { updateTranscriptSegmentSchema } from "@/server/schemas";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; segmentId: string }> },
) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const { id, segmentId } = await context.params;

  let parsed;
  try {
    parsed = updateTranscriptSegmentSchema.parse(await request.json());
  } catch (error) {
    return validationError(error);
  }

  const segment = await updateTranscriptSegment({
    sessionId: id,
    segmentId,
    actorUserId: user.id,
    originalText: parsed.originalText,
    translationText: parsed.translationText,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
  });
  if (!segment) return fail("NOT_FOUND", "Segment not found.", 404);

  return ok({ segment });
}
