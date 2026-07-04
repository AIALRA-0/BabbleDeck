import { fail, ok, requireApiUser, validationError } from "@/server/api";
import {
  AUDIO_CHUNK_MAX_BYTES,
  sha256Hex,
  uploadAudioChunk,
} from "@/server/audio-storage";
import { prisma } from "@/server/db";
import { recordProviderAudioUsage } from "@/server/provider-usage";
import { audioChunkSchema } from "@/server/schemas";

export const runtime = "nodejs";

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const { id } = await context.params;
  const session = await prisma.liveSession.findFirst({
    where: { id, ownerUserId: user.id },
  });
  if (!session) return fail("NOT_FOUND", "Session not found.", 404);

  let parsed;
  let file: File | null = null;
  try {
    const formData = await request.formData();
    const fileValue = formData.get("file");
    if (!(fileValue instanceof File)) {
      return fail("VALIDATION_ERROR", "Audio chunk file is required.", 400);
    }
    file = fileValue;
    parsed = audioChunkSchema.parse({
      chunkIndex: formValue(formData, "chunkIndex"),
      startedAt: formValue(formData, "startedAt"),
      durationMs: formValue(formData, "durationMs"),
      mimeType: formValue(formData, "mimeType") ?? file.type,
      byteSize: file.size,
      checksumSha256: formValue(formData, "checksumSha256"),
    });
  } catch (error) {
    return validationError(error);
  }

  if (!file) {
    return fail("VALIDATION_ERROR", "Audio chunk file is required.", 400);
  }
  if (file.size === 0 || file.size > AUDIO_CHUNK_MAX_BYTES) {
    return fail(
      "AUDIO_CHUNK_TOO_LARGE",
      "Audio chunks must be between 1 byte and 25 MB.",
      413,
    );
  }

  const body = Buffer.from(await file.arrayBuffer());
  const checksumSha256 = sha256Hex(body);
  if (parsed.checksumSha256 && parsed.checksumSha256 !== checksumSha256) {
    return fail("VALIDATION_ERROR", "Audio chunk checksum mismatch.", 400);
  }
  let storage;
  try {
    storage = await uploadAudioChunk({
      sessionId: id,
      chunkIndex: parsed.chunkIndex,
      body,
      mimeType: parsed.mimeType,
      checksumSha256,
    });
  } catch {
    return fail("INTERNAL_ERROR", "Audio chunk storage failed.", 500);
  }

  const existingChunk = await prisma.audioChunk.findUnique({
    where: {
      sessionId_chunkIndex: {
        sessionId: id,
        chunkIndex: parsed.chunkIndex,
      },
    },
  });
  const chunk = await prisma.$transaction(async (tx) => {
    const savedChunk = await tx.audioChunk.upsert({
      where: {
        sessionId_chunkIndex: {
          sessionId: id,
          chunkIndex: parsed.chunkIndex,
        },
      },
      update: {
        objectKey: storage.objectKey,
        mimeType: parsed.mimeType,
        byteSize: BigInt(file.size),
        durationMs: parsed.durationMs,
        checksumSha256,
        status: "UPLOADED",
        uploadedAt: new Date(),
        metadata: {
          storageDriver: storage.driver,
          storageBucket: storage.bucket ?? null,
        },
      },
      create: {
        sessionId: id,
        chunkIndex: parsed.chunkIndex,
        objectKey: storage.objectKey,
        mimeType: parsed.mimeType,
        byteSize: BigInt(file.size),
        durationMs: parsed.durationMs,
        checksumSha256,
        startedAt: parsed.startedAt ? new Date(parsed.startedAt) : undefined,
        status: "UPLOADED",
        metadata: {
          storageDriver: storage.driver,
          storageBucket: storage.bucket ?? null,
        },
      },
    });

    if (!existingChunk && parsed.durationMs) {
      await recordProviderAudioUsage(tx, {
        sessionId: id,
        providerName: session.providerName,
        qualityMode: session.qualityMode,
        audioMs: parsed.durationMs,
        targetLanguage: session.targetLanguage,
        payload: {
          chunkId: savedChunk.id,
          chunkIndex: parsed.chunkIndex,
          byteSize: file.size,
          mimeType: parsed.mimeType,
        },
      });
    }

    return savedChunk;
  });

  return ok({
    chunkId: chunk.id,
    objectKey: chunk.objectKey,
    status: chunk.status.toLowerCase(),
  });
}
