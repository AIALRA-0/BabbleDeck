import { fail, getClientIp, ok, validationError } from "@/server/api";
import { createLiveKitJoinToken } from "@/server/livekit";
import { requireRecorderAccess } from "@/server/recorder-route-access";
import { checkRateLimit } from "@/server/rate-limit";
import { liveKitTokenSchema } from "@/server/schemas";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const auth = await requireRecorderAccess(request, id);
  if ("response" in auth) return auth.response;

  const limited = checkRateLimit(
    `livekit-token:${getClientIp(request)}:${id}`,
    Number(process.env.LIVEKIT_TOKEN_RATE_LIMIT_PER_MINUTE ?? 60),
    60_000,
  );
  if (!limited.allowed) {
    return fail("RATE_LIMITED", "Too many LiveKit tokens requested.", 429, {
      retryAfterSeconds: limited.retryAfterSeconds,
    });
  }

  let parsed;
  try {
    parsed = liveKitTokenSchema.parse(await request.json().catch(() => ({})));
  } catch (error) {
    return validationError(error);
  }

  const token = await createLiveKitJoinToken({
    sessionId: id,
    role: parsed.role,
    identityPrefix:
      auth.access.kind === "admin" ? "admin-recorder" : "public-recorder",
    displayName: parsed.displayName,
  });
  if (!token) {
    return fail(
      "PROVIDER_NOT_CONFIGURED",
      "LiveKit is not configured for this deployment.",
      503,
    );
  }

  return ok(token);
}
