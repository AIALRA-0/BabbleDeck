import { Prisma } from "@prisma/client";
import { renderTranscriptExport, type ExportOptions } from "@/lib/export";
import { auditLog } from "@/server/audit";
import { prisma } from "@/server/db";
import {
  apiProvider,
  providerFromApi,
  serializeSegment,
  serializeSession,
} from "@/server/serializers";
import { hashToken, randomToken } from "@/server/security";
export { appendTranscriptEvents } from "@/server/transcript-writer";

export async function createLiveSession(input: {
  ownerUserId: string;
  title: string;
  description?: string | null;
  sourceLanguageMode: string;
  targetLanguage: string;
  providerName: "mock" | "soniox";
  qualityMode: string;
  budgetCapUsd?: number | null;
  ip?: string | null;
  userAgent?: string | null;
  origin?: string | null;
}) {
  const shareToken = randomToken(24);
  const recorderToken = randomToken(24);
  const session = await prisma.liveSession.create({
    data: {
      ownerUserId: input.ownerUserId,
      title: input.title,
      description: input.description || null,
      sourceLanguageMode: input.sourceLanguageMode,
      targetLanguage: input.targetLanguage,
      providerName: providerFromApi(input.providerName),
      qualityMode: input.qualityMode,
      budgetCapUsd: input.budgetCapUsd
        ? new Prisma.Decimal(input.budgetCapUsd)
        : null,
      shareTokenHash: hashToken(shareToken),
      recorderTokenHash: hashToken(recorderToken),
      status: "READY",
    },
  });

  await auditLog({
    actorUserId: input.ownerUserId,
    sessionId: session.id,
    action: "session.created",
    entityType: "live_session",
    entityId: session.id,
    ip: input.ip,
    userAgent: input.userAgent,
    metadata: { providerName: apiProvider(session.providerName) },
  });

  const viewerUrl = new URL(
    `/s/${shareToken}`,
    input.origin ??
      process.env.NEXT_PUBLIC_APP_URL ??
      process.env.APP_ORIGIN ??
      "http://localhost:3000",
  ).toString();
  return {
    session: serializeSession(session, {
      viewerUrl,
      recordUrl: `/sessions/${session.id}/record?share=${shareToken}&recorder=${recorderToken}`,
    }),
    shareToken,
    recorderToken,
  };
}

export async function getSessionForAdmin(id: string, ownerUserId: string) {
  return prisma.liveSession.findFirst({
    where: { id, ownerUserId, archivedAt: null },
    include: {
      audioChunks: true,
      providerUsage: true,
      transcriptSegments: {
        include: { translations: true },
        orderBy: [{ trackId: "asc" }, { segmentIndex: "asc" }],
      },
    },
  });
}

export async function getSessionForRecorderToken(
  id: string,
  recorderToken: string,
) {
  return prisma.liveSession.findFirst({
    where: {
      id,
      recorderTokenHash: hashToken(recorderToken),
      archivedAt: null,
    },
    include: {
      audioChunks: true,
      providerUsage: true,
      transcriptSegments: {
        include: { translations: true },
        orderBy: [{ trackId: "asc" }, { segmentIndex: "asc" }],
      },
    },
  });
}

export async function getSessionByShareToken(shareToken: string) {
  return prisma.liveSession.findUnique({
    where: { shareTokenHash: hashToken(shareToken) },
    include: {
      providerUsage: true,
      transcriptSegments: {
        include: { translations: true },
        orderBy: [{ trackId: "asc" }, { segmentIndex: "asc" }],
      },
    },
  });
}

export async function buildExport(input: {
  sessionId: string;
  requestedByUserId: string;
  options: ExportOptions;
}) {
  const session = await prisma.liveSession.findUnique({
    where: { id: input.sessionId },
    include: {
      transcriptSegments: {
        include: { translations: true },
        orderBy: [{ trackId: "asc" }, { segmentIndex: "asc" }],
      },
    },
  });
  if (!session) return null;

  const segments = session.transcriptSegments.map((segment) => {
    const translation = segment.translations[0] ?? null;
    return {
      index: segment.segmentIndex,
      trackId: segment.trackId,
      speakerLabel: segment.speakerLabel,
      startMs: segment.startMs,
      endMs: segment.endMs,
      originalText: segment.finalOriginalText ?? segment.originalText,
      translationText: translation?.translationText ?? null,
      targetLanguage: translation?.targetLanguage ?? null,
    };
  });
  const content = renderTranscriptExport(segments, input.options);
  const record = await prisma.exportRecord.create({
    data: {
      sessionId: input.sessionId,
      requestedByUserId: input.requestedByUserId,
      format: input.options.format.toUpperCase() as
        "MARKDOWN" | "TXT" | "JSON" | "SRT" | "VTT",
      content,
      byteSize: BigInt(Buffer.byteLength(content)),
    },
  });
  await auditLog({
    actorUserId: input.requestedByUserId,
    sessionId: input.sessionId,
    action: "session.exported",
    entityType: "export",
    entityId: record.id,
    metadata: { format: input.options.format },
  });
  return record;
}

export async function transcriptPayload(sessionId: string) {
  const segments = await prisma.transcriptSegment.findMany({
    where: { sessionId },
    include: { translations: true },
    orderBy: [{ trackId: "asc" }, { segmentIndex: "asc" }],
  });
  return { segments: segments.map(serializeSegment) };
}

export async function updateTranscriptSegment(input: {
  sessionId: string;
  segmentId: string;
  actorUserId: string;
  originalText?: string;
  translationText?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}) {
  const existing = await prisma.transcriptSegment.findFirst({
    where: {
      id: input.segmentId,
      sessionId: input.sessionId,
      session: {
        ownerUserId: input.actorUserId,
        archivedAt: null,
      },
    },
    include: {
      session: true,
      translations: true,
    },
  });
  if (!existing) return null;

  const previousOriginalText =
    existing.finalOriginalText ?? existing.originalText;
  const previousTranslationText =
    existing.translations[0]?.translationText ?? null;
  const nextOriginalText = input.originalText ?? previousOriginalText;
  const nextTranslationText =
    input.translationText === undefined
      ? previousTranslationText
      : input.translationText || null;

  const segment = await prisma.$transaction(async (tx) => {
    const updated = await tx.transcriptSegment.update({
      where: { id: existing.id },
      data: {
        finalOriginalText: nextOriginalText,
        editedByUserId: input.actorUserId,
        editedAt: new Date(),
      },
      include: { translations: true },
    });

    const currentTranslation = existing.translations[0] ?? null;
    if (input.translationText !== undefined) {
      if (nextTranslationText) {
        await tx.translation.upsert({
          where: currentTranslation
            ? {
                segmentId_targetLanguage_qualityMode: {
                  segmentId: existing.id,
                  targetLanguage: currentTranslation.targetLanguage,
                  qualityMode: currentTranslation.qualityMode,
                },
              }
            : {
                segmentId_targetLanguage_qualityMode: {
                  segmentId: existing.id,
                  targetLanguage: existing.session.targetLanguage,
                  qualityMode: existing.session.qualityMode,
                },
              },
          update: {
            translationText: nextTranslationText,
            editedByUserId: input.actorUserId,
            editedAt: new Date(),
          },
          create: {
            segmentId: existing.id,
            sessionId: existing.sessionId,
            targetLanguage: existing.session.targetLanguage,
            translationText: nextTranslationText,
            providerName: existing.session.providerName,
            qualityMode: existing.session.qualityMode,
            editedByUserId: input.actorUserId,
            editedAt: new Date(),
          },
        });
      } else if (currentTranslation) {
        await tx.translation.delete({
          where: { id: currentTranslation.id },
        });
      }
    }

    const maxEvent = await tx.transcriptEvent.findFirst({
      where: { sessionId: input.sessionId },
      orderBy: { sequenceNo: "desc" },
    });
    await tx.transcriptEvent.create({
      data: {
        sessionId: input.sessionId,
        providerName: existing.session.providerName,
        eventType: "SEGMENT_CORRECTED",
        sequenceNo: (maxEvent?.sequenceNo ?? 0) + 1,
        segmentId: existing.id,
        language: existing.sourceLanguage,
        targetLanguage:
          existing.translations[0]?.targetLanguage ??
          existing.session.targetLanguage,
        text: nextOriginalText,
        isFinal: true,
        payload: {
          segmentIndex: existing.segmentIndex,
          previousOriginalText,
          nextOriginalText,
          previousTranslationText,
          nextTranslationText,
        },
      },
    });

    return tx.transcriptSegment.findUniqueOrThrow({
      where: { id: updated.id },
      include: { translations: true },
    });
  });

  await auditLog({
    actorUserId: input.actorUserId,
    sessionId: input.sessionId,
    action: "transcript.segment_updated",
    entityType: "transcript_segment",
    entityId: input.segmentId,
    ip: input.ip,
    userAgent: input.userAgent,
    metadata: {
      segmentIndex: existing.segmentIndex,
      originalChanged: nextOriginalText !== previousOriginalText,
      translationChanged: nextTranslationText !== previousTranslationText,
    },
  });

  return serializeSegment(segment);
}
