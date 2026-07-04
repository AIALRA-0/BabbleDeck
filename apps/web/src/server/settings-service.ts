import type { Prisma } from "@prisma/client";
import { auditLog } from "./audit";
import { resolveAudioRetentionDays } from "./audio-retention";
import { prisma } from "./db";

export const AUDIO_RETENTION_DAYS_SETTING = "audio.retentionDays";
export const RAW_AUDIO_LEGAL_HOLD_KEY = "rawAudioLegalHold";

function jsonObject(value: Prisma.JsonValue | null | undefined) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function valueNumber(value: Prisma.JsonValue | null | undefined) {
  const object = jsonObject(value);
  const days = object.days;
  return typeof days === "number" || typeof days === "string"
    ? Number(days)
    : undefined;
}

export async function getAudioRetentionDaysSetting() {
  const setting = await prisma.appSetting.findUnique({
    where: { key: AUDIO_RETENTION_DAYS_SETTING },
  });
  return resolveAudioRetentionDays(
    valueNumber(setting?.value) ??
      process.env.BABBLEDECK_AUDIO_RETENTION_DAYS ??
      process.env.AUDIO_RETENTION_DAYS,
  );
}

export async function setAudioRetentionDaysSetting(input: {
  days: number;
  actorUserId: string;
  userAgent?: string | null;
}) {
  const days = resolveAudioRetentionDays(input.days);
  const setting = await prisma.appSetting.upsert({
    where: { key: AUDIO_RETENTION_DAYS_SETTING },
    update: {
      value: { days },
      updatedByUserId: input.actorUserId,
    },
    create: {
      key: AUDIO_RETENTION_DAYS_SETTING,
      value: { days },
      updatedByUserId: input.actorUserId,
    },
  });
  await auditLog({
    actorUserId: input.actorUserId,
    action: "settings.audio_retention_updated",
    entityType: "app_setting",
    entityId: setting.key,
    userAgent: input.userAgent,
    metadata: { days },
  });
  return days;
}

export function rawAudioLegalHold(metadata: Prisma.JsonValue) {
  return jsonObject(metadata)[RAW_AUDIO_LEGAL_HOLD_KEY] === true;
}

export function legalHoldMetadata(
  metadata: Prisma.JsonValue,
  enabled: boolean,
  actorUserId: string,
) {
  return {
    ...jsonObject(metadata),
    [RAW_AUDIO_LEGAL_HOLD_KEY]: enabled,
    rawAudioLegalHoldUpdatedAt: new Date().toISOString(),
    rawAudioLegalHoldUpdatedByUserId: actorUserId,
  };
}

export async function setSessionRawAudioLegalHold(input: {
  sessionId: string;
  ownerUserId: string;
  enabled: boolean;
  actorUserId: string;
  userAgent?: string | null;
}) {
  const session = await prisma.liveSession.findFirst({
    where: {
      id: input.sessionId,
      ownerUserId: input.ownerUserId,
      archivedAt: null,
    },
    select: { id: true, metadata: true },
  });
  if (!session) return null;

  const updated = await prisma.liveSession.update({
    where: { id: session.id },
    data: {
      metadata: legalHoldMetadata(
        session.metadata,
        input.enabled,
        input.actorUserId,
      ),
    },
  });
  await auditLog({
    actorUserId: input.actorUserId,
    sessionId: input.sessionId,
    action: input.enabled
      ? "session.raw_audio_legal_hold_enabled"
      : "session.raw_audio_legal_hold_disabled",
    entityType: "live_session",
    entityId: input.sessionId,
    userAgent: input.userAgent,
    metadata: { rawAudioLegalHold: input.enabled },
  });
  return updated;
}
