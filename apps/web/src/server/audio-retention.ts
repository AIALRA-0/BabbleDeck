import { Prisma } from "@prisma/client";
import { deleteAudioObject } from "./audio-storage";
import { prisma } from "./db";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_RETENTION_DAYS = 30;
const DEFAULT_BATCH_SIZE = 500;

export type PruneRawAudioResult = {
  dryRun: boolean;
  cutoff: string;
  retentionDays: number;
  matchedChunks: number;
  deletedChunks: number;
  hasMore: boolean;
};

export function resolveAudioRetentionDays(
  raw: string | number | null | undefined,
  fallback = DEFAULT_RETENTION_DAYS,
) {
  const value = Number(raw);
  return Number.isFinite(value) && value >= 1 ? Math.floor(value) : fallback;
}

export function retentionCutoff(now: Date, retentionDays: number) {
  return new Date(now.getTime() - retentionDays * MS_PER_DAY);
}

export function isEndedBeforeRetentionCutoff(
  endedAt: Date | null | undefined,
  cutoff: Date,
) {
  return Boolean(endedAt && endedAt.getTime() < cutoff.getTime());
}

function metadataObject(metadata: Prisma.JsonValue) {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    return metadata;
  }
  return {};
}

export async function pruneRawAudio(input?: {
  now?: Date;
  retentionDays?: number;
  batchSize?: number;
  dryRun?: boolean;
  deleteObject?: typeof deleteAudioObject;
}): Promise<PruneRawAudioResult> {
  const now = input?.now ?? new Date();
  const retentionDays = resolveAudioRetentionDays(input?.retentionDays);
  const batchSize = Math.max(
    1,
    Math.min(5000, Math.floor(input?.batchSize ?? DEFAULT_BATCH_SIZE)),
  );
  const dryRun = Boolean(input?.dryRun);
  const cutoff = retentionCutoff(now, retentionDays);
  const deleteObject = input?.deleteObject ?? deleteAudioObject;

  const chunks = await prisma.audioChunk.findMany({
    where: {
      status: "UPLOADED",
      session: {
        endedAt: { lt: cutoff },
        NOT: {
          metadata: {
            path: ["rawAudioLegalHold"],
            equals: true,
          },
        },
      },
    },
    include: {
      session: { select: { endedAt: true } },
    },
    orderBy: [{ uploadedAt: "asc" }, { id: "asc" }],
    take: batchSize,
  });

  if (dryRun) {
    return {
      dryRun,
      cutoff: cutoff.toISOString(),
      retentionDays,
      matchedChunks: chunks.length,
      deletedChunks: 0,
      hasMore: chunks.length === batchSize,
    };
  }

  let deletedChunks = 0;
  for (const chunk of chunks) {
    if (!isEndedBeforeRetentionCutoff(chunk.session.endedAt, cutoff)) {
      continue;
    }
    const deleteResult = await deleteObject(chunk.objectKey);
    await prisma.audioChunk.update({
      where: { id: chunk.id },
      data: {
        status: "DELETED",
        metadata: {
          ...metadataObject(chunk.metadata),
          retentionDeletedAt: now.toISOString(),
          retentionReason: "raw_audio_retention",
          retentionDays,
          objectDeleteDriver: deleteResult.driver,
          objectDeleteBucket: deleteResult.bucket ?? null,
        },
      },
    });
    deletedChunks += 1;
  }

  return {
    dryRun,
    cutoff: cutoff.toISOString(),
    retentionDays,
    matchedChunks: chunks.length,
    deletedChunks,
    hasMore: chunks.length === batchSize,
  };
}
