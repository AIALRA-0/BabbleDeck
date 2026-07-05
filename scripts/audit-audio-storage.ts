import { Prisma } from "@prisma/client";
import { prisma } from "../apps/web/src/server/db";
import {
  headAudioObject,
  resolveAudioStorageConfig,
} from "../apps/web/src/server/audio-storage";

type AuditChunk = {
  id: string;
  objectKey: string;
  byteSize: bigint;
  metadata: Prisma.JsonValue;
};

function argValue(name: string) {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

function numberArg(name: string, fallback: number) {
  const raw = argValue(name);
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function boolFlag(name: string) {
  return process.argv.includes(name);
}

function metadataObject(metadata: Prisma.JsonValue) {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return {};
}

function expectedMetadata(input: { driver: "local" | "s3"; bucket?: string }) {
  return {
    driver: input.driver,
    bucket: input.driver === "s3" ? (input.bucket ?? null) : null,
  };
}

async function findAuditBatch(input: {
  all: boolean;
  cursorId: string | null;
  limit: number;
}) {
  const take = input.all ? input.limit : input.limit + 1;
  const rows = await prisma.audioChunk.findMany({
    where: { status: "UPLOADED" },
    orderBy: input.all
      ? [{ id: "asc" }]
      : [{ uploadedAt: "asc" }, { id: "asc" }],
    take,
    ...(input.cursorId ? { cursor: { id: input.cursorId }, skip: 1 } : {}),
    select: {
      id: true,
      objectKey: true,
      byteSize: true,
      metadata: true,
    },
  });

  return {
    chunks: input.all ? rows : rows.slice(0, input.limit),
    hasMore: input.all
      ? rows.length === input.limit
      : rows.length > input.limit,
  };
}

async function main() {
  const limit = numberArg("--limit", 1000);
  const requireCurrentTarget = boolFlag("--require-current-target");
  const all = boolFlag("--all");
  const config = resolveAudioStorageConfig();
  const expected = expectedMetadata(config);

  let present = 0;
  let missing = 0;
  let sizeMismatches = 0;
  let targetMetadataMismatches = 0;
  let scanned = 0;
  let cursorId: string | null = null;
  let hasMore = false;
  const errors: {
    objectKey: string;
    code: "missing" | "size_mismatch" | "target_metadata_mismatch";
    message: string;
  }[] = [];

  while (true) {
    const batch = await findAuditBatch({ all, cursorId, limit });
    hasMore = batch.hasMore;
    const chunks: AuditChunk[] = batch.chunks;
    scanned += chunks.length;

    for (const chunk of chunks) {
      try {
        const result = await headAudioObject(chunk.objectKey);
        present += 1;
        if (
          result.byteSize != null &&
          BigInt(result.byteSize) !== chunk.byteSize
        ) {
          sizeMismatches += 1;
          errors.push({
            objectKey: chunk.objectKey,
            code: "size_mismatch",
            message: `Object size ${result.byteSize} did not match database size ${chunk.byteSize.toString()}.`,
          });
        }
      } catch (error) {
        missing += 1;
        errors.push({
          objectKey: chunk.objectKey,
          code: "missing",
          message: error instanceof Error ? error.message : "Object missing.",
        });
        continue;
      }

      if (requireCurrentTarget) {
        const metadata = metadataObject(chunk.metadata);
        const driver = metadata.storageDriver;
        const bucket = metadata.storageBucket ?? null;
        if (driver !== expected.driver || bucket !== expected.bucket) {
          targetMetadataMismatches += 1;
          errors.push({
            objectKey: chunk.objectKey,
            code: "target_metadata_mismatch",
            message: `Chunk metadata points to ${String(driver ?? "unknown")}/${String(bucket ?? "none")} instead of ${expected.driver}/${String(expected.bucket ?? "none")}.`,
          });
        }
      }
    }

    if (!all || !hasMore || chunks.length === 0) break;
    cursorId = chunks[chunks.length - 1]?.id ?? null;
  }

  const ok =
    missing === 0 &&
    sizeMismatches === 0 &&
    (!requireCurrentTarget || targetMetadataMismatches === 0);
  process.stdout.write(
    `${JSON.stringify(
      {
        ok,
        targetDriver: config.driver,
        targetBucket: config.driver === "s3" ? config.bucket : undefined,
        requireCurrentTarget,
        all,
        scannedChunks: scanned,
        presentChunks: present,
        missingChunks: missing,
        sizeMismatches,
        targetMetadataMismatches,
        hasMore: all ? false : hasMore,
        errors: errors.slice(0, 20),
      },
      null,
      2,
    )}\n`,
  );
  if (!ok) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Audio storage audit failed.",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
