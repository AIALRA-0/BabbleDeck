import "server-only";

import { fail, requireApiUser, requireSameOriginMutation } from "@/server/api";
import {
  findRecorderSessionForOwner,
  findRecorderSessionForToken,
  recorderTokenFromRequest,
  type RecorderAccess,
} from "@/server/recorder-access";

export async function requireRecorderAccess(
  request: Request,
  sessionId: string,
): Promise<{ access: RecorderAccess } | { response: Response }> {
  const auth = await requireApiUser();
  if (!("response" in auth)) {
    const csrfResponse = requireSameOriginMutation(request);
    if (csrfResponse) return { response: csrfResponse };
    const session = await findRecorderSessionForOwner(sessionId, auth.user.id);
    if (session) {
      return {
        access: { kind: "admin", actorUserId: auth.user.id, session },
      };
    }
  }

  const recorderToken = recorderTokenFromRequest(request);
  const tokenSession = await findRecorderSessionForToken(
    sessionId,
    recorderToken,
  );
  if (tokenSession) {
    return {
      access: {
        kind: "recorder_token",
        actorUserId: null,
        session: tokenSession,
      },
    };
  }

  if ("response" in auth && !recorderToken) return auth;
  if (recorderToken) {
    return {
      response: fail("UNAUTHENTICATED", "Invalid recorder token.", 401),
    };
  }
  return { response: fail("NOT_FOUND", "Session not found.", 404) };
}
