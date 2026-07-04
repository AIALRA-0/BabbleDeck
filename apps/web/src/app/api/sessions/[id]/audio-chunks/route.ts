import { getCurrentUser } from "@/server/auth";
import { fail, ok, validationError } from "@/server/api";
import { prisma } from "@/server/db";
import { audioChunkSchema } from "@/server/schemas";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED", "Authentication required.", 401);
  const { id } = await context.params;
  const session = await prisma.liveSession.findFirst({
    where: { id, ownerUserId: user.id },
  });
  if (!session) return fail("NOT_FOUND", "Session not found.", 404);

  let parsed;
  try {
    parsed = audioChunkSchema.parse(await request.json());
  } catch (error) {
    return validationError(error);
  }

  const objectKey = `sessions/${id}/audio/chunk-${parsed.chunkIndex
    .toString()
    .padStart(6, "0")}.webm`;
  const chunk = await prisma.audioChunk.upsert({
    where: {
      sessionId_chunkIndex: {
        sessionId: id,
        chunkIndex: parsed.chunkIndex,
      },
    },
    update: {
      objectKey,
      mimeType: parsed.mimeType,
      byteSize: BigInt(parsed.byteSize),
      durationMs: parsed.durationMs,
      checksumSha256: parsed.checksumSha256,
      status: "UPLOADED",
    },
    create: {
      sessionId: id,
      chunkIndex: parsed.chunkIndex,
      objectKey,
      mimeType: parsed.mimeType,
      byteSize: BigInt(parsed.byteSize),
      durationMs: parsed.durationMs,
      checksumSha256: parsed.checksumSha256,
      startedAt: parsed.startedAt ? new Date(parsed.startedAt) : undefined,
      status: "UPLOADED",
    },
  });

  return ok({
    chunkId: chunk.id,
    objectKey: chunk.objectKey,
    status: chunk.status.toLowerCase(),
  });
}
