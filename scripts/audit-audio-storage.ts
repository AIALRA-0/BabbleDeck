import { Prisma } from "@prisma/client";
import { prisma } from "../apps/web/src/server/db";
import {
  headAudioObject,
  resolveAudioStorageConfig,
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

async function main() {
  const limit = numberArg("--limit", 1000);
  const requireCurrentTarget = boolFlag("--require-current-target");
  const config = resolveAudioStorageConfig();
  const expected = expectedMetadata(config);
  const chunks = await prisma.audioChunk.findMany({
    where: { status: "UPLOADED" },
    orderBy: [{ uploadedAt: "asc" }, { id: "asc" }],
    take: limit,
  });

  let present = 0;
  let missing = 0;
  let sizeMismatches = 0;
  let targetMetadataMismatches = 0;
  const errors: {
    objectKey: string;
    code: "missing" | "size_mismatch" | "target_metadata_mismatch";
    message: string;
  }[] = [];

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
        scannedChunks: chunks.length,
        presentChunks: present,
        missingChunks: missing,
        sizeMismatches,
        targetMetadataMismatches,
        hasMore: chunks.length === limit,
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
