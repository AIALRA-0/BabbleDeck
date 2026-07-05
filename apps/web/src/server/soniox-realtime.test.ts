import { afterEach, describe, expect, test, vi } from "vitest";

type MockSonioxSocket = {
  readyState: number;
  sent: unknown[];
  open: () => void;
  close: () => void;
  terminate: () => void;
  emit: (event: string, ...args: unknown[]) => void;
  on: (
    event: string,
    listener: (...args: unknown[]) => void,
  ) => MockSonioxSocket;
  once: (
    event: string,
    listener: (...args: unknown[]) => void,
  ) => MockSonioxSocket;
};

const sonioxSocketMock = vi.hoisted(() => ({
  sockets: [] as MockSonioxSocket[],
}));

vi.mock("ws", () => {
  class MockWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    readyState = MockWebSocket.CONNECTING;
    sent: unknown[] = [];
    private listeners = new Map<string, Set<(...args: unknown[]) => void>>();

    constructor(readonly url: string) {
      sonioxSocketMock.sockets.push(this as unknown as MockSonioxSocket);
    }

    on(event: string, listener: (...args: unknown[]) => void) {
      const listeners = this.listeners.get(event) ?? new Set();
      listeners.add(listener);
      this.listeners.set(event, listeners);
      return this;
    }

    once(event: string, listener: (...args: unknown[]) => void) {
      const wrapped = (...args: unknown[]) => {
        this.listeners.get(event)?.delete(wrapped);
        listener(...args);
      };
      return this.on(event, wrapped);
    }

    emit(event: string, ...args: unknown[]) {
      for (const listener of [...(this.listeners.get(event) ?? [])]) {
        listener(...args);
      }
    }

    send(value: unknown) {
      this.sent.push(value);
    }

    close() {
      this.readyState = MockWebSocket.CLOSED;
      this.emit("close");
    }

    terminate() {
      this.close();
    }

    open() {
      this.readyState = MockWebSocket.OPEN;
      this.emit("open");
    }
  }

  return { WebSocket: MockWebSocket };
});

import {
  buildSonioxConfig,
  buildSonioxReadinessProbeAudio,
  checkSonioxRealtimeConnectivity,
  createSonioxMappingState,
  SonioxRealtimeBridge,
  sonioxResponseToTranscriptEvents,
} from "@/server/soniox-realtime";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  sonioxSocketMock.sockets.length = 0;
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

  test("builds a small wav silence probe for readiness checks", () => {
    const probe = buildSonioxReadinessProbeAudio(300, 16_000);

    expect(probe.toString("ascii", 0, 4)).toBe("RIFF");
    expect(probe.toString("ascii", 8, 12)).toBe("WAVE");
    expect(probe.toString("ascii", 36, 40)).toBe("data");
    expect(probe.readUInt32LE(24)).toBe(16_000);
    expect(probe.readUInt16LE(34)).toBe(16);
    expect(probe.length).toBe(44 + 4_800 * 2);
  });

  test("reports missing api key before opening readiness websocket", async () => {
    delete process.env.SONIOX_API_KEY;

    await expect(
      checkSonioxRealtimeConnectivity({ timeoutMs: 10 }),
    ).resolves.toEqual({
      ok: false,
      message: "SONIOX_API_KEY is missing.",
    });
  });

  test("sends queued audio before ending when recorder closes while connecting", async () => {
    process.env.SONIOX_API_KEY = "test-key";

    const bridge = new SonioxRealtimeBridge({
      sessionId: "session-1",
      targetLanguage: "zh",
      sourceLanguageMode: "auto",
    });
    const started = bridge.start();
    const socket = sonioxSocketMock.sockets.at(-1);
    expect(socket).toBeTruthy();

    const audio = Buffer.from("first audio chunk");
    const sent = bridge.sendAudio(audio);
    bridge.close();
    socket?.open();
    await started;
    await sent;

    await vi.waitFor(() => {
      expect(socket?.sent).toHaveLength(3);
    });
    expect(JSON.parse(String(socket?.sent[0]))).toMatchObject({
      api_key: "test-key",
      client_reference_id: "session-1",
    });
    expect(socket?.sent[1]).toBe(audio);
    expect(socket?.sent[2]).toBe("");
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
