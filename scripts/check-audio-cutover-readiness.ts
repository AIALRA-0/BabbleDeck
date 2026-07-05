import fs from "node:fs/promises";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { prisma } from "../apps/web/src/server/db";

type Presence = {
  configured: boolean;
  selected?: string;
  accepted: string[];
};

type AudioChunkTargetRow = {
  uploaded: bigint;
  totalBytes: bigint | null;
  currentTargetMatching: bigint;
};

function argValue(name: string) {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

function boolFlag(name: string) {
  return process.argv.includes(name);
}

function firstConfigured(names: string[]) {
  return names.find((name) => {
    const value = process.env[name];
    return value != null && value.trim() !== "";
  });
}

function presence(names: string[]): Presence {
  const selected = firstConfigured(names);
  return {
    configured: Boolean(selected),
    selected,
    accepted: names,
  };
}

function driverSetting() {
  return (process.env.AUDIO_STORAGE_DRIVER ?? "local").trim().toLowerCase();
}

function sourceDir() {
  return (
    argValue("--source-dir") ??
    process.env.SOURCE_AUDIO_STORAGE_DIR ??
    process.env.BABBLEDECK_AUDIO_SOURCE_DIR ??
    "/srv/aialra/storage/babbledeck"
  );
}

async function directoryExists(dir: string) {
  try {
    const stat = await fs.stat(dir);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function countFiles(dir: string) {
  let count = 0;
  async function walk(current: string) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
      } else if (entry.isFile()) {
        count += 1;
      }
    }
  }
  await walk(dir);
  return count;
}

function targetEnvStatus() {
  const driver = driverSetting();
  const bucket = presence(["AUDIO_STORAGE_BUCKET", "R2_BUCKET", "S3_BUCKET"]);
  const endpoint = presence([
    "AUDIO_STORAGE_ENDPOINT",
    "R2_ENDPOINT",
    "R2_ACCOUNT_ID",
    "S3_ENDPOINT",
  ]);
  const accessKey = presence([
    "AUDIO_STORAGE_ACCESS_KEY_ID",
    "R2_ACCESS_KEY_ID",
    "S3_ACCESS_KEY_ID",
    "AWS_ACCESS_KEY_ID",
  ]);
  const secretKey = presence([
    "AUDIO_STORAGE_SECRET_ACCESS_KEY",
    "R2_SECRET_ACCESS_KEY",
    "S3_SECRET_ACCESS_KEY",
    "AWS_SECRET_ACCESS_KEY",
  ]);
  const requiresEndpoint =
    driver === "r2" ||
    Boolean(process.env.R2_BUCKET) ||
    Boolean(process.env.R2_ENDPOINT) ||
    Boolean(process.env.R2_ACCOUNT_ID) ||
    Boolean(process.env.AUDIO_STORAGE_ENDPOINT) ||
    Boolean(process.env.S3_ENDPOINT);
  const missing = [
    driver === "r2" || driver === "s3"
      ? undefined
      : "AUDIO_STORAGE_DRIVER=r2|s3",
    bucket.configured ? undefined : bucket.accepted.join("/"),
    requiresEndpoint && !endpoint.configured
      ? endpoint.accepted.join("/")
      : undefined,
    accessKey.configured ? undefined : accessKey.accepted.join("/"),
    secretKey.configured ? undefined : secretKey.accepted.join("/"),
  ].filter((item): item is string => Boolean(item));

  return {
    driver,
    bucket,
    endpoint: {
      ...endpoint,
      required: requiresEndpoint,
    },
    accessKey,
    secretKey,
    missing,
    configured: missing.length === 0,
  };
}

async function audioChunkTargetStatus(bucket: string) {
  const rows = await prisma.$queryRaw<AudioChunkTargetRow[]>(Prisma.sql`
    select
      count(*)::bigint as uploaded,
      coalesce(sum("byteSize"), 0)::bigint as "totalBytes",
      count(*) filter (
        where metadata->>'storageDriver' = 's3'
          and coalesce(metadata->>'storageBucket', '') = ${bucket}
      )::bigint as "currentTargetMatching"
    from audio_chunks
    where status = 'UPLOADED'
  `);
  const row = rows[0];
  const uploaded = Number(row?.uploaded ?? 0n);
  const currentTargetMatching = Number(row?.currentTargetMatching ?? 0n);

  return {
    uploadedChunks: uploaded,
    uploadedBytes: (row?.totalBytes ?? 0n).toString(),
    currentTargetMatchingChunks: currentTargetMatching,
    currentTargetMissingChunks: Math.max(0, uploaded - currentTargetMatching),
  };
}

async function main() {
  const strict = boolFlag("--strict");
  const checkedAt = new Date().toISOString();
  const target = targetEnvStatus();
  const dir = sourceDir();
  const sourceDirExists = await directoryExists(dir);
  const sourceFiles = sourceDirExists ? await countFiles(dir) : 0;
  const bucketName =
    process.env.AUDIO_STORAGE_BUCKET ??
    process.env.R2_BUCKET ??
    process.env.S3_BUCKET ??
    "";
  const database = await audioChunkTargetStatus(bucketName);
  const cutoverReady =
    target.configured &&
    sourceDirExists &&
    database.currentTargetMissingChunks === 0;
  const result = {
    app: "babbledeck",
    checkedAt,
    cutoverReady,
    strict,
    source: {
      dir,
      exists: sourceDirExists,
      fileCount: sourceFiles,
    },
    target,
    database,
    nextCommands: target.configured
      ? [
          "pnpm audio:preflight:production",
          "pnpm audio:cutover:production",
          "BABBLEDECK_AUDIO_CUTOVER_APPLY=1 pnpm audio:cutover:production",
          "BABBLEDECK_DEPLOY_STRICT=1 pnpm deploy:production",
        ]
      : [
          "export BABBLEDECK_AUDIO_STORAGE_DRIVER=r2",
          "export R2_ACCOUNT_ID=...",
          "export R2_BUCKET=babbledeck-prod",
          "export R2_ACCESS_KEY_ID=...",
          "export R2_SECRET_ACCESS_KEY=...",
          "pnpm audio:configure:production",
        ],
  };

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (strict && !cutoverReady) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(
      error instanceof Error
        ? error.message
        : "Audio cutover readiness check failed.",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
