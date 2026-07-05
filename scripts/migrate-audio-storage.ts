import fs from "node:fs/promises";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { prisma } from "../apps/web/src/server/db";
import {
  putAudioObject,
  resolveAudioStorageConfig,
  sha256Hex,
} from "../apps/web/src/server/audio-storage";

type MigrationChunk = {
  id: string;
  sessionId: string;
  chunkIndex: number;
  objectKey: string;
  mimeType: string;
  byteSize: bigint;
  checksumSha256: string | null;
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

function targetMetadataFilter(
  targetConfig: ReturnType<typeof resolveAudioStorageConfig> | null,
) {
  if (targetConfig?.driver !== "s3") return null;
  return {
    driver: targetConfig.driver,
    bucket: targetConfig.bucket,
  };
}

function sourceAudioDir() {
  return path.resolve(
    process.env.SOURCE_AUDIO_STORAGE_DIR ??
      process.env.AUDIO_MIGRATION_SOURCE_DIR ??
      process.env.AUDIO_STORAGE_DIR ??
      path.join(process.cwd(), "storage", "babbledeck"),
  );
}

function resolveSourceObjectPath(sourceDir: string, objectKey: string) {
  const fullPath = path.resolve(sourceDir, objectKey);
  const relativePath = path.relative(sourceDir, fullPath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`Object key escaped source audio directory: ${objectKey}`);
  }
  return fullPath;
}

function metadataObject(metadata: Prisma.JsonValue) {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    return metadata;
  }
  return {};
}

async function findMigrationCandidates(input: {
  limit: number;
  targetFilter: ReturnType<typeof targetMetadataFilter>;
}) {
  const take = input.limit + 1;
  if (input.targetFilter) {
    const rows = await prisma.$queryRaw<MigrationChunk[]>(Prisma.sql`
      select
        id,
        "sessionId",
        "chunkIndex",
        "objectKey",
        "mimeType",
        "byteSize",
        "checksumSha256",
        metadata
      from audio_chunks
      where status = 'UPLOADED'::"AudioChunkStatus"
        and (
          metadata->>'storageDriver' is distinct from ${input.targetFilter.driver}
          or coalesce(metadata->>'storageBucket', '') is distinct from ${input.targetFilter.bucket}
        )
      order by "uploadedAt" asc, id asc
      limit ${take}
    `);
    return {
      chunks: rows.slice(0, input.limit),
      hasMore: rows.length > input.limit,
    };
  }

  const rows = await prisma.audioChunk.findMany({
    where: { status: "UPLOADED" },
    orderBy: [{ uploadedAt: "asc" }, { id: "asc" }],
    take,
    select: {
      id: true,
      sessionId: true,
      chunkIndex: true,
      objectKey: true,
      mimeType: true,
      byteSize: true,
      checksumSha256: true,
      metadata: true,
    },
  });
  return {
    chunks: rows.slice(0, input.limit),
    hasMore: rows.length > input.limit,
  };
}

async function main() {
  const dryRun = boolFlag("--dry-run");
  const includeMigrated = boolFlag("--include-migrated");
  const limit = numberArg("--limit", 500);
  const sourceDir = sourceAudioDir();
  const targetConfig = dryRun ? null : resolveAudioStorageConfig();
  const targetFilter =
    dryRun || includeMigrated ? null : targetMetadataFilter(targetConfig);
  const targetDir =
    targetConfig?.driver === "local"
      ? path.resolve(targetConfig.rootDir)
      : null;

  if (!dryRun && targetDir && targetDir === sourceDir) {
    throw new Error(
      "Refusing to migrate local audio storage onto the same source directory.",
    );
  }

  const { chunks, hasMore } = await findMigrationCandidates({
    limit,
    targetFilter,
  });

  let readable = 0;
  let migrated = 0;
  let missing = 0;
  let sizeMismatches = 0;
  let checksumMismatches = 0;
  const errors: { objectKey: string; message: string }[] = [];

  for (const chunk of chunks) {
    const sourcePath = resolveSourceObjectPath(sourceDir, chunk.objectKey);
    let body: Buffer;
    try {
      body = await fs.readFile(sourcePath);
      readable += 1;
    } catch (error) {
      missing += 1;
      errors.push({
        objectKey: chunk.objectKey,
        message:
          error instanceof Error ? error.message : "Source object missing.",
      });
      continue;
    }

    if (chunk.byteSize !== BigInt(body.length)) {
      sizeMismatches += 1;
      errors.push({
        objectKey: chunk.objectKey,
        message: `Source object size ${body.length} did not match database size ${chunk.byteSize.toString()}.`,
      });
      continue;
    }

    if (chunk.checksumSha256 && sha256Hex(body) !== chunk.checksumSha256) {
      checksumMismatches += 1;
      errors.push({
        objectKey: chunk.objectKey,
        message: "Source object checksum did not match database checksum.",
      });
      continue;
    }

    if (dryRun) continue;

    const result = await putAudioObject({
      objectKey: chunk.objectKey,
      body,
      mimeType: chunk.mimeType,
      checksumSha256: chunk.checksumSha256,
      metadata: {
        "session-id": chunk.sessionId,
        "chunk-index": chunk.chunkIndex,
        "migration-source": "local",
      },
    });

    await prisma.audioChunk.update({
      where: { id: chunk.id },
      data: {
        metadata: {
          ...metadataObject(chunk.metadata),
          storageDriver: result.driver,
          storageBucket: result.bucket ?? null,
          storageMigratedAt: new Date().toISOString(),
          storageMigrationSource: "local",
        },
      },
    });
    migrated += 1;
  }

  const failed = missing > 0 || sizeMismatches > 0 || checksumMismatches > 0;
  process.stdout.write(
    `${JSON.stringify(
      {
        dryRun,
        sourceDir,
        targetDriver:
          targetConfig?.driver ?? process.env.AUDIO_STORAGE_DRIVER ?? "local",
        targetBucket:
          targetConfig?.driver === "s3" ? targetConfig.bucket : undefined,
        skipsCurrentTarget: Boolean(targetFilter),
        includeMigrated,
        scannedChunks: chunks.length,
        readableChunks: readable,
        migratedChunks: migrated,
        missingChunks: missing,
        sizeMismatches,
        checksumMismatches,
        hasMore,
        errors: errors.slice(0, 20),
      },
      null,
      2,
    )}\n`,
  );
  if (failed) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(
      error instanceof Error
        ? error.message
        : "Audio storage migration failed.",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
