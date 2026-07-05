import { fail, getClientIp, ok } from "@/server/api";
import { prisma } from "@/server/db";
import { createLiveKitJoinToken } from "@/server/livekit";
import { checkRateLimit } from "@/server/rate-limit";
import { hashToken } from "@/server/security";

export async function POST(
  request: Request,
  context: { params: Promise<{ shareToken: string }> },
) {
  const { shareToken } = await context.params;
  const limited = checkRateLimit(
    `viewer-livekit-token:${getClientIp(request)}:${shareToken}`,
    Number(process.env.LIVEKIT_TOKEN_RATE_LIMIT_PER_MINUTE ?? 60),
    60_000,
  );
  if (!limited.allowed) {
    return fail("RATE_LIMITED", "Too many LiveKit tokens requested.", 429, {
      retryAfterSeconds: limited.retryAfterSeconds,
    });
  }

  const session = await prisma.liveSession.findUnique({
    where: { shareTokenHash: hashToken(shareToken) },
    select: { id: true, archivedAt: true },
  });
  if (!session || session.archivedAt) {
    return fail("NOT_FOUND", "Session link not found.", 404);
  }

  const token = await createLiveKitJoinToken({
    sessionId: session.id,
    role: "subscriber",
    identityPrefix: "viewer",
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
