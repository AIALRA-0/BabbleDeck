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

type WindowWithWebkitAudio = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

type RecorderClientProps = {
  sessionId: string;
  title: string;
  status: string;
  targetLanguage: string;
  viewerUrl: string | null;
};

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
  viewerUrl,
}: RecorderClientProps) {
  const router = useRouter();
  const [permission, setPermission] = useState<
    "untested" | "granted" | "denied"
  >("untested");
  const [volume, setVolume] = useState(0);
  const [recording, setRecording] = useState(status === "recording");
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [backup, setBackup] = useState({ total: 0, uploaded: 0, pending: 0 });
  const [latestOriginal, setLatestOriginal] = useState("Waiting for speech...");
  const [latestTranslation, setLatestTranslation] =
    useState("字幕会在这里显示。");
  const [eventsSent, setEventsSent] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunkIndexRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const effectiveViewerUrl =
    viewerUrl && typeof window !== "undefined" && viewerUrl.startsWith("/")
      ? new URL(viewerUrl, window.location.origin).toString()
      : viewerUrl;

  useEffect(() => {
    countLocalChunks(sessionId)
      .then(setBackup)
      .catch(() => undefined);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      void audioContextRef.current?.close();
    };
  }, [sessionId]);

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

  async function uploadSyntheticChunk(index: number) {
    const blob = new Blob([`babbledeck mock audio chunk ${index}`], {
      type: "audio/webm",
    });
    const startedAt = new Date().toISOString();
    await saveLocalChunk({
      sessionId,
      chunkIndex: index,
      startedAt,
      durationMs: 1000,
      mimeType: blob.type,
      blob,
    });
    setBackup(await countLocalChunks(sessionId));
    await fetch(`/api/sessions/${sessionId}/audio-chunks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chunkIndex: index,
        startedAt,
        durationMs: 1000,
        mimeType: blob.type,
        byteSize: blob.size,
      }),
    });
    await markLocalChunkUploaded(sessionId, index);
    setBackup(await countLocalChunks(sessionId));
  }

  async function postMockSegment(index: number) {
    const item = script[index % script.length];
    setLatestOriginal(item.original);
    setLatestTranslation(item.translation);
    await fetch(`/api/sessions/${sessionId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    await uploadSyntheticChunk(index);
  }

  async function startRecording() {
    setPending(true);
    await ensureMic();
    await fetch(`/api/sessions/${sessionId}/start`, { method: "POST" });
    setRecording(true);
    setPending(false);

    if (streamRef.current && "MediaRecorder" in window) {
      const recorder = new MediaRecorder(streamRef.current);
      recorderRef.current = recorder;
      recorder.ondataavailable = async (event) => {
        if (event.data.size === 0) return;
        chunkIndexRef.current += 1;
        await saveLocalChunk({
          sessionId,
          chunkIndex: chunkIndexRef.current + 1000,
          startedAt: new Date().toISOString(),
          durationMs: 1000,
          mimeType: event.data.type || "audio/webm",
          blob: event.data,
        });
        setBackup(await countLocalChunks(sessionId));
      };
      recorder.start(1000);
    }

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

  async function stopRecording() {
    setPending(true);
    if (timerRef.current) window.clearInterval(timerRef.current);
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    await fetch(`/api/sessions/${sessionId}/stop`, { method: "POST" });
    setRecording(false);
    setPending(false);
    router.push(`/sessions/${sessionId}`);
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <section className="rounded-lg border border-border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div>
            <p className="text-sm text-muted-foreground">Recorder</p>
            <h1 className="text-2xl font-bold tracking-normal">{title}</h1>
          </div>
          <SessionStatusBadge status={recording ? "recording" : status} />
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
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">Events</p>
              <p className="mt-1 font-semibold">{eventsSent}</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">Provider</p>
              <p className="mt-1 font-semibold">Mock realtime</p>
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
            <Button asChild variant="ghost">
              <Link href={`/sessions/${sessionId}`}>
                <History className="h-4 w-4" /> History
              </Link>
            </Button>
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
            Create a new session for a fresh viewer link.
          </p>
        )}
      </aside>
    </div>
  );
}
