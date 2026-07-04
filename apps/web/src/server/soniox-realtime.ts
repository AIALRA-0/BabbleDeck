import { WebSocket, type RawData } from "ws";
import { appendTranscriptEvents } from "./transcript-writer";
import { markProviderDegraded } from "./provider-health";

const DEFAULT_SONIOX_ENDPOINT = "wss://stt-rt.soniox.com/transcribe-websocket";
const DEFAULT_SONIOX_MODEL = "stt-rt-v5";
const SONIOX_KEEPALIVE_INTERVAL_MS = 10_000;
const SONIOX_CLOSE_GRACE_MS = 15_000;

type SonioxToken = {
  text?: string;
  start_ms?: number;
  end_ms?: number;
  confidence?: number;
  is_final?: boolean;
  language?: string;
  source_language?: string;
  translation_status?: "original" | "translation" | string;
};

export type SonioxResponse = {
  tokens?: SonioxToken[];
  final_audio_proc_ms?: number;
  total_audio_proc_ms?: number;
  finished?: boolean;
  error_code?: number;
  error_type?: string;
  error_message?: string;
  request_id?: string;
};

export type SonioxMappedEvent = {
  type: string;
  text: string;
  language?: string;
  targetLanguage?: string;
  isFinal: boolean;
  segmentIndex: number;
  startMs?: number;
  endMs?: number;
  confidence?: number;
};

export type SonioxMappingState = {
  segmentIndex: number;
  originalFinal: boolean;
  translationFinal: boolean;
};

export function createSonioxMappingState(): SonioxMappingState {
  return {
    segmentIndex: 0,
    originalFinal: false,
    translationFinal: false,
  };
}

export function sonioxApiKey() {
  return process.env.SONIOX_API_KEY?.trim() || null;
}

export function sonioxEndpoint() {
  return process.env.SONIOX_WEBSOCKET_URL ?? DEFAULT_SONIOX_ENDPOINT;
}

export function buildSonioxConfig(input: {
  apiKey: string;
  sessionId: string;
  targetLanguage: string;
  sourceLanguageMode?: string;
}) {
  return {
    api_key: input.apiKey,
    model: process.env.SONIOX_REALTIME_MODEL ?? DEFAULT_SONIOX_MODEL,
    audio_format: "auto",
    enable_language_identification: input.sourceLanguageMode === "auto",
    enable_endpoint_detection: true,
    max_endpoint_delay_ms: 500,
    client_reference_id: input.sessionId,
    translation: {
      type: "one_way",
      target_language: input.targetLanguage,
    },
  };
}

function groupText(tokens: SonioxToken[]) {
  return tokens.map((token) => token.text ?? "").join("");
}

function averageConfidence(tokens: SonioxToken[]) {
  const values = tokens
    .map((token) => token.confidence)
    .filter((value): value is number => typeof value === "number");
  if (!values.length) return undefined;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function minNumber(values: (number | undefined)[]) {
  const numbers = values.filter((value): value is number => value != null);
  return numbers.length ? Math.min(...numbers) : undefined;
}

function maxNumber(values: (number | undefined)[]) {
  const numbers = values.filter((value): value is number => value != null);
  return numbers.length ? Math.max(...numbers) : undefined;
}

function tokenLanguage(tokens: SonioxToken[]) {
  return tokens.find((token) => token.language)?.language;
}

function tokenSourceLanguage(tokens: SonioxToken[]) {
  return (
    tokens.find((token) => token.source_language)?.source_language ??
    tokenLanguage(tokens)
  );
}

function mappedEvent(input: {
  type: string;
  tokens: SonioxToken[];
  targetLanguage?: string;
  segmentIndex: number;
}): SonioxMappedEvent | null {
  const text = groupText(input.tokens);
  if (!text.trim()) return null;
  const isFinal = input.tokens.every((token) => Boolean(token.is_final));
  return {
    type: input.type,
    text,
    language: tokenSourceLanguage(input.tokens),
    targetLanguage: input.targetLanguage,
    isFinal,
    segmentIndex: input.segmentIndex,
    startMs: minNumber(input.tokens.map((token) => token.start_ms)),
    endMs: maxNumber(input.tokens.map((token) => token.end_ms)),
    confidence: averageConfidence(input.tokens),
  };
}

export function sonioxResponseToTranscriptEvents(input: {
  response: SonioxResponse;
  targetLanguage: string;
  state: SonioxMappingState;
}) {
  const tokens = input.response.tokens ?? [];
  const originalTokens = tokens.filter(
    (token) => token.translation_status !== "translation",
  );
  const translationTokens = tokens.filter(
    (token) => token.translation_status === "translation",
  );
  const events: SonioxMappedEvent[] = [];
  const segmentIndex = input.state.segmentIndex;

  const originalIsFinal =
    originalTokens.length > 0 &&
    originalTokens.every((token) => Boolean(token.is_final));
  const translationIsFinal =
    translationTokens.length > 0 &&
    translationTokens.every((token) => Boolean(token.is_final));

  const original = mappedEvent({
    type: originalIsFinal ? "final_transcript" : "partial_transcript",
    tokens: originalTokens,
    targetLanguage: input.targetLanguage,
    segmentIndex,
  });
  if (original) events.push(original);

  const translation = mappedEvent({
    type: translationIsFinal ? "final_translation" : "partial_translation",
    tokens: translationTokens,
    targetLanguage: input.targetLanguage,
    segmentIndex,
  });
  if (translation) events.push(translation);

  if (originalIsFinal) input.state.originalFinal = true;
  if (translationIsFinal) input.state.translationFinal = true;
  if (input.state.originalFinal && input.state.translationFinal) {
    input.state.segmentIndex += 1;
    input.state.originalFinal = false;
    input.state.translationFinal = false;
  }

  return events;
}

export class SonioxRealtimeBridge {
  private socket: WebSocket | null = null;
  private connectPromise: Promise<boolean> | null = null;
  private readonly state = createSonioxMappingState();
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  private closeTimer: ReturnType<typeof setTimeout> | null = null;
  private messageQueue: Promise<void> = Promise.resolve();
  private degraded = false;
  private ending = false;

  constructor(
    private readonly input: {
      sessionId: string;
      actorUserId?: string | null;
      targetLanguage: string;
      sourceLanguageMode?: string;
    },
  ) {}

  async start() {
    const apiKey = sonioxApiKey();
    if (!apiKey) {
      await this.degrade(
        "SONIOX_API_KEY_MISSING",
        "Soniox realtime provider is not configured. Local audio backup continues.",
      );
      return false;
    }

    this.connectPromise = new Promise<boolean>((resolve) => {
      const socket = new WebSocket(sonioxEndpoint());
      this.socket = socket;

      const timeout = setTimeout(() => {
        this.degrade(
          "SONIOX_CONNECT_TIMEOUT",
          "Soniox realtime provider connection timed out. Local audio backup continues.",
        ).finally(() => {
          socket.close();
          resolve(false);
        });
      }, 10_000);

      socket.on("open", () => {
        clearTimeout(timeout);
        this.startKeepAlive();
        socket.send(
          JSON.stringify(
            buildSonioxConfig({
              apiKey,
              sessionId: this.input.sessionId,
              targetLanguage: this.input.targetLanguage,
              sourceLanguageMode: this.input.sourceLanguageMode,
            }),
          ),
        );
        resolve(true);
      });

      socket.on("message", (raw: RawData) => {
        this.messageQueue = this.messageQueue
          .then(() => this.handleMessage(raw.toString()))
          .catch(async (error) => {
            await this.degrade(
              "SONIOX_MESSAGE_ERROR",
              "Soniox realtime provider message handling failed. Local audio backup continues.",
              {
                message:
                  error instanceof Error
                    ? error.message
                    : "Unknown message handling error.",
              },
            ).catch(() => undefined);
          });
      });

      socket.on("error", () => {
        clearTimeout(timeout);
        this.clearTimers();
        void this.degrade(
          "SONIOX_SOCKET_ERROR",
          "Soniox realtime provider connection failed. Local audio backup continues.",
        );
        resolve(false);
      });

      socket.on("close", () => {
        clearTimeout(timeout);
        this.clearTimers();
        this.socket = null;
        resolve(false);
      });
    }).finally(() => {
      this.connectPromise = null;
    });

    return this.connectPromise;
  }

  async sendAudio(body: Buffer) {
    if (this.degraded) return;
    if (this.connectPromise) {
      const connected = await this.connectPromise;
      if (!connected) return;
    }
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(body);
  }

  close() {
    if (this.ending) return;
    this.ending = true;
    this.clearKeepAlive();

    if (this.socket?.readyState === WebSocket.CONNECTING) {
      this.socket.once("open", () => {
        this.sendEndOfAudio();
      });
      return;
    }

    this.sendEndOfAudio();
  }

  private async handleMessage(raw: string) {
    let response: SonioxResponse;
    try {
      response = JSON.parse(raw) as SonioxResponse;
    } catch {
      return;
    }

    if (response.error_type || response.error_message) {
      const socket = this.socket;
      this.clearTimers();
      this.socket = null;
      if (socket?.readyState === WebSocket.OPEN) {
        socket.close();
      }
      await this.degrade(
        response.error_type ?? "SONIOX_ERROR",
        response.error_message ??
          "Soniox realtime provider returned an error. Local audio backup continues.",
        { requestId: response.request_id, errorCode: response.error_code },
      );
      return;
    }

    if (response.finished) {
      const socket = this.socket;
      this.clearTimers();
      this.socket = null;
      if (socket?.readyState === WebSocket.OPEN) {
        socket.close();
      }
      return;
    }

    const events = sonioxResponseToTranscriptEvents({
      response,
      targetLanguage: this.input.targetLanguage,
      state: this.state,
    });
    if (!events.length) return;
    await appendTranscriptEvents({
      sessionId: this.input.sessionId,
      actorUserId: this.input.actorUserId,
      events,
    });
  }

  private sendEndOfAudio() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.clearTimers();
      return;
    }

    this.socket.send("");
    this.closeTimer = setTimeout(() => {
      if (
        this.socket?.readyState === WebSocket.OPEN ||
        this.socket?.readyState === WebSocket.CLOSING
      ) {
        this.socket.terminate();
      }
      this.socket = null;
      this.clearTimers();
    }, SONIOX_CLOSE_GRACE_MS);
  }

  private startKeepAlive() {
    this.clearKeepAlive();
    this.keepAliveTimer = setInterval(() => {
      if (
        this.ending ||
        !this.socket ||
        this.socket.readyState !== WebSocket.OPEN
      ) {
        return;
      }
      this.socket.send(JSON.stringify({ type: "keepalive" }));
    }, SONIOX_KEEPALIVE_INTERVAL_MS);
  }

  private clearKeepAlive() {
    if (!this.keepAliveTimer) return;
    clearInterval(this.keepAliveTimer);
    this.keepAliveTimer = null;
  }

  private clearTimers() {
    this.clearKeepAlive();
    if (!this.closeTimer) return;
    clearTimeout(this.closeTimer);
    this.closeTimer = null;
  }

  private async degrade(
    code: string,
    message: string,
    metadata?: Record<string, unknown>,
  ) {
    if (this.degraded) return;
    this.degraded = true;
    await markProviderDegraded({
      sessionId: this.input.sessionId,
      actorUserId: this.input.actorUserId,
      providerName: "SONIOX",
      targetLanguage: this.input.targetLanguage,
      code,
      message,
      metadata,
    });
  }
}
