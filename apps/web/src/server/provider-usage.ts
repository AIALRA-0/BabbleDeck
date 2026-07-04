import { Prisma, type ProviderName, type SessionStatus } from "@prisma/client";

type RecordAudioUsageInput = {
  sessionId: string;
  actorUserId?: string | null;
  providerName: ProviderName;
  qualityMode: string;
  audioMs: number;
  targetLanguage?: string | null;
  usageType?: string;
  payload?: Prisma.InputJsonValue;
};

const BUDGET_DEGRADABLE_STATUSES: SessionStatus[] = [
  "CREATED",
  "READY",
  "RECORDING",
  "RECONNECTING",
  "STOPPING",
];

function numberEnv(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function providerAudioHourRateUsd(
  providerName: ProviderName,
  qualityMode: string,
) {
  const providerKey = providerName.toUpperCase();
  const qualityKey = qualityMode.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  const fallback = providerName === "MOCK" ? 0 : 0.35;
  return numberEnv(
    `PROVIDER_COST_${providerKey}_${qualityKey}_AUDIO_HOUR_USD`,
    numberEnv(`PROVIDER_COST_${providerKey}_AUDIO_HOUR_USD`, fallback),
  );
}

export function estimateAudioCostUsd(input: {
  providerName: ProviderName;
  qualityMode: string;
  audioMs: number;
}) {
  const audioMs = Math.max(0, input.audioMs);
  const rate = providerAudioHourRateUsd(input.providerName, input.qualityMode);
  return new Prisma.Decimal(rate).mul(audioMs).div(3_600_000);
}

export function shouldDegradeForBudgetCap(input: {
  budgetCapUsd: Prisma.Decimal | null;
  estimatedCostUsd: Prisma.Decimal;
  status: SessionStatus;
}) {
  return Boolean(
    input.budgetCapUsd &&
    input.estimatedCostUsd.greaterThanOrEqualTo(input.budgetCapUsd) &&
    BUDGET_DEGRADABLE_STATUSES.includes(input.status),
  );
}

export async function recordProviderAudioUsage(
  tx: Prisma.TransactionClient,
  input: RecordAudioUsageInput,
) {
  const audioMs = Math.max(0, Math.round(input.audioMs));
  if (audioMs <= 0) return null;

  const estimatedCostUsd = estimateAudioCostUsd({
    providerName: input.providerName,
    qualityMode: input.qualityMode,
    audioMs,
  });

  const usage = await tx.providerUsage.create({
    data: {
      sessionId: input.sessionId,
      providerName: input.providerName,
      usageType: input.usageType ?? "audio_chunk",
      audioMs,
      targetLanguage: input.targetLanguage ?? null,
      estimatedCostUsd,
      payload: input.payload ?? {},
    },
  });

  let updatedSession: {
    status: SessionStatus;
    targetLanguage: string;
    budgetCapUsd: Prisma.Decimal | null;
    estimatedCostUsd: Prisma.Decimal;
  } | null = null;

  if (!estimatedCostUsd.isZero()) {
    updatedSession = await tx.liveSession.update({
      where: { id: input.sessionId },
      data: {
        estimatedCostUsd: {
          increment: estimatedCostUsd,
        },
      },
      select: {
        status: true,
        targetLanguage: true,
        budgetCapUsd: true,
        estimatedCostUsd: true,
      },
    });
  }

  let budgetExceeded = false;
  if (
    updatedSession &&
    shouldDegradeForBudgetCap({
      budgetCapUsd: updatedSession.budgetCapUsd,
      estimatedCostUsd: updatedSession.estimatedCostUsd,
      status: updatedSession.status,
    })
  ) {
    const degraded = await tx.liveSession.updateMany({
      where: {
        id: input.sessionId,
        status: { in: BUDGET_DEGRADABLE_STATUSES },
      },
      data: { status: "PROVIDER_DEGRADED" },
    });

    if (degraded.count > 0) {
      const maxEvent = await tx.transcriptEvent.findFirst({
        where: { sessionId: input.sessionId },
        orderBy: { sequenceNo: "desc" },
        select: { sequenceNo: true },
      });
      const payload = {
        code: "BUDGET_CAP_REACHED",
        budgetCapUsd: updatedSession.budgetCapUsd?.toString() ?? null,
        estimatedCostUsd: updatedSession.estimatedCostUsd.toString(),
      };

      await tx.transcriptEvent.create({
        data: {
          sessionId: input.sessionId,
          providerName: input.providerName,
          eventType: "PROVIDER_ERROR",
          sequenceNo: (maxEvent?.sequenceNo ?? 0) + 1,
          targetLanguage:
            input.targetLanguage ?? updatedSession.targetLanguage ?? null,
          text: "Budget cap reached. Realtime provider degraded; local audio backup continues.",
          isFinal: true,
          payload,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: input.actorUserId ?? null,
          sessionId: input.sessionId,
          action: "session.budget_cap_reached",
          entityType: "live_session",
          entityId: input.sessionId,
          metadata: payload,
        },
      });
      budgetExceeded = true;
    }
  }

  return {
    usage,
    budgetExceeded,
    sessionStatus: budgetExceeded
      ? "PROVIDER_DEGRADED"
      : (updatedSession?.status ?? null),
    estimatedCostUsd: updatedSession?.estimatedCostUsd ?? null,
  };
}
