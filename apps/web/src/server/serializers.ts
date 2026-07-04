import type {
  AudioChunk,
  LiveSession,
  ProviderUsage,
  ProviderName,
  SessionStatus,
  TranscriptEvent,
  TranscriptSegment,
  Translation,
} from "@prisma/client";
import { rawAudioLegalHold } from "./settings-service";

export function apiStatus(status: SessionStatus) {
  return status.toLowerCase();
}

export function apiProvider(provider: ProviderName) {
  return provider.toLowerCase().replace("_", "_");
}

export function providerFromApi(provider: "mock" | "soniox") {
  return provider === "soniox" ? "SONIOX" : "MOCK";
}

export function eventTypeFromApi(type: string) {
  return type.toUpperCase() as
    | "PARTIAL_TRANSCRIPT"
    | "FINAL_TRANSCRIPT"
    | "PARTIAL_TRANSLATION"
    | "FINAL_TRANSLATION"
    | "LANGUAGE_DETECTED"
    | "SEGMENT_CORRECTED"
    | "PROVIDER_ERROR"
    | "USAGE";
}

export function apiEventType(type: TranscriptEvent["eventType"]) {
  return type.toLowerCase();
}

export function serializeSession(
  session: LiveSession & {
    audioChunks?: AudioChunk[];
    providerUsage?: ProviderUsage[];
    transcriptSegments?: (TranscriptSegment & {
      translations: Translation[];
    })[];
  },
  extra?: { viewerUrl?: string | null; recordUrl?: string | null },
) {
  const startedAt = session.startedAt?.toISOString() ?? null;
  const endedAt = session.endedAt?.toISOString() ?? null;
  const durationMs =
    session.startedAt && session.endedAt
      ? session.endedAt.getTime() - session.startedAt.getTime()
      : session.startedAt
        ? Date.now() - session.startedAt.getTime()
        : 0;
  const providerUsage = session.providerUsage ?? [];
  const providerAudioMs = providerUsage.reduce(
    (sum, usage) => sum + (usage.audioMs ?? 0),
    0,
  );

  return {
    id: session.id,
    title: session.title,
    description: session.description,
    status: apiStatus(session.status),
    sourceLanguageMode: session.sourceLanguageMode,
    targetLanguage: session.targetLanguage,
    providerName: apiProvider(session.providerName),
    qualityMode: session.qualityMode,
    budgetCapUsd: session.budgetCapUsd ? Number(session.budgetCapUsd) : null,
    estimatedCostUsd: Number(session.estimatedCostUsd),
    startedAt,
    endedAt,
    durationMs,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    viewerUrl: extra?.viewerUrl ?? null,
    recordUrl: extra?.recordUrl ?? `/sessions/${session.id}/record`,
    backup: {
      uploadedChunks:
        session.audioChunks?.filter((chunk) => chunk.status === "UPLOADED")
          .length ?? 0,
    },
    usage: {
      audioMs: providerAudioMs,
      eventCount: providerUsage.length,
    },
    transcriptSegmentCount: session.transcriptSegments?.length ?? 0,
    rawAudioLegalHold: rawAudioLegalHold(session.metadata),
  };
}

export function serializeEvent(event: TranscriptEvent) {
  return {
    id: event.id,
    sessionId: event.sessionId,
    type: apiEventType(event.eventType),
    sequenceNo: event.sequenceNo,
    segmentId: event.segmentId,
    text: event.text,
    language: event.language,
    targetLanguage: event.targetLanguage,
    confidence: event.confidence ? Number(event.confidence) : null,
    startMs: event.startMs,
    endMs: event.endMs,
    isFinal: event.isFinal,
    createdAt: event.createdAt.toISOString(),
  };
}

export function serializeSegment(
  segment: TranscriptSegment & { translations: Translation[] },
) {
  const translation = segment.translations[0] ?? null;
  return {
    id: segment.id,
    index: segment.segmentIndex,
    startMs: segment.startMs,
    endMs: segment.endMs,
    sourceLanguage: segment.sourceLanguage,
    originalText: segment.finalOriginalText ?? segment.originalText,
    translationText: translation?.translationText ?? null,
    targetLanguage: translation?.targetLanguage ?? null,
    createdAt: segment.createdAt.toISOString(),
  };
}
