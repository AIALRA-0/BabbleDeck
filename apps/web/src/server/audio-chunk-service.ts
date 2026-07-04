import {
  AUDIO_CHUNK_MAX_BYTES,
  sha256Hex,
  uploadAudioChunk,
} from "./audio-storage";
import { prisma } from "./db";
import { recordProviderAudioUsage } from "./provider-usage";
import { apiStatus } from "./serializers";

export type SaveSessionAudioChunkInput = {
  sessionId: string;
  ownerUserId: string;
  chunkIndex: number;
  startedAt?: string;
  durationMs?: number;
  mimeType: string;
  body: Buffer;
  checksumSha256?: string;
};

export type SaveSessionAudioChunkResult = {
  chunkId: string;
  objectKey: string;
  status: string;
  provider: {
    budgetExceeded: boolean;
    sessionStatus: string | null;
    estimatedCostUsd: number | null;
  } | null;
};

export class AudioChunkUploadError extends Error {
  constructor(
    public readonly code:
      | "NOT_FOUND"
      | "VALIDATION_ERROR"
      | "AUDIO_CHUNK_TOO_LARGE"
      | "INTERNAL_ERROR",
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export async function saveSessionAudioChunk(
  input: SaveSessionAudioChunkInput,
): Promise<SaveSessionAudioChunkResult> {
  const session = await prisma.liveSession.findFirst({
    where: { id: input.sessionId, ownerUserId: input.ownerUserId },
  });
  if (!session) {
    throw new AudioChunkUploadError("NOT_FOUND", "Session not found.", 404);
  }

  if (input.body.length === 0 || input.body.length > AUDIO_CHUNK_MAX_BYTES) {
    throw new AudioChunkUploadError(
      "AUDIO_CHUNK_TOO_LARGE",
      "Audio chunks must be between 1 byte and 25 MB.",
      413,
    );
  }

  const checksumSha256 = sha256Hex(input.body);
  if (input.checksumSha256 && input.checksumSha256 !== checksumSha256) {
    throw new AudioChunkUploadError(
      "VALIDATION_ERROR",
      "Audio chunk checksum mismatch.",
      400,
    );
  }

  let storage;
  try {
    storage = await uploadAudioChunk({
      sessionId: input.sessionId,
      chunkIndex: input.chunkIndex,
      body: input.body,
      mimeType: input.mimeType,
      checksumSha256,
    });
  } catch {
    throw new AudioChunkUploadError(
      "INTERNAL_ERROR",
      "Audio chunk storage failed.",
      500,
    );
  }

  const existingChunk = await prisma.audioChunk.findUnique({
    where: {
      sessionId_chunkIndex: {
        sessionId: input.sessionId,
        chunkIndex: input.chunkIndex,
      },
    },
  });
  const result = await prisma.$transaction(async (tx) => {
    const savedChunk = await tx.audioChunk.upsert({
      where: {
        sessionId_chunkIndex: {
          sessionId: input.sessionId,
          chunkIndex: input.chunkIndex,
        },
      },
      update: {
        objectKey: storage.objectKey,
        mimeType: input.mimeType,
        byteSize: BigInt(input.body.length),
        durationMs: input.durationMs,
        checksumSha256,
        status: "UPLOADED",
        uploadedAt: new Date(),
        metadata: {
          storageDriver: storage.driver,
          storageBucket: storage.bucket ?? null,
        },
      },
      create: {
        sessionId: input.sessionId,
        chunkIndex: input.chunkIndex,
        objectKey: storage.objectKey,
        mimeType: input.mimeType,
        byteSize: BigInt(input.body.length),
        durationMs: input.durationMs,
        checksumSha256,
        startedAt: input.startedAt ? new Date(input.startedAt) : undefined,
        status: "UPLOADED",
        metadata: {
          storageDriver: storage.driver,
          storageBucket: storage.bucket ?? null,
        },
      },
    });

    let usageResult: Awaited<ReturnType<typeof recordProviderAudioUsage>> =
      null;
    if (!existingChunk && input.durationMs) {
      usageResult = await recordProviderAudioUsage(tx, {
        sessionId: input.sessionId,
        actorUserId: input.ownerUserId,
        providerName: session.providerName,
        qualityMode: session.qualityMode,
        audioMs: input.durationMs,
        targetLanguage: session.targetLanguage,
        payload: {
          chunkId: savedChunk.id,
          chunkIndex: input.chunkIndex,
          byteSize: input.body.length,
          mimeType: input.mimeType,
        },
      });
    }

    return { chunk: savedChunk, usageResult };
  });

  return {
    chunkId: result.chunk.id,
    objectKey: result.chunk.objectKey,
    status: result.chunk.status.toLowerCase(),
    provider: result.usageResult
      ? {
          budgetExceeded: result.usageResult.budgetExceeded,
          sessionStatus: result.usageResult.sessionStatus
            ? apiStatus(result.usageResult.sessionStatus)
            : null,
          estimatedCostUsd: result.usageResult.estimatedCostUsd
            ? Number(result.usageResult.estimatedCostUsd)
            : null,
        }
      : null,
  };
}
