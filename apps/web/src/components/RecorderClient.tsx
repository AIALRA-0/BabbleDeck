"use client";

import { QRCodeSVG } from "qrcode.react";
import { Copy, History, Loader2, Mic, Square, TestTube2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SessionStatusBadge } from "@/components/SessionStatusBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  countLocalChunks,
  markLocalChunkUploaded,
  saveLocalChunk,
} from "@/features/recorder/local-backup";
import {
  readStoredSessionTokens,
  shareTokenFromViewerUrl,
  storeSessionTokens,
  viewerPathForShareToken,
} from "@/features/recorder/session-tokens";

type WindowWithWebkitAudio = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

type RecorderClientProps = {
  sessionId: string;
  title: string;
  status: string;
  targetLanguage: string;
  providerName: string;
  budgetCapUsd: number | null;
  estimatedCostUsd: number;
  viewerUrl: string | null;
  recorderToken: string | null;
  historyUrl: string | null;
};

type AudioChunkUploadResponse =
  | {
      ok: true;
      data: AudioChunkUploadData;
    }
  | { ok: false };

type StartSessionResponse =
  { ok: true; data: { session: { status: string } } } | { ok: false };

type StopSessionResponse =
  { ok: true; data: { session: { status: string } } } | { ok: false };

type SessionSnapshotResponse =
  | {
      ok: true;
      data: {
        session: {
          status: string;
          estimatedCostUsd: number;
        };
        segments: {
          originalText: string;
          translationText: string | null;
        }[];
      };
    }
  | { ok: false };

type AudioChunkUploadData = {
  chunkId: string;
  objectKey: string;
  status: string;
  provider: {
    budgetExceeded: boolean;
    sessionStatus: string | null;
    estimatedCostUsd: number | null;
  } | null;
};

type RecorderWsMessage =
  | {
      type: "audio_chunk_ack";
      requestId: string;
      data: AudioChunkUploadData;
    }
  | {
      type: "error";
      requestId?: string;
      error?: { code?: string; message?: string };
    }
  | { type: "ready"; connectionId: string; sessionId: string }
  | { type: "pong"; requestId?: string };

const script = [
  {
    original: "Welcome to BabbleDeck. The recorder is now live.",
    translation: "欢迎使用 BabbleDeck。录音端已经上线。",
  },
  {
    original: "The viewer link updates as transcript events arrive.",
    translation: "观众链接会随着转写事件实时更新。",
  },
  {
    original: "Local audio backup is saved before cleanup.",
    translation: "本地音频备份会先保存，再进行清理。",
  },
];

export function RecorderClient({
  sessionId,
  title,
  status,
  targetLanguage,
  providerName,
  budgetCapUsd,
  estimatedCostUsd: initialEstimatedCostUsd,
  viewerUrl,
  recorderToken,
  historyUrl,
}: RecorderClientProps) {
  const router = useRouter();
  const [permission, setPermission] = useState<
    "untested" | "granted" | "denied"
  >("untested");
  const [volume, setVolume] = useState(0);
  const [recording, setRecording] = useState(status === "recording");
  const [sessionStatus, setSessionStatus] = useState(status);
  const [estimatedCostUsd, setEstimatedCostUsd] = useState(
    initialEstimatedCostUsd,
  );
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [backup, setBackup] = useState({ total: 0, uploaded: 0, pending: 0 });
  const [backupTransport, setBackupTransport] = useState<"http" | "websocket">(
    "http",
  );
  const [backupError, setBackupError] = useState<string | null>(null);
  const [providerNotice, setProviderNotice] = useState<string | null>(
    status === "provider_degraded"
      ? "Budget cap reached. Local backup continues."
      : null,
  );
  const [latestOriginal, setLatestOriginal] = useState("Waiting for speech...");
  const [latestTranslation, setLatestTranslation] =
    useState("字幕会在这里显示。");
  const [eventsSent, setEventsSent] = useState(0);
  const [cachedViewerUrl, setCachedViewerUrl] = useState<string | null>(null);
  const [cachedRecorderToken, setCachedRecorderToken] = useState<string | null>(
    null,
  );
  const [clientOrigin, setClientOrigin] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderSocketRef = useRef<WebSocket | null>(null);
  const recorderSocketPromiseRef = useRef<Promise<WebSocket | null> | null>(
    null,
  );
  const pendingWsUploadsRef = useRef(
    new Map<
      string,
      {
        resolve: (value: AudioChunkUploadData) => void;
        reject: (error: Error) => void;
      }
    >(),
  );
  const chunkIndexRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const viewerUrlFromCache = viewerUrl ?? cachedViewerUrl;
  const effectiveRecorderToken = recorderToken ?? cachedRecorderToken;
  const effectiveViewerUrl =
    viewerUrlFromCache && clientOrigin && viewerUrlFromCache.startsWith("/")
      ? new URL(viewerUrlFromCache, clientOrigin).toString()
      : viewerUrlFromCache;
  const providerLabel =
    providerName === "soniox" ? "Soniox realtime" : "Mock realtime";
  const visibleStatus =
    sessionStatus === "provider_degraded"
      ? sessionStatus
      : recording
        ? "recording"
        : sessionStatus;

  useEffect(() => {
    countLocalChunks(sessionId)
      .then(setBackup)
      .catch(() => undefined);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      recorderRef.current?.stop();
      recorderSocketRef.current?.close();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      void audioContextRef.current?.close();
    };
  }, [sessionId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const timeout = window.setTimeout(() => {
      setClientOrigin(window.location.origin);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const shareToken = shareTokenFromViewerUrl(
      viewerUrl,
      window.location.origin,
    );
    if (shareToken) {
      storeSessionTokens(sessionId, {
        shareToken,
        recorderToken: recorderToken ?? undefined,
      });
    } else if (recorderToken) {
      storeSessionTokens(sessionId, { recorderToken });
    }

    const timeout = window.setTimeout(() => {
      const stored = readStoredSessionTokens(sessionId);
      const storedShareToken = shareToken ?? stored?.shareToken;
      setCachedViewerUrl(
        storedShareToken ? viewerPathForShareToken(storedShareToken) : null,
      );
      setCachedRecorderToken(recorderToken ?? stored?.recorderToken ?? null);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [recorderToken, sessionId, viewerUrl]);

  function recorderAuthHeaders() {
    return effectiveRecorderToken
      ? { "X-BabbleDeck-Recorder-Token": effectiveRecorderToken }
      : undefined;
  }

  useEffect(() => {
    if (!recording) return;
    let cancelled = false;

    async function refreshSnapshot() {
      try {
        const response = await fetch(`/api/sessions/${sessionId}`, {
          cache: "no-store",
        });
        if (!response.ok || cancelled) return;
        const payload = (await response.json()) as SessionSnapshotResponse;
        if (!payload.ok || cancelled) return;
        setSessionStatus(payload.data.session.status);
        setEstimatedCostUsd(payload.data.session.estimatedCostUsd);
        if (payload.data.session.status === "provider_degraded") {
          setProviderNotice("Provider degraded. Local backup continues.");
        }
        const latestSegment = [...payload.data.segments]
          .reverse()
          .find((segment) => segment.originalText || segment.translationText);
        if (latestSegment?.originalText) {
          setLatestOriginal(latestSegment.originalText);
        }
        if (latestSegment?.translationText) {
          setLatestTranslation(latestSegment.translationText);
        }
      } catch {
        // Recorder backup should continue even if the live transcript snapshot lags.
      }
    }

    void refreshSnapshot();
    const interval = window.setInterval(() => void refreshSnapshot(), 1000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [recording, sessionId]);

  function applyProviderResult(provider: AudioChunkUploadData["provider"]) {
    if (provider?.sessionStatus) {
      setSessionStatus(provider.sessionStatus);
    }
    if (provider?.estimatedCostUsd != null) {
      setEstimatedCostUsd(provider.estimatedCostUsd);
    }
    if (provider?.budgetExceeded) {
      setProviderNotice("Budget cap reached. Local backup continues.");
    } else if (provider?.sessionStatus === "provider_degraded") {
      setProviderNotice("Provider degraded. Local backup continues.");
    }
  }

  function recorderWsUrl() {
    const configured = process.env.NEXT_PUBLIC_RECORDER_WS_URL;
    const url = new URL(configured || "/ws/recorder", window.location.origin);
    if (url.protocol === "http:") url.protocol = "ws:";
    if (url.protocol === "https:") url.protocol = "wss:";
    url.searchParams.set("sessionId", sessionId);
    if (effectiveRecorderToken) {
      url.searchParams.set("recorder", effectiveRecorderToken);
    }
    return url.toString();
  }

  function rejectPendingWsUploads(error: Error) {
    pendingWsUploadsRef.current.forEach(({ reject }) => reject(error));
    pendingWsUploadsRef.current.clear();
  }

  async function ensureRecorderSocket() {
    if (recorderSocketRef.current?.readyState === WebSocket.OPEN) {
      return recorderSocketRef.current;
    }
    if (recorderSocketPromiseRef.current) {
      return recorderSocketPromiseRef.current;
    }

    recorderSocketPromiseRef.current = new Promise<WebSocket | null>(
      (resolve) => {
        if (typeof window === "undefined" || !("WebSocket" in window)) {
          resolve(null);
          return;
        }

        const socket = new WebSocket(recorderWsUrl());
        let settled = false;
        const timeout = window.setTimeout(() => {
          if (settled) return;
          settled = true;
          socket.close();
          resolve(null);
        }, 2500);

        socket.onopen = () => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeout);
          recorderSocketRef.current = socket;
          setBackupTransport("websocket");
          resolve(socket);
        };
        socket.onerror = () => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeout);
          resolve(null);
        };
        socket.onclose = () => {
          if (recorderSocketRef.current === socket) {
            recorderSocketRef.current = null;
            setBackupTransport("http");
          }
          rejectPendingWsUploads(new Error("Recorder WebSocket closed."));
        };
        socket.onmessage = (event) => {
          const message = JSON.parse(String(event.data)) as RecorderWsMessage;
          if (message.type === "audio_chunk_ack") {
            const pending = pendingWsUploadsRef.current.get(message.requestId);
            if (!pending) return;
            pendingWsUploadsRef.current.delete(message.requestId);
            pending.resolve(message.data);
          }
          if (message.type === "error" && message.requestId) {
            const pending = pendingWsUploadsRef.current.get(message.requestId);
            if (!pending) return;
            pendingWsUploadsRef.current.delete(message.requestId);
            pending.reject(
              new Error(message.error?.message ?? "Recorder WebSocket failed."),
            );
          }
        };
      },
    ).finally(() => {
      recorderSocketPromiseRef.current = null;
    });

    return recorderSocketPromiseRef.current;
  }

  function arrayBufferToBase64(buffer: ArrayBuffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let index = 0; index < bytes.length; index += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    }
    return window.btoa(binary);
  }

  async function ensureMic() {
    if (streamRef.current) return streamRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setPermission("granted");
      const AudioContextCtor =
        window.AudioContext ||
        (window as WindowWithWebkitAudio).webkitAudioContext;
      const audioContext = new AudioContextCtor();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const average =
          data.reduce((sum, value) => sum + value, 0) / data.length;
        setVolume(Math.min(100, Math.round((average / 255) * 140)));
        if (streamRef.current) requestAnimationFrame(tick);
      };
      tick();
      return stream;
    } catch {
      setPermission("denied");
      throw new Error("Microphone permission denied.");
    }
  }

  async function uploadChunkViaHttp(
    input: {
      index: number;
      startedAt: string;
      durationMs: number;
      blob: Blob;
    },
    mimeType: string,
  ) {
    setBackupTransport("http");
    const formData = new FormData();
    formData.append("chunkIndex", String(input.index));
    formData.append("startedAt", input.startedAt);
    formData.append("durationMs", String(input.durationMs));
    formData.append("mimeType", mimeType);
    formData.append(
      "file",
      input.blob,
      `chunk-${String(input.index).padStart(6, "0")}.webm`,
    );

    const response = await fetch(`/api/sessions/${sessionId}/audio-chunks`, {
      method: "POST",
      headers: recorderAuthHeaders(),
      body: formData,
    });
    if (!response.ok) {
      throw new Error("Audio chunk upload failed.");
    }
    const payload = (await response.json()) as AudioChunkUploadResponse;
    if (!payload.ok) {
      throw new Error("Audio chunk upload failed.");
    }
    return payload.data;
  }

  async function uploadChunkViaWebSocket(
    input: {
      index: number;
      startedAt: string;
      durationMs: number;
      blob: Blob;
    },
    mimeType: string,
  ) {
    const socket = await ensureRecorderSocket();
    if (!socket || socket.readyState !== WebSocket.OPEN) return null;

    const requestId = window.crypto.randomUUID();
    const dataBase64 = arrayBufferToBase64(await input.blob.arrayBuffer());
    return new Promise<AudioChunkUploadData>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        pendingWsUploadsRef.current.delete(requestId);
        reject(new Error("Recorder WebSocket upload timed out."));
      }, 15_000);
      pendingWsUploadsRef.current.set(requestId, {
        resolve: (value) => {
          window.clearTimeout(timeout);
          resolve(value);
        },
        reject: (error) => {
          window.clearTimeout(timeout);
          reject(error);
        },
      });
      socket.send(
        JSON.stringify({
          type: "audio_chunk",
          requestId,
          sessionId,
          chunkIndex: input.index,
          startedAt: input.startedAt,
          durationMs: input.durationMs,
          mimeType,
          dataBase64,
        }),
      );
    });
  }

  async function uploadChunkBlob(input: {
    index: number;
    startedAt: string;
    durationMs: number;
    blob: Blob;
  }) {
    const mimeType = input.blob.type || "audio/webm";
    await saveLocalChunk({
      sessionId,
      chunkIndex: input.index,
      startedAt: input.startedAt,
      durationMs: input.durationMs,
      mimeType,
      blob: input.blob,
    });
    setBackup(await countLocalChunks(sessionId));

    let result: AudioChunkUploadData | null = null;
    try {
      result = await uploadChunkViaWebSocket(input, mimeType);
    } catch {
      result = null;
    }
    if (!result) {
      result = await uploadChunkViaHttp(input, mimeType);
    }
    applyProviderResult(result.provider);
    await markLocalChunkUploaded(sessionId, input.index);
    setBackup(await countLocalChunks(sessionId));
    setBackupError(null);
  }

  async function uploadSyntheticChunk(index: number) {
    const blob = new Blob([`babbledeck mock audio chunk ${index}`], {
      type: "audio/webm",
    });
    await uploadChunkBlob({
      index,
      startedAt: new Date().toISOString(),
      durationMs: 1000,
      blob,
    });
  }

  async function uploadRecordedChunk(index: number, blob: Blob) {
    try {
      await uploadChunkBlob({
        index,
        startedAt: new Date().toISOString(),
        durationMs: 1000,
        blob,
      });
    } catch {
      setBackupError("Audio upload failed. Local backup is still saved here.");
      setBackup(await countLocalChunks(sessionId));
    }
  }

  async function postMockSegment(index: number) {
    const item = script[index % script.length];
    setLatestOriginal(item.original);
    setLatestTranslation(item.translation);
    await fetch(`/api/sessions/${sessionId}/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(recorderAuthHeaders() ?? {}),
      },
      body: JSON.stringify({
        events: [
          {
            type: "partial_transcript",
            text: item.original.slice(0, 24),
            language: "en",
            targetLanguage,
            isFinal: false,
            segmentIndex: index,
            startMs: index * 2500,
            endMs: index * 2500 + 1200,
          },
          {
            type: "final_transcript",
            text: item.original,
            language: "en",
            targetLanguage,
            isFinal: true,
            segmentIndex: index,
            startMs: index * 2500,
            endMs: index * 2500 + 2200,
            confidence: 0.95,
          },
          {
            type: "final_translation",
            text: item.translation,
            language: "en",
            targetLanguage,
            isFinal: true,
            segmentIndex: index,
            startMs: index * 2500,
            endMs: index * 2500 + 2200,
          },
        ],
      }),
    });
    setEventsSent((value) => value + 3);
    try {
      await uploadSyntheticChunk(index);
    } catch {
      setBackupError("Audio upload failed. Local backup is still saved here.");
      setBackup(await countLocalChunks(sessionId));
    }
  }

  async function startRecording() {
    setPending(true);
    await ensureMic();
    const startResponse = await fetch(`/api/sessions/${sessionId}/start`, {
      method: "POST",
      headers: recorderAuthHeaders(),
    });
    if (!startResponse.ok) {
      setPending(false);
      return;
    }
    const startPayload = (await startResponse.json()) as StartSessionResponse;
    setSessionStatus(
      startPayload.ok ? startPayload.data.session.status : status,
    );
    setRecording(true);
    setPending(false);

    if (streamRef.current && "MediaRecorder" in window) {
      const recorder = new MediaRecorder(streamRef.current);
      recorderRef.current = recorder;
      recorder.ondataavailable = async (event) => {
        if (event.data.size === 0) return;
        chunkIndexRef.current += 1;
        await uploadRecordedChunk(chunkIndexRef.current + 1000, event.data);
      };
      recorder.start(1000);
    }

    if (providerName === "mock") {
      await postMockSegment(0);
      let index = 1;
      timerRef.current = window.setInterval(() => {
        void postMockSegment(index);
        index += 1;
        if (index >= script.length && timerRef.current) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }, 1200);
    }
  }

  async function stopRecording() {
    setPending(true);
    if (timerRef.current) window.clearInterval(timerRef.current);
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const stopResponse = await fetch(`/api/sessions/${sessionId}/stop`, {
      method: "POST",
      headers: recorderAuthHeaders(),
    });
    const stopPayload = stopResponse.ok
      ? ((await stopResponse.json()) as StopSessionResponse)
      : null;
    if (stopPayload?.ok) {
      setSessionStatus(stopPayload.data.session.status);
    }
    setRecording(false);
    setPending(false);
    if (historyUrl) {
      router.push(historyUrl);
      router.refresh();
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <section className="rounded-lg border border-border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div>
            <p className="text-sm text-muted-foreground">Recorder</p>
            <h1 className="text-2xl font-bold tracking-normal">{title}</h1>
          </div>
          <SessionStatusBadge status={visibleStatus} />
        </div>

        <div className="mt-6 space-y-6">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">Microphone level</p>
              <Badge
                tone={
                  permission === "denied"
                    ? "red"
                    : permission === "granted"
                      ? "green"
                      : "neutral"
                }
              >
                {permission === "untested" ? "Not tested" : permission}
              </Badge>
            </div>
            <div
              className="h-4 overflow-hidden rounded-full bg-muted"
              aria-label="Volume meter"
            >
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${Math.max(volume, recording ? 18 : 0)}%` }}
              />
            </div>
            {permission === "denied" ? (
              <p className="mt-3 text-sm font-medium text-red-700">
                Microphone access is blocked. Allow microphone access in the
                browser and retry.
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-md border border-border bg-muted/30 p-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Original
              </p>
              <p className="mt-2 min-h-20 text-2xl font-semibold leading-snug">
                {latestOriginal}
              </p>
            </div>
            <div className="rounded-md border border-border bg-muted/30 p-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Translation
              </p>
              <p className="mt-2 min-h-20 text-3xl font-bold leading-tight">
                {latestTranslation}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">Backup</p>
              <p className="mt-1 font-semibold">
                {backup.uploaded}/{backup.total} uploaded
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {backupTransport === "websocket"
                  ? "WebSocket backup"
                  : "HTTP backup"}
              </p>
              {backupError ? (
                <p className="mt-1 text-xs font-medium text-red-700">
                  {backupError}
                </p>
              ) : null}
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">Events</p>
              <p className="mt-1 font-semibold">{eventsSent}</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">Provider</p>
              <p className="mt-1 font-semibold">{providerLabel}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                ${estimatedCostUsd.toFixed(4)}
                {budgetCapUsd ? ` / $${budgetCapUsd.toFixed(4)}` : ""}
              </p>
              {providerNotice ? (
                <p className="mt-1 text-xs font-medium text-amber-700">
                  {providerNotice}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 -mx-5 mt-6 border-t border-border bg-white/95 p-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              variant="secondary"
              onClick={() => void ensureMic()}
              disabled={pending || recording}
            >
              <TestTube2 className="h-4 w-4" /> Test microphone
            </Button>
            {!recording ? (
              <Button onClick={() => void startRecording()} disabled={pending}>
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
                Start recording
              </Button>
            ) : (
              <Button
                variant="destructive"
                onClick={() => void stopRecording()}
                disabled={pending}
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
                Stop recording
              </Button>
            )}
            {historyUrl ? (
              <Button asChild variant="ghost">
                <Link href={historyUrl}>
                  <History className="h-4 w-4" /> History
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <aside className="rounded-lg border border-border bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold">Viewer link</p>
        {effectiveViewerUrl ? (
          <>
            <div className="mt-4 flex justify-center rounded-md border border-border bg-white p-4">
              <QRCodeSVG value={effectiveViewerUrl} size={190} />
            </div>
            <p className="mt-4 break-all rounded-md bg-muted p-3 text-sm">
              {effectiveViewerUrl}
            </p>
            <Button
              variant="secondary"
              className="mt-3 w-full"
              onClick={async () => {
                await navigator.clipboard?.writeText(effectiveViewerUrl);
                setCopied(true);
              }}
            >
              <Copy className="h-4 w-4" />{" "}
              {copied ? "Copied" : "Copy viewer link"}
            </Button>
            <Button asChild className="mt-3 w-full" variant="ghost">
              <Link href={effectiveViewerUrl} target="_blank">
                Open viewer
              </Link>
            </Button>
          </>
        ) : (
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            This session was reopened after the one-time share token was shown.
            Open the original recorder URL on the browser that created it, or
            create a new session for a fresh viewer link.
          </p>
        )}
      </aside>
    </div>
  );
}
