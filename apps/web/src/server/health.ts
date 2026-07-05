import appPackage from "../../package.json";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { resolveAudioStorageConfig } from "@/server/audio-storage";
import { liveKitConfigured } from "@/server/livekit";

const startedAt = Date.now();

export type HealthStatus = {
  service: "babbledeck";
  status: "ok" | "degraded";
  version: string;
  generatedAt: string;
  uptimeSeconds: number;
  checks: {
    database: {
      ok: boolean;
    };
    audioStorage: {
      ok: boolean;
      driver: "local" | "s3" | "unknown";
      offHostReady: boolean;
    };
    providers: {
      soniox: {
        configured: boolean;
      };
      livekit: {
        configured: boolean;
      };
    };
  };
};

function offHostAudioStorageReady() {
  const driverSetting = process.env.AUDIO_STORAGE_DRIVER?.toLowerCase();
  if (driverSetting === "local") return false;

  const bucket = Boolean(
    process.env.AUDIO_STORAGE_BUCKET ??
    process.env.R2_BUCKET ??
    process.env.S3_BUCKET,
  );
  const endpoint = Boolean(
    process.env.AUDIO_STORAGE_ENDPOINT ??
    process.env.R2_ENDPOINT ??
    process.env.R2_ACCOUNT_ID ??
    process.env.S3_ENDPOINT,
  );
  const accessKey = Boolean(
    process.env.AUDIO_STORAGE_ACCESS_KEY_ID ??
    process.env.R2_ACCESS_KEY_ID ??
    process.env.S3_ACCESS_KEY_ID ??
    process.env.AWS_ACCESS_KEY_ID,
  );
  const secretKey = Boolean(
    process.env.AUDIO_STORAGE_SECRET_ACCESS_KEY ??
    process.env.R2_SECRET_ACCESS_KEY ??
    process.env.S3_SECRET_ACCESS_KEY ??
    process.env.AWS_SECRET_ACCESS_KEY,
  );
  const requiresEndpoint =
    driverSetting === "r2" ||
    Boolean(process.env.R2_BUCKET) ||
    Boolean(process.env.R2_ENDPOINT) ||
    Boolean(process.env.R2_ACCOUNT_ID) ||
    Boolean(process.env.AUDIO_STORAGE_ENDPOINT) ||
    Boolean(process.env.S3_ENDPOINT);

  return bucket && accessKey && secretKey && (!requiresEndpoint || endpoint);
}

function audioStorageHealth() {
  try {
    const config = resolveAudioStorageConfig();
    return {
      ok: true,
      driver: config.driver,
      offHostReady: config.driver === "s3" && offHostAudioStorageReady(),
    };
  } catch {
    return {
      ok: false,
      driver: "unknown" as const,
      offHostReady: false,
    };
  }
}

export async function getHealthStatus(options?: {
  databaseCheck?: () => Promise<boolean>;
  now?: Date;
}): Promise<HealthStatus> {
  const databaseOk = await (
    options?.databaseCheck ??
    (async () => {
      await prisma.$queryRaw(Prisma.sql`select 1`);
      return true;
    })
  )().catch(() => false);
  const audioStorage = audioStorageHealth();
  const generatedAt = options?.now ?? new Date();
  const ok = databaseOk && audioStorage.ok;

  return {
    service: "babbledeck",
    status: ok ? "ok" : "degraded",
    version: appPackage.version,
    generatedAt: generatedAt.toISOString(),
    uptimeSeconds: Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
    checks: {
      database: {
        ok: databaseOk,
      },
      audioStorage,
      providers: {
        soniox: {
          configured: Boolean(process.env.SONIOX_API_KEY),
        },
        livekit: {
          configured: liveKitConfigured(),
        },
      },
    },
  };
}
