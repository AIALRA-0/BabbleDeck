import { Prisma } from "@prisma/client";
import { auditLog } from "./audit";
import { resolveAudioRetentionDays } from "./audio-retention";
import { prisma } from "./db";

export const AUDIO_RETENTION_DAYS_SETTING = "audio.retentionDays";
export const DEFAULT_TARGET_LANGUAGE_SETTING = "session.defaultTargetLanguage";
export const DEFAULT_BUDGET_CAP_USD_SETTING = "session.defaultBudgetCapUsd";
export const RAW_AUDIO_LEGAL_HOLD_KEY = "rawAudioLegalHold";

export type DefaultSessionSettings = {
  targetLanguage: string;
  providerName: "mock" | "soniox";
  budgetCapUsd: number;
};

export type SerializedGlossaryTerm = {
  id: string;
  sourceTerm: string;
  targetTerm: string;
  sourceLanguage: string | null;
  targetLanguage: string;
  notes: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SerializedAuditLog = {
  id: string;
  actorEmail: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  sessionTitle: string | null;
  createdAt: string;
};

function jsonObject(value: Prisma.JsonValue | null | undefined) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function valueNumber(value: Prisma.JsonValue | null | undefined, key: string) {
  const object = jsonObject(value);
  const raw = object[key];
  return typeof raw === "number" || typeof raw === "string"
    ? Number(raw)
    : undefined;
}

function valueString(value: Prisma.JsonValue | null | undefined, key: string) {
  const object = jsonObject(value);
  const raw = object[key];
  return typeof raw === "string" ? raw : undefined;
}

function resolveDefaultTargetLanguage(input?: string | null) {
  return (
    input?.trim() || process.env.SONIOX_DEFAULT_TARGET_LANGUAGE?.trim() || "zh"
  );
}

function resolveDefaultBudgetCapUsd(input?: number | string | null) {
  const value = Number(input ?? process.env.DEFAULT_SESSION_BUDGET_CAP_USD);
  if (!Number.isFinite(value) || value <= 0) return 1.5;
  return Math.min(value, 100);
}

function defaultProviderName(): "mock" | "soniox" {
  return process.env.SONIOX_API_KEY ? "soniox" : "mock";
}

export async function getAudioRetentionDaysSetting() {
  const setting = await prisma.appSetting.findUnique({
    where: { key: AUDIO_RETENTION_DAYS_SETTING },
  });
  return resolveAudioRetentionDays(
    valueNumber(setting?.value, "days") ??
      process.env.BABBLEDECK_AUDIO_RETENTION_DAYS ??
      process.env.AUDIO_RETENTION_DAYS,
  );
}

export async function getDefaultSessionSettings(): Promise<DefaultSessionSettings> {
  const settings = await prisma.appSetting.findMany({
    where: {
      key: {
        in: [DEFAULT_TARGET_LANGUAGE_SETTING, DEFAULT_BUDGET_CAP_USD_SETTING],
      },
    },
  });
  const byKey = new Map(settings.map((setting) => [setting.key, setting]));
  return {
    targetLanguage: resolveDefaultTargetLanguage(
      valueString(
        byKey.get(DEFAULT_TARGET_LANGUAGE_SETTING)?.value,
        "language",
      ),
    ),
    providerName: defaultProviderName(),
    budgetCapUsd: resolveDefaultBudgetCapUsd(
      valueNumber(byKey.get(DEFAULT_BUDGET_CAP_USD_SETTING)?.value, "amount"),
    ),
  };
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

export async function setDefaultSessionSettings(input: {
  targetLanguage?: string;
  budgetCapUsd?: number;
  actorUserId: string;
  userAgent?: string | null;
}) {
  const updates: Record<string, unknown> = {};

  if (input.targetLanguage !== undefined) {
    const language = resolveDefaultTargetLanguage(input.targetLanguage);
    await prisma.appSetting.upsert({
      where: { key: DEFAULT_TARGET_LANGUAGE_SETTING },
      update: {
        value: { language },
        updatedByUserId: input.actorUserId,
      },
      create: {
        key: DEFAULT_TARGET_LANGUAGE_SETTING,
        value: { language },
        updatedByUserId: input.actorUserId,
      },
    });
    updates.targetLanguage = language;
  }

  if (input.budgetCapUsd !== undefined) {
    const amount = resolveDefaultBudgetCapUsd(input.budgetCapUsd);
    await prisma.appSetting.upsert({
      where: { key: DEFAULT_BUDGET_CAP_USD_SETTING },
      update: {
        value: { amount },
        updatedByUserId: input.actorUserId,
      },
      create: {
        key: DEFAULT_BUDGET_CAP_USD_SETTING,
        value: { amount },
        updatedByUserId: input.actorUserId,
      },
    });
    updates.budgetCapUsd = amount;
  }

  if (Object.keys(updates).length > 0) {
    await auditLog({
      actorUserId: input.actorUserId,
      action: "settings.default_session_updated",
      entityType: "app_setting",
      entityId: "session.defaults",
      userAgent: input.userAgent,
      metadata: updates,
    });
  }

  return getDefaultSessionSettings();
}

function serializeGlossaryTerm(term: {
  id: string;
  sourceTerm: string;
  targetTerm: string;
  sourceLanguage: string | null;
  targetLanguage: string;
  notes: string | null;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}): SerializedGlossaryTerm {
  return {
    id: term.id,
    sourceTerm: term.sourceTerm,
    targetTerm: term.targetTerm,
    sourceLanguage: term.sourceLanguage,
    targetLanguage: term.targetLanguage,
    notes: term.notes,
    enabled: term.enabled,
    createdAt: term.createdAt.toISOString(),
    updatedAt: term.updatedAt.toISOString(),
  };
}

function serializeAuditLog(log: {
  id: string;
  actor: { email: string } | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  session: { title: string } | null;
  createdAt: Date;
}): SerializedAuditLog {
  return {
    id: log.id,
    actorEmail: log.actor?.email ?? null,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    sessionTitle: log.session?.title ?? null,
    createdAt: log.createdAt.toISOString(),
  };
}

function isPrismaNotFound(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  );
}

export async function listGlossaryTerms() {
  const terms = await prisma.glossaryTerm.findMany({
    orderBy: [{ enabled: "desc" }, { updatedAt: "desc" }],
    take: 50,
  });
  return terms.map(serializeGlossaryTerm);
}

export async function listAuditLogs(take = 25) {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take,
    include: {
      actor: { select: { email: true } },
      session: { select: { title: true } },
    },
  });
  return logs.map(serializeAuditLog);
}

export async function createGlossaryTerm(input: {
  sourceTerm: string;
  targetTerm: string;
  sourceLanguage?: string | null;
  targetLanguage: string;
  notes?: string | null;
  enabled: boolean;
  actorUserId: string;
  userAgent?: string | null;
}) {
  const term = await prisma.glossaryTerm.create({
    data: {
      sourceTerm: input.sourceTerm,
      targetTerm: input.targetTerm,
      sourceLanguage: input.sourceLanguage || null,
      targetLanguage: input.targetLanguage,
      notes: input.notes || null,
      enabled: input.enabled,
      createdByUserId: input.actorUserId,
    },
  });
  await auditLog({
    actorUserId: input.actorUserId,
    action: "settings.glossary_term_created",
    entityType: "glossary_term",
    entityId: term.id,
    userAgent: input.userAgent,
    metadata: {
      targetLanguage: term.targetLanguage,
      enabled: term.enabled,
    },
  });
  return serializeGlossaryTerm(term);
}

export async function updateGlossaryTerm(input: {
  id: string;
  actorUserId: string;
  userAgent?: string | null;
  sourceTerm?: string;
  targetTerm?: string;
  sourceLanguage?: string | null;
  targetLanguage?: string;
  notes?: string | null;
  enabled?: boolean;
}) {
  const data: Parameters<typeof prisma.glossaryTerm.update>[0]["data"] = {};
  if (input.sourceTerm !== undefined) data.sourceTerm = input.sourceTerm;
  if (input.targetTerm !== undefined) data.targetTerm = input.targetTerm;
  if (input.sourceLanguage !== undefined) {
    data.sourceLanguage = input.sourceLanguage || null;
  }
  if (input.targetLanguage !== undefined) {
    data.targetLanguage = input.targetLanguage;
  }
  if (input.notes !== undefined) data.notes = input.notes || null;
  if (input.enabled !== undefined) data.enabled = input.enabled;

  try {
    const term = await prisma.glossaryTerm.update({
      where: { id: input.id },
      data,
    });
    await auditLog({
      actorUserId: input.actorUserId,
      action: "settings.glossary_term_updated",
      entityType: "glossary_term",
      entityId: term.id,
      userAgent: input.userAgent,
      metadata: {
        updatedFields: Object.keys(data).sort(),
        targetLanguage: term.targetLanguage,
        enabled: term.enabled,
      },
    });
    return serializeGlossaryTerm(term);
  } catch (error) {
    if (isPrismaNotFound(error)) return null;
    throw error;
  }
}

export async function deleteGlossaryTerm(input: {
  id: string;
  actorUserId: string;
  userAgent?: string | null;
}) {
  try {
    const term = await prisma.glossaryTerm.delete({
      where: { id: input.id },
    });
    await auditLog({
      actorUserId: input.actorUserId,
      action: "settings.glossary_term_deleted",
      entityType: "glossary_term",
      entityId: term.id,
      userAgent: input.userAgent,
      metadata: {
        targetLanguage: term.targetLanguage,
        enabled: term.enabled,
      },
    });
    return serializeGlossaryTerm(term);
  } catch (error) {
    if (isPrismaNotFound(error)) return null;
    throw error;
  }
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
