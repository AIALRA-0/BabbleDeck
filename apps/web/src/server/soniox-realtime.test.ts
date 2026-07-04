import { afterEach, describe, expect, test } from "vitest";
import {
  buildSonioxConfig,
  createSonioxMappingState,
  sonioxResponseToTranscriptEvents,
} from "@/server/soniox-realtime";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("soniox realtime adapter", () => {
  test("builds a v5 realtime translation config", () => {
    const config = buildSonioxConfig({
      apiKey: "test-key",
      sessionId: "session-1",
      targetLanguage: "zh",
      sourceLanguageMode: "auto",
    });

    expect(config).toMatchObject({
      api_key: "test-key",
      model: "stt-rt-v5",
      audio_format: "auto",
      enable_language_identification: true,
      client_reference_id: "session-1",
      translation: {
        type: "one_way",
        target_language: "zh",
      },
    });
  });

  test("maps original and translation tokens to transcript events", () => {
    const state = createSonioxMappingState();
    const events = sonioxResponseToTranscriptEvents({
      targetLanguage: "zh",
      state,
      response: {
        tokens: [
          {
            text: "Hello",
            start_ms: 0,
            end_ms: 400,
            confidence: 0.9,
            is_final: true,
            language: "en",
            translation_status: "original",
          },
          {
            text: "你好",
            confidence: 0.95,
            is_final: true,
            source_language: "en",
            translation_status: "translation",
          },
        ],
        total_audio_proc_ms: 500,
      },
    });

    expect(events).toEqual([
      expect.objectContaining({
        type: "final_transcript",
        text: "Hello",
        language: "en",
        targetLanguage: "zh",
        isFinal: true,
        segmentIndex: 0,
        startMs: 0,
        endMs: 400,
      }),
      expect.objectContaining({
        type: "final_translation",
        text: "你好",
        language: "en",
        targetLanguage: "zh",
        isFinal: true,
        segmentIndex: 0,
      }),
    ]);
    expect(state.segmentIndex).toBe(1);
  });

  test("moves later original tokens to a new segment while translation is delayed", () => {
    const state = createSonioxMappingState();

    const firstOriginal = sonioxResponseToTranscriptEvents({
      targetLanguage: "zh",
      state,
      response: {
        tokens: [
          {
            text: "First sentence.",
            start_ms: 0,
            end_ms: 900,
            is_final: true,
            language: "en",
            translation_status: "original",
          },
        ],
      },
    });
    expect(firstOriginal).toEqual([
      expect.objectContaining({
        type: "final_transcript",
        segmentIndex: 0,
        text: "First sentence.",
      }),
    ]);

    const secondPartial = sonioxResponseToTranscriptEvents({
      targetLanguage: "zh",
      state,
      response: {
        tokens: [
          {
            text: "Second",
            start_ms: 1000,
            end_ms: 1300,
            is_final: false,
            language: "en",
            translation_status: "original",
          },
        ],
      },
    });
    expect(secondPartial).toEqual([
      expect.objectContaining({
        type: "partial_transcript",
        segmentIndex: 1,
        text: "Second",
      }),
    ]);

    const delayedTranslation = sonioxResponseToTranscriptEvents({
      targetLanguage: "zh",
      state,
      response: {
        tokens: [
          {
            text: "第一句。",
            is_final: true,
            source_language: "en",
            translation_status: "translation",
          },
        ],
      },
    });
    expect(delayedTranslation).toEqual([
      expect.objectContaining({
        type: "final_translation",
        segmentIndex: 0,
        text: "第一句。",
      }),
    ]);
  });

  test("queues multiple final originals until their translations arrive", () => {
    const state = createSonioxMappingState();

    sonioxResponseToTranscriptEvents({
      targetLanguage: "zh",
      state,
      response: {
        tokens: [
          {
            text: "One.",
            is_final: true,
            language: "en",
            translation_status: "original",
          },
        ],
      },
    });
    const secondOriginal = sonioxResponseToTranscriptEvents({
      targetLanguage: "zh",
      state,
      response: {
        tokens: [
          {
            text: "Two.",
            is_final: true,
            language: "en",
            translation_status: "original",
          },
        ],
      },
    });
    expect(secondOriginal).toEqual([
      expect.objectContaining({
        type: "final_transcript",
        segmentIndex: 1,
        text: "Two.",
      }),
    ]);

    const firstTranslation = sonioxResponseToTranscriptEvents({
      targetLanguage: "zh",
      state,
      response: {
        tokens: [
          {
            text: "一。",
            is_final: true,
            source_language: "en",
            translation_status: "translation",
          },
        ],
      },
    });
    const secondTranslation = sonioxResponseToTranscriptEvents({
      targetLanguage: "zh",
      state,
      response: {
        tokens: [
          {
            text: "二。",
            is_final: true,
            source_language: "en",
            translation_status: "translation",
          },
        ],
      },
    });

    expect(firstTranslation).toEqual([
      expect.objectContaining({
        type: "final_translation",
        segmentIndex: 0,
        text: "一。",
      }),
    ]);
    expect(secondTranslation).toEqual([
      expect.objectContaining({
        type: "final_translation",
        segmentIndex: 1,
        text: "二。",
      }),
    ]);
    expect(state.pendingTranslationSegmentIndexes).toEqual([]);
    expect(state.segmentIndex).toBe(2);
  });
});
