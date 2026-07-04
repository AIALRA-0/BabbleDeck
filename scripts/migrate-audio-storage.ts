import fs from "node:fs/promises";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { prisma } from "../apps/web/src/server/db";
import {
  putAudioObject,
  resolveAudioStorageConfig,
  sha256Hex,
} from "../apps/web/src/server/audio-storage";

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

async function main() {
  const dryRun = boolFlag("--dry-run");
  const limit = numberArg("--limit", 500);
  const sourceDir = sourceAudioDir();
  const targetConfig = dryRun ? null : resolveAudioStorageConfig();
  const targetDir =
    targetConfig?.driver === "local"
      ? path.resolve(targetConfig.rootDir)
      : null;

  if (!dryRun && targetDir && targetDir === sourceDir) {
    throw new Error(
      "Refusing to migrate local audio storage onto the same source directory.",
    );
  }

  const chunks = await prisma.audioChunk.findMany({
    where: { status: "UPLOADED" },
    orderBy: [{ uploadedAt: "asc" }, { id: "asc" }],
    take: limit,
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

  process.stdout.write(
    `${JSON.stringify(
      {
        dryRun,
        sourceDir,
        targetDriver:
          targetConfig?.driver ?? process.env.AUDIO_STORAGE_DRIVER ?? "local",
        targetBucket:
          targetConfig?.driver === "s3" ? targetConfig.bucket : undefined,
        scannedChunks: chunks.length,
        readableChunks: readable,
        migratedChunks: migrated,
        missingChunks: missing,
        sizeMismatches,
        checksumMismatches,
        hasMore: chunks.length === limit,
        errors: errors.slice(0, 20),
      },
      null,
      2,
    )}\n`,
  );
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
