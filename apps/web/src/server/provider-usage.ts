import { Prisma, type ProviderName } from "@prisma/client";

type RecordAudioUsageInput = {
  sessionId: string;
  providerName: ProviderName;
  qualityMode: string;
  audioMs: number;
  targetLanguage?: string | null;
  usageType?: string;
  payload?: Prisma.InputJsonValue;
};

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

  if (!estimatedCostUsd.isZero()) {
    await tx.liveSession.update({
      where: { id: input.sessionId },
      data: {
        estimatedCostUsd: {
          increment: estimatedCostUsd,
        },
      },
    });
  }

  return usage;
}
