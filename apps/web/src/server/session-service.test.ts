import { afterEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const prisma = {
    $transaction: vi.fn(
      async (callback: (tx: typeof prisma) => Promise<unknown>) =>
        callback(prisma),
    ),
    transcriptSegment: {
      findFirst: vi.fn(),
      update: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    translation: {
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    transcriptEvent: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  };
  return {
    auditLog: vi.fn(),
    prisma,
  };
});

vi.mock("@/server/db", () => ({ prisma: mocks.prisma }));
vi.mock("@/server/audit", () => ({ auditLog: mocks.auditLog }));

import { updateTranscriptSegment } from "@/server/session-service";

afterEach(() => {
  vi.clearAllMocks();
});

function segment(overrides?: Record<string, unknown>) {
  return {
    id: "segment-1",
    sessionId: "session-1",
    segmentIndex: 0,
    sourceLanguage: "en",
    originalText: "Original text",
    finalOriginalText: "Original text",
    startMs: 100,
    endMs: 900,
    createdAt: new Date("2026-07-04T12:00:00.000Z"),
    editedAt: null,
    session: {
      id: "session-1",
      providerName: "MOCK",
      targetLanguage: "zh",
      qualityMode: "realtime",
    },
    translations: [
      {
        id: "translation-1",
        targetLanguage: "zh",
        qualityMode: "realtime",
        translationText: "原始字幕",
      },
    ],
    ...overrides,
  };
}

describe("session service transcript edits", () => {
  test("updates a segment with correction event and audit log", async () => {
    const existing = segment();
    const updated = segment({
      finalOriginalText: "Corrected original",
      editedAt: new Date("2026-07-04T12:05:00.000Z"),
      translations: [
        {
          id: "translation-1",
          targetLanguage: "zh",
          qualityMode: "realtime",
          translationText: "修正字幕",
        },
      ],
    });
    mocks.prisma.transcriptSegment.findFirst.mockResolvedValue(existing);
    mocks.prisma.transcriptSegment.update.mockResolvedValue(updated);
    mocks.prisma.transcriptSegment.findUniqueOrThrow.mockResolvedValue(updated);
    mocks.prisma.transcriptEvent.findFirst.mockResolvedValue({ sequenceNo: 7 });

    const result = await updateTranscriptSegment({
      sessionId: "session-1",
      segmentId: "segment-1",
      actorUserId: "user-1",
      originalText: "Corrected original",
      translationText: "修正字幕",
      ip: "127.0.0.1",
      userAgent: "vitest",
    });

    expect(result).toMatchObject({
      id: "segment-1",
      originalText: "Corrected original",
      translationText: "修正字幕",
    });
    expect(mocks.prisma.transcriptSegment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "segment-1" },
        data: expect.objectContaining({
          finalOriginalText: "Corrected original",
          editedByUserId: "user-1",
        }),
      }),
    );
    expect(mocks.prisma.translation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          translationText: "修正字幕",
          editedByUserId: "user-1",
        }),
      }),
    );
    expect(mocks.prisma.transcriptEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "SEGMENT_CORRECTED",
          sequenceNo: 8,
          segmentId: "segment-1",
          payload: expect.objectContaining({
            previousOriginalText: "Original text",
            nextOriginalText: "Corrected original",
            previousTranslationText: "原始字幕",
            nextTranslationText: "修正字幕",
          }),
        }),
      }),
    );
    expect(mocks.auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "transcript.segment_updated",
        entityType: "transcript_segment",
        entityId: "segment-1",
      }),
    );
  });
});
