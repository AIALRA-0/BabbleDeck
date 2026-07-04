import http from "node:http";
import crypto from "node:crypto";
import type { Duplex } from "node:stream";
import { WebSocket, WebSocketServer } from "ws";
import { prisma } from "../apps/web/src/server/db";
import {
  findRecorderSessionForOwner,
  findRecorderSessionForToken,
  type RecorderSession,
} from "../apps/web/src/server/recorder-access";
import { hashToken } from "../apps/web/src/server/security";
import { audioChunkSchema } from "../apps/web/src/server/schemas";
import {
  AudioChunkUploadError,
  saveSessionAudioChunk,
} from "../apps/web/src/server/audio-chunk-service";
import { AUDIO_CHUNK_MAX_BYTES } from "../apps/web/src/server/audio-storage";
import { SonioxRealtimeBridge } from "../apps/web/src/server/soniox-realtime";

const AUTH_COOKIE = "babbledeck_session";
const DEFAULT_PORT = 11971;

type AuthenticatedUser = {
  id: string;
  email: string;
};

type RecorderContext = {
  connectionId: string;
  recorderConnectionId: string;
  sessionId: string;
  session: RecorderSession;
  providerName: "MOCK" | "SONIOX";
  targetLanguage: string;
  sourceLanguageMode: string;
  actorUserId: string | null;
  authVia: "admin" | "recorder_token";
};

function sendJson(socket: WebSocket, value: unknown) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(value));
  }
}

function rejectUpgrade(socket: Duplex, status: number, message: string) {
  socket.write(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\n\r\n`);
  socket.end();
}

function cookieValue(header: string | undefined, name: string) {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (rawKey === name) {
      return decodeURIComponent(rawValue.join("="));
    }
  }
  return null;
}

async function authenticate(request: http.IncomingMessage) {
  const token = cookieValue(request.headers.cookie, AUTH_COOKIE);
  if (!token) return null;
  const authSession = await prisma.authSession.findUnique({
    where: { sessionTokenHash: hashToken(token) },
    include: { user: true },
  });
  if (
    !authSession ||
    authSession.revokedAt ||
    authSession.expiresAt <= new Date() ||
    authSession.user.disabledAt ||
    authSession.user.passwordRotationRequired
  ) {
    return null;
  }
  return {
    id: authSession.user.id,
    email: authSession.user.email,
  };
}

function parseUrl(request: http.IncomingMessage) {
  const host = request.headers.host ?? "127.0.0.1";
  return new URL(request.url ?? "/", `http://${host}`);
}

function parseAudioMessage(raw: WebSocket.RawData) {
  const value = JSON.parse(raw.toString()) as {
    type?: string;
    requestId?: string;
    sessionId?: string;
    chunkIndex?: number;
    startedAt?: string;
    durationMs?: number;
    mimeType?: string;
    checksumSha256?: string;
    dataBase64?: string;
  };

  if (value.type === "ping") return { type: "ping" as const, value };
  if (value.type !== "audio_chunk" || !value.dataBase64) {
    throw new Error("Unsupported recorder message.");
  }

  const body = Buffer.from(value.dataBase64, "base64");
  const parsed = audioChunkSchema.parse({
    chunkIndex: value.chunkIndex,
    startedAt: value.startedAt,
    durationMs: value.durationMs,
    mimeType: value.mimeType ?? "audio/webm",
    byteSize: body.length,
    checksumSha256: value.checksumSha256,
  });

  return {
    type: "audio_chunk" as const,
    value,
    body,
    parsed,
  };
}

async function handleRecorderConnection(
  socket: WebSocket,
  request: http.IncomingMessage,
  context: RecorderContext,
) {
  const soniox =
    context.providerName === "SONIOX"
      ? new SonioxRealtimeBridge({
          sessionId: context.sessionId,
          actorUserId: context.actorUserId,
          targetLanguage: context.targetLanguage,
          sourceLanguageMode: context.sourceLanguageMode,
        })
      : null;
  void soniox?.start();

  sendJson(socket, {
    type: "ready",
    connectionId: context.connectionId,
    sessionId: context.sessionId,
  });

  socket.on("message", (raw) => {
    void (async () => {
      let requestId: string | undefined;
      try {
        const message = parseAudioMessage(raw);
        requestId = message.value.requestId;
        if (message.type === "ping") {
          sendJson(socket, { type: "pong", requestId });
          return;
        }
        if (message.value.sessionId !== context.sessionId) {
          throw new Error("Recorder session mismatch.");
        }

        const result = await saveSessionAudioChunk({
          session: context.session,
          actorUserId: context.actorUserId,
          chunkIndex: message.parsed.chunkIndex,
          startedAt: message.parsed.startedAt,
          durationMs: message.parsed.durationMs,
          mimeType: message.parsed.mimeType,
          checksumSha256: message.parsed.checksumSha256,
          body: message.body,
        });
        void soniox?.sendAudio(message.body);
        sendJson(socket, {
          type: "audio_chunk_ack",
          requestId,
          data: result,
        });
      } catch (error) {
        const code =
          error instanceof AudioChunkUploadError ? error.code : "WS_ERROR";
        const message =
          error instanceof Error ? error.message : "Recorder WebSocket failed.";
        sendJson(socket, {
          type: "error",
          requestId,
          error: { code, message },
        });
      }
    })();
  });

  socket.on("close", () => {
    soniox?.close();
    void prisma.recorderConnection.updateMany({
      where: { id: context.recorderConnectionId, endedAt: null },
      data: { status: "closed", endedAt: new Date() },
    });
  });
}

async function buildContext(request: http.IncomingMessage) {
  const url = parseUrl(request);
  if (url.pathname !== "/ws/recorder") return null;
  const sessionId = url.searchParams.get("sessionId");
  if (!sessionId) return null;
  const user = await authenticate(request);
  const recorderToken =
    url.searchParams.get("recorder") ?? url.searchParams.get("recorderToken");
  const ownerSession = user
    ? await findRecorderSessionForOwner(sessionId, user.id)
    : null;
  const tokenSession = ownerSession
    ? null
    : await findRecorderSessionForToken(sessionId, recorderToken);
  const session = ownerSession ?? tokenSession;
  if (!session) return null;

  const connectionId = crypto.randomUUID();
  const providerName: RecorderContext["providerName"] =
    session.providerName === "SONIOX" ? "SONIOX" : "MOCK";
  const authVia: RecorderContext["authVia"] = ownerSession
    ? "admin"
    : "recorder_token";
  const recorderConnection = await prisma.recorderConnection.create({
    data: {
      sessionId,
      connectionId,
      transport: "websocket",
      status: "connected",
      clientInfo: {
        authVia,
        userAgent: request.headers["user-agent"] ?? null,
        remoteAddress: request.socket.remoteAddress ?? null,
        forwardedFor: request.headers["x-forwarded-for"] ?? null,
      },
    },
  });

  return {
    connectionId,
    recorderConnectionId: recorderConnection.id,
    sessionId,
    session,
    providerName,
    targetLanguage: session.targetLanguage,
    sourceLanguageMode: session.sourceLanguageMode,
    actorUserId: user && ownerSession ? user.id : null,
    authVia,
  };
}

const port = Number(process.env.RECORDER_WS_PORT ?? DEFAULT_PORT);
const host = process.env.RECORDER_WS_HOST ?? "127.0.0.1";
const server = http.createServer((request, response) => {
  if (request.url === "/healthz") {
    response.writeHead(200, { "content-type": "text/plain" });
    response.end("ok");
    return;
  }
  response.writeHead(404, { "content-type": "text/plain" });
  response.end("not found");
});
const wss = new WebSocketServer({
  noServer: true,
  maxPayload: AUDIO_CHUNK_MAX_BYTES * 2,
});

server.on("upgrade", (request, socket, head) => {
  void (async () => {
    try {
      const context = await buildContext(request);
      if (!context) {
        rejectUpgrade(socket, 401, "Unauthorized");
        return;
      }
      wss.handleUpgrade(request, socket, head, (ws) => {
        void handleRecorderConnection(ws, request, context);
      });
    } catch {
      rejectUpgrade(socket, 500, "Internal Server Error");
    }
  })();
});

server.listen(port, host, () => {
  console.log(`BabbleDeck recorder WebSocket listening on ${host}:${port}`);
});

function shutdown() {
  wss.close();
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
