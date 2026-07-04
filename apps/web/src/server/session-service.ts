import { Prisma } from "@prisma/client";
import { renderTranscriptExport, type ExportOptions } from "@/lib/export";
import { auditLog } from "@/server/audit";
import { prisma } from "@/server/db";
import {
  apiProvider,
  eventTypeFromApi,
  providerFromApi,
  serializeEvent,
  serializeSegment,
  serializeSession,
} from "@/server/serializers";
import { hashToken, randomToken } from "@/server/security";

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
      transcriptSegments: {
        include: { translations: true },
        orderBy: { segmentIndex: "asc" },
      },
    },
  });
}

export async function getSessionByShareToken(shareToken: string) {
  return prisma.liveSession.findUnique({
    where: { shareTokenHash: hashToken(shareToken) },
    include: {
      transcriptSegments: {
        include: { translations: true },
        orderBy: { segmentIndex: "asc" },
      },
    },
  });
}

export async function appendTranscriptEvents(input: {
  sessionId: string;
  actorUserId: string;
  events: {
    type: string;
    text?: string;
    language?: string;
    targetLanguage?: string;
    isFinal?: boolean;
    segmentIndex?: number;
    startMs?: number;
    endMs?: number;
    confidence?: number;
  }[];
}) {
  const session = await prisma.liveSession.findUnique({
    where: { id: input.sessionId },
  });
  if (!session) return null;

  const maxEvent = await prisma.transcriptEvent.findFirst({
    where: { sessionId: input.sessionId },
    orderBy: { sequenceNo: "desc" },
  });
  let sequenceNo = maxEvent ? maxEvent.sequenceNo + 1 : 1;

  const created = [];
  for (const event of input.events) {
    const eventType = eventTypeFromApi(event.type);
    const segmentIndex = event.segmentIndex ?? Math.max(0, sequenceNo - 1);
    let segmentId: string | undefined;

    if (event.type === "final_transcript" && event.text) {
      const segment = await prisma.transcriptSegment.upsert({
        where: {
          sessionId_segmentIndex: {
            sessionId: input.sessionId,
            segmentIndex,
          },
        },
        update: {
          originalText: event.text,
          finalOriginalText: event.text,
          sourceLanguage: event.language ?? "auto",
          startMs: event.startMs,
          endMs: event.endMs,
          confidence:
            event.confidence == null
              ? undefined
              : new Prisma.Decimal(event.confidence),
        },
        create: {
          sessionId: input.sessionId,
          segmentIndex,
          sourceLanguage: event.language ?? "auto",
          originalText: event.text,
          finalOriginalText: event.text,
          startMs: event.startMs,
          endMs: event.endMs,
          confidence:
            event.confidence == null
              ? undefined
              : new Prisma.Decimal(event.confidence),
          providerName: session.providerName,
        },
      });
      segmentId = segment.id;
    }

    if (event.type === "final_translation" && event.text) {
      const segment = await prisma.transcriptSegment.upsert({
        where: {
          sessionId_segmentIndex: {
            sessionId: input.sessionId,
            segmentIndex,
          },
        },
        update: {},
        create: {
          sessionId: input.sessionId,
          segmentIndex,
          sourceLanguage: event.language ?? "auto",
          originalText: "",
          finalOriginalText: "",
          startMs: event.startMs,
          endMs: event.endMs,
          providerName: session.providerName,
        },
      });
      segmentId = segment.id;
      await prisma.translation.upsert({
        where: {
          segmentId_targetLanguage_qualityMode: {
            segmentId: segment.id,
            targetLanguage: event.targetLanguage ?? session.targetLanguage,
            qualityMode: session.qualityMode,
          },
        },
        update: {
          translationText: event.text,
        },
        create: {
          segmentId: segment.id,
          sessionId: input.sessionId,
          targetLanguage: event.targetLanguage ?? session.targetLanguage,
          translationText: event.text,
          providerName: session.providerName,
          qualityMode: session.qualityMode,
        },
      });
    }

    const row = await prisma.transcriptEvent.create({
      data: {
        sessionId: input.sessionId,
        providerName: session.providerName,
        eventType,
        sequenceNo,
        segmentId,
        language: event.language,
        targetLanguage: event.targetLanguage ?? session.targetLanguage,
        text: event.text,
        confidence:
          event.confidence == null
            ? undefined
            : new Prisma.Decimal(event.confidence),
        startMs: event.startMs,
        endMs: event.endMs,
        isFinal: event.isFinal ?? event.type.startsWith("final_"),
        payload: event,
      },
    });
    created.push(serializeEvent(row));
    sequenceNo += 1;
  }

  return created;
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
        orderBy: { segmentIndex: "asc" },
      },
    },
  });
  if (!session) return null;

  const segments = session.transcriptSegments.map((segment) => {
    const translation = segment.translations[0] ?? null;
    return {
      index: segment.segmentIndex,
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
    orderBy: { segmentIndex: "asc" },
  });
  return { segments: segments.map(serializeSegment) };
}
