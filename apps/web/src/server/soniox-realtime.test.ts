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
});
