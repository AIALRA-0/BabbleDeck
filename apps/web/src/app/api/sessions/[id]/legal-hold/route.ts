import {
  fail,
  ok,
  requireApiUser,
  requireSameOriginMutation,
  validationError,
} from "@/server/api";
import { setSessionRawAudioLegalHold } from "@/server/settings-service";
import { updateSessionLegalHoldSchema } from "@/server/schemas";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const csrfResponse = requireSameOriginMutation(request);
  if (csrfResponse) return csrfResponse;

  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const { id } = await context.params;

  let parsed;
  try {
    parsed = updateSessionLegalHoldSchema.parse(await request.json());
  } catch (error) {
    return validationError(error);
  }

  const session = await setSessionRawAudioLegalHold({
    sessionId: id,
    ownerUserId: user.id,
    actorUserId: user.id,
    enabled: parsed.rawAudioLegalHold,
    userAgent: request.headers.get("user-agent"),
  });
  if (!session) return fail("NOT_FOUND", "Session not found.", 404);

  return ok({
    session: {
      id: session.id,
      rawAudioLegalHold: parsed.rawAudioLegalHold,
    },
  });
}
