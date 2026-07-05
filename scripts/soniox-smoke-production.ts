import crypto from "node:crypto";
import fs from "node:fs/promises";
import { WebSocket } from "ws";
import { prisma } from "../apps/web/src/server/db";
import { buildSonioxReadinessProbeAudio } from "../apps/web/src/server/soniox-realtime";

type JsonResponse<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string };
};

type CreateSessionResponse = {
  session: {
    id: string;
    title: string;
    status: string;
  };
  recorderToken: string;
};

type RecorderWsResult = {
  ready: boolean;
  ack: boolean;
};

type ProbeAudio = {
  body: Buffer;
  durationMs: number;
  mimeType: string;
};

function argValue(name: string) {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

function positiveInteger(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function nonNegativeInteger(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function cookiePairs(setCookie: string | null) {
  if (!setCookie) return [];
  return setCookie
    .split(/,(?=[^;,]+=)/)
    .map((part) => part.split(";", 1)[0]?.trim())
    .filter((part): part is string => Boolean(part));
}

function mergeCookies(current: Map<string, string>, response: Response) {
  for (const pair of cookiePairs(response.headers.get("set-cookie"))) {
    const index = pair.indexOf("=");
    if (index <= 0) continue;
    current.set(pair.slice(0, index), pair.slice(index + 1));
  }
}

function cookieHeader(cookies: Map<string, string>) {
  return [...cookies.entries()]
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

async function parseJson<T>(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text) as JsonResponse<T>;
  } catch {
    throw new Error(
      `Expected JSON response from ${response.url}; status ${response.status}; body ${text.slice(0, 200)}`,
    );
  }
}

async function apiJson<T>(
  url: URL,
  init: RequestInit,
  options?: { expectOk?: boolean },
) {
  const response = await fetch(url, init);
  const body = await parseJson<T>(response);
  const ok = response.ok && body.ok === true;
  if ((options?.expectOk ?? true) && !ok) {
    throw new Error(
      `${init.method ?? "GET"} ${url.pathname} failed with ${response.status}: ${
        body.error?.code ?? "UNKNOWN"
      } ${body.error?.message ?? ""}`.trim(),
    );
  }
  return { response, body };
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string) {
  let timeout: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`${label} timed out.`)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

function recorderWsUrl(input: {
  baseUrl: URL;
  sessionId: string;
  recorderToken: string;
  trackId?: string;
  speakerLabel?: string;
}) {
  const url = new URL("/ws/recorder", input.baseUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("sessionId", input.sessionId);
  url.searchParams.set("recorder", input.recorderToken);
  if (input.trackId) url.searchParams.set("trackId", input.trackId);
  if (input.speakerLabel) {
    url.searchParams.set("speakerLabel", input.speakerLabel);
  }
  return url;
}

async function probeAudio(input: {
  audioFile?: string;
  durationMs: number;
}): Promise<ProbeAudio> {
  if (input.audioFile) {
    return {
      body: await fs.readFile(input.audioFile),
      durationMs: input.durationMs,
      mimeType: input.audioFile.endsWith(".wav") ? "audio/wav" : "audio/webm",
    };
  }

  return {
    body: buildSonioxReadinessProbeAudio(input.durationMs),
    durationMs: input.durationMs,
    mimeType: "audio/wav",
  };
}

function uploadProbeOverRecorderWs(input: {
  wsUrl: URL;
  sessionId: string;
  audio: ProbeAudio;
  timeoutMs: number;
}) {
  const requestId = crypto.randomUUID();
  const checksumSha256 = crypto
    .createHash("sha256")
    .update(input.audio.body)
    .digest("hex");

  return withTimeout(
    new Promise<RecorderWsResult>((resolve, reject) => {
      const socket = new WebSocket(input.wsUrl);
      let ready = false;
      let settled = false;
      const settle = (result: RecorderWsResult) => {
        if (settled) return;
        settled = true;
        if (socket.readyState === WebSocket.OPEN) socket.close();
        resolve(result);
      };
      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        if (
          socket.readyState === WebSocket.OPEN ||
          socket.readyState === WebSocket.CONNECTING
        ) {
          socket.close();
        }
        reject(error);
      };

      socket.on("message", (raw) => {
        let message: {
          type?: string;
          requestId?: string;
          error?: { code?: string; message?: string };
        };
        try {
          message = JSON.parse(raw.toString());
        } catch {
          return;
        }

        if (message.type === "ready") {
          ready = true;
          socket.send(
            JSON.stringify({
              type: "audio_chunk",
              requestId,
              sessionId: input.sessionId,
              chunkIndex: 0,
              startedAt: new Date().toISOString(),
              durationMs: input.audio.durationMs,
              mimeType: input.audio.mimeType,
              checksumSha256,
              dataBase64: input.audio.body.toString("base64"),
            }),
          );
        }

        if (
          message.type === "audio_chunk_ack" &&
          message.requestId === requestId
        ) {
          settle({ ready, ack: true });
        }

        if (message.type === "error") {
          fail(
            new Error(
              `${message.error?.code ?? "WS_ERROR"} ${message.error?.message ?? ""}`.trim(),
            ),
          );
        }
      });

      socket.on("error", () => {
        fail(new Error("Recorder websocket smoke failed."));
      });
    }),
    input.timeoutMs,
    "recorder websocket smoke",
  );
}

async function archiveSmokeSession(sessionId: string | null) {
  if (!sessionId) return false;
  const updated = await prisma.liveSession.updateMany({
    where: { id: sessionId, archivedAt: null },
    data: {
      archivedAt: new Date(),
      endedAt: new Date(),
      status: "ARCHIVED",
    },
  });
  return updated.count > 0;
}

async function main() {
  const baseUrl = new URL(
    argValue("--base-url") ??
      process.env.BABBLEDECK_SONIOX_SMOKE_BASE_URL ??
      process.env.BABBLEDECK_BASE_URL ??
      process.env.PRODUCTION_BASE_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      "https://babbledeck.aialra.online",
  );
  const timeoutMs = clamp(
    positiveInteger(process.env.BABBLEDECK_SONIOX_SMOKE_TIMEOUT_SECONDS, 30) *
      1000,
    5_000,
    120_000,
  );
  const probeDurationMs = clamp(
    positiveInteger(
      process.env.BABBLEDECK_SONIOX_SMOKE_PROBE_MS ?? argValue("--probe-ms"),
      360,
    ),
    300,
    10_000,
  );
  const providerSettleMs = clamp(
    positiveInteger(process.env.BABBLEDECK_SONIOX_SMOKE_SETTLE_MS, 3_000),
    500,
    30_000,
  );
  const audioFile =
    argValue("--audio-file") ?? process.env.BABBLEDECK_SONIOX_SMOKE_AUDIO_FILE;
  const trackId =
    argValue("--track-id") ?? process.env.BABBLEDECK_SONIOX_SMOKE_TRACK_ID;
  const speakerLabel =
    argValue("--speaker-label") ??
    process.env.BABBLEDECK_SONIOX_SMOKE_SPEAKER_LABEL;
  const minTrackEvents = nonNegativeInteger(
    argValue("--min-track-events") ??
      process.env.BABBLEDECK_SONIOX_SMOKE_MIN_TRACK_EVENTS,
    0,
  );
  const minTrackSegments = nonNegativeInteger(
    argValue("--min-track-segments") ??
      process.env.BABBLEDECK_SONIOX_SMOKE_MIN_TRACK_SEGMENTS,
    0,
  );
  const adminEmail = (
    process.env.BABBLEDECK_SONIOX_SMOKE_ADMIN_EMAIL ??
    process.env.SEED_ADMIN_EMAIL ??
    "admin@example.invalid"
  ).toLowerCase();
  const adminPassword =
    process.env.BABBLEDECK_SONIOX_SMOKE_ADMIN_PASSWORD ??
    requiredEnv("SEED_ADMIN_PASSWORD");
  const cookies = new Map<string, string>();
  const startedAt = new Date();
  let sessionId: string | null = null;

  try {
    const login = await apiJson<{ user: { email: string } }>(
      new URL("/api/auth/login", baseUrl),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: adminEmail, password: adminPassword }),
      },
    );
    mergeCookies(cookies, login.response);
    if (login.body.data?.user.email !== adminEmail) {
      throw new Error("Login smoke returned an unexpected admin user.");
    }

    const create = await apiJson<CreateSessionResponse>(
      new URL("/api/sessions", baseUrl),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieHeader(cookies),
          Origin: baseUrl.origin,
        },
        body: JSON.stringify({
          title: `Soniox smoke ${new Date().toISOString()}`,
          description:
            "Automated production Soniox recorder WebSocket smoke; archived on cleanup.",
          sourceLanguageMode: "auto",
          targetLanguage: "zh",
          providerName: "soniox",
          qualityMode: "realtime",
        }),
      },
    );
    sessionId = create.body.data?.session.id ?? null;
    const recorderToken = create.body.data?.recorderToken;
    if (!sessionId || !recorderToken) {
      throw new Error("Session creation did not return Soniox smoke tokens.");
    }
    const audio = await probeAudio({
      audioFile,
      durationMs: probeDurationMs,
    });

    await apiJson(new URL(`/api/sessions/${sessionId}/start`, baseUrl), {
      method: "POST",
      headers: {
        "X-BabbleDeck-Recorder-Token": recorderToken,
      },
    });

    const recorderWs = await uploadProbeOverRecorderWs({
      wsUrl: recorderWsUrl({
        baseUrl,
        sessionId,
        recorderToken,
        trackId,
        speakerLabel,
      }),
      sessionId,
      audio,
      timeoutMs,
    });

    await new Promise((resolve) => setTimeout(resolve, providerSettleMs));
    await apiJson(
      new URL(`/api/sessions/${sessionId}/stop`, baseUrl),
      {
        method: "POST",
        headers: {
          "X-BabbleDeck-Recorder-Token": recorderToken,
        },
      },
      { expectOk: false },
    ).catch(() => null);

    const [
      providerErrors,
      providerUsage,
      audioChunks,
      session,
      trackEvents,
      trackSegments,
      recorderConnection,
    ] = await Promise.all([
      prisma.transcriptEvent.count({
        where: { sessionId, eventType: "PROVIDER_ERROR" },
      }),
      prisma.providerUsage.findMany({
        where: { sessionId },
        select: {
          providerName: true,
          usageType: true,
          audioMs: true,
          estimatedCostUsd: true,
        },
      }),
      prisma.audioChunk.count({ where: { sessionId } }),
      prisma.liveSession.findUnique({
        where: { id: sessionId },
        select: { status: true, providerName: true },
      }),
      trackId
        ? prisma.transcriptEvent.count({ where: { sessionId, trackId } })
        : Promise.resolve(0),
      trackId
        ? prisma.transcriptSegment.count({ where: { sessionId, trackId } })
        : Promise.resolve(0),
      prisma.recorderConnection.findFirst({
        where: { sessionId },
        orderBy: { startedAt: "desc" },
        select: { clientInfo: true },
      }),
    ]);
    const archived = await archiveSmokeSession(sessionId);
    await apiJson(
      new URL("/api/auth/logout", baseUrl),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieHeader(cookies),
          Origin: baseUrl.origin,
        },
        body: "{}",
      },
      { expectOk: false },
    ).catch(() => null);

    const usage = providerUsage.map((item) => ({
      providerName: item.providerName,
      usageType: item.usageType,
      audioMs: item.audioMs,
      estimatedCostUsd: item.estimatedCostUsd?.toString() ?? null,
    }));
    const usageAudioMs = usage.reduce(
      (sum, item) => sum + Number(item.audioMs ?? 0),
      0,
    );
    const ok =
      recorderWs.ready &&
      recorderWs.ack &&
      audioChunks === 1 &&
      providerErrors === 0 &&
      usageAudioMs >= probeDurationMs &&
      (!trackId || trackEvents >= minTrackEvents) &&
      (!trackId || trackSegments >= minTrackSegments);
    const record = {
      app: "babbledeck",
      checkedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      baseUrl: baseUrl.toString(),
      ok,
      sessionId,
      archived,
      probeDurationMs,
      audioFile: audioFile ? { provided: true } : { provided: false },
      track: trackId
        ? {
            trackId,
            speakerLabel: speakerLabel ?? null,
            transcriptEvents: trackEvents,
            transcriptSegments: trackSegments,
            thresholds: {
              minTrackEvents,
              minTrackSegments,
            },
            recorderConnection: recorderConnection?.clientInfo ?? null,
          }
        : null,
      recorderWs,
      audioChunks,
      providerErrors,
      providerUsage: usage,
      sessionBeforeArchive: session,
    };
    process.stdout.write(`${JSON.stringify(record)}\n`);
    if (!ok) process.exitCode = 1;
  } catch (error) {
    const archived = await archiveSmokeSession(sessionId).catch(() => false);
    const record = {
      app: "babbledeck",
      checkedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      baseUrl: baseUrl.toString(),
      ok: false,
      sessionId,
      archived,
      error: error instanceof Error ? error.message : "Soniox smoke failed.",
    };
    process.stdout.write(`${JSON.stringify(record)}\n`);
    process.exitCode = 1;
  }
}

main().finally(async () => {
  await prisma.$disconnect();
});
