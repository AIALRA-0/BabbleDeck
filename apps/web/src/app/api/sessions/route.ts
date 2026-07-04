import { createLiveSession } from "@/server/session-service";
import { getCurrentUser } from "@/server/auth";
import { fail, getClientIp, ok, validationError } from "@/server/api";
import { prisma } from "@/server/db";
import { checkRateLimit } from "@/server/rate-limit";
import { createSessionSchema } from "@/server/schemas";
import { serializeSession } from "@/server/serializers";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED", "Authentication required.", 401);

  const sessions = await prisma.liveSession.findMany({
    where: { ownerUserId: user.id, archivedAt: null },
    include: {
      audioChunks: true,
      transcriptSegments: { include: { translations: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return ok({
    sessions: sessions.map((session) => serializeSession(session)),
    nextCursor: null,
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED", "Authentication required.", 401);

  const ip = getClientIp(request);
  const limit = Number(process.env.SESSION_CREATE_RATE_LIMIT_PER_MINUTE ?? 10);
  const limited = checkRateLimit(
    `session-create:${ip}:${user.id}`,
    limit,
    60_000,
  );
  if (!limited.allowed) {
    return fail(
      "RATE_LIMITED",
      "Too many sessions created. Try again soon.",
      429,
    );
  }

  let parsed;
  try {
    parsed = createSessionSchema.parse(await request.json());
  } catch (error) {
    return validationError(error);
  }

  const result = await createLiveSession({
    ...parsed,
    ownerUserId: user.id,
    ip,
    userAgent: request.headers.get("user-agent"),
    origin: new URL(request.url).origin,
  });

  return ok(result);
}
