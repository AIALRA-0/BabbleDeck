import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export const AUDIO_CHUNK_MAX_BYTES = 25 * 1024 * 1024;

type StorageDriver = "local" | "s3";

type UploadAudioChunkInput = {
  sessionId: string;
  chunkIndex: number;
  body: Buffer;
  mimeType: string;
  checksumSha256: string;
};

type UploadAudioChunkResult = {
  objectKey: string;
  driver: StorageDriver;
  bucket?: string;
};

type LocalStorageConfig = {
  driver: "local";
  rootDir: string;
};

type S3StorageConfig = {
  driver: "s3";
  bucket: string;
  endpoint?: string;
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  forcePathStyle: boolean;
};

type AudioStorageConfig = LocalStorageConfig | S3StorageConfig;

const S3_DRIVERS = new Set(["s3", "r2"]);

function objectExtension(mimeType: string) {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes("ogg")) return "ogg";
  if (normalized.includes("mp4") || normalized.includes("m4a")) return "m4a";
  if (normalized.includes("wav")) return "wav";
  if (normalized.includes("mpeg") || normalized.includes("mp3")) return "mp3";
  if (normalized.includes("webm")) return "webm";
  return "bin";
}

function objectKeyFor(
  input: Pick<UploadAudioChunkInput, "sessionId" | "chunkIndex" | "mimeType">,
) {
  const paddedIndex = input.chunkIndex.toString().padStart(6, "0");
  return `sessions/${input.sessionId}/audio/chunk-${paddedIndex}.${objectExtension(input.mimeType)}`;
}

function requireEnv(value: string | undefined, message: string) {
  if (!value) throw new Error(message);
  return value;
}

function boolEnv(value: string | undefined, fallback: boolean) {
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function defaultLocalStorageDir() {
  return path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    "storage",
    "babbledeck",
  );
}

export function sha256Hex(body: Buffer) {
  return crypto.createHash("sha256").update(body).digest("hex");
}

export function resolveAudioStorageConfig(): AudioStorageConfig {
  const driverSetting = process.env.AUDIO_STORAGE_DRIVER?.toLowerCase();
  const hasS3Config =
    Boolean(process.env.AUDIO_STORAGE_BUCKET) ||
    Boolean(process.env.R2_BUCKET) ||
    Boolean(process.env.S3_BUCKET);
  const driver =
    driverSetting && S3_DRIVERS.has(driverSetting)
      ? "s3"
      : driverSetting === "local"
        ? "local"
        : hasS3Config
          ? "s3"
          : "local";

  if (driver === "local") {
    return {
      driver,
      rootDir: path.resolve(
        /*turbopackIgnore: true*/ process.env.AUDIO_STORAGE_DIR ??
          defaultLocalStorageDir(),
      ),
    };
  }

  return {
    driver,
    bucket: requireEnv(
      process.env.AUDIO_STORAGE_BUCKET ??
        process.env.R2_BUCKET ??
        process.env.S3_BUCKET,
      "AUDIO_STORAGE_BUCKET, R2_BUCKET, or S3_BUCKET must be set for S3 audio storage.",
    ),
    endpoint:
      process.env.AUDIO_STORAGE_ENDPOINT ??
      process.env.R2_ENDPOINT ??
      process.env.S3_ENDPOINT,
    region:
      process.env.AUDIO_STORAGE_REGION ??
      process.env.AWS_REGION ??
      (process.env.R2_BUCKET ? "auto" : "us-east-1"),
    accessKeyId:
      process.env.AUDIO_STORAGE_ACCESS_KEY_ID ??
      process.env.R2_ACCESS_KEY_ID ??
      process.env.S3_ACCESS_KEY_ID ??
      process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey:
      process.env.AUDIO_STORAGE_SECRET_ACCESS_KEY ??
      process.env.R2_SECRET_ACCESS_KEY ??
      process.env.S3_SECRET_ACCESS_KEY ??
      process.env.AWS_SECRET_ACCESS_KEY,
    forcePathStyle: boolEnv(
      process.env.AUDIO_STORAGE_FORCE_PATH_STYLE,
      Boolean(
        process.env.AUDIO_STORAGE_ENDPOINT ??
        process.env.R2_ENDPOINT ??
        process.env.S3_ENDPOINT,
      ),
    ),
  };
}

async function writeLocalObject(
  config: LocalStorageConfig,
  objectKey: string,
  body: Buffer,
) {
  const rootDir = path.resolve(/*turbopackIgnore: true*/ config.rootDir);
  const fullPath = path.resolve(/*turbopackIgnore: true*/ rootDir, objectKey);
  const relativePath = path.relative(rootDir, fullPath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("Resolved audio object path escaped the storage root.");
  }
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, body);
}

async function writeS3Object(
  config: S3StorageConfig,
  objectKey: string,
  input: UploadAudioChunkInput,
) {
  if (config.endpoint && (!config.accessKeyId || !config.secretAccessKey)) {
    throw new Error(
      "S3-compatible audio storage requires explicit access keys.",
    );
  }
  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials:
      config.accessKeyId && config.secretAccessKey
        ? {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          }
        : undefined,
  });

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: objectKey,
      Body: input.body,
      ContentType: input.mimeType,
      Metadata: {
        "checksum-sha256": input.checksumSha256,
        "session-id": input.sessionId,
        "chunk-index": String(input.chunkIndex),
      },
    }),
  );
}

export async function uploadAudioChunk(
  input: UploadAudioChunkInput,
): Promise<UploadAudioChunkResult> {
  const config = resolveAudioStorageConfig();
  const objectKey = objectKeyFor(input);

  if (config.driver === "local") {
    await writeLocalObject(config, objectKey, input.body);
    return { objectKey, driver: "local" };
  }

  await writeS3Object(config, objectKey, input);
  return { objectKey, driver: "s3", bucket: config.bucket };
}
