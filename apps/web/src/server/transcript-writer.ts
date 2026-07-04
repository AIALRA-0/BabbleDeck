import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { eventTypeFromApi, serializeEvent } from "./serializers";

export async function appendTranscriptEvents(input: {
  sessionId: string;
  actorUserId?: string | null;
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
