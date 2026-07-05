"use client";

import {
  Copy,
  Languages,
  Maximize2,
  Minimize2,
  Moon,
  Radio,
  RefreshCw,
  Sun,
  Volume2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { RemoteTrack, Room as LiveKitRoom } from "livekit-client";
import { SessionStatusBadge } from "@/components/SessionStatusBadge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ViewerEvent = {
  id: string;
  type: string;
  sequenceNo: number;
  trackId: string;
  speakerLabel: string | null;
  text: string | null;
  isFinal: boolean;
};

type Segment = {
  id: string;
  index: number;
  trackId: string;
  speakerLabel: string | null;
  originalText: string;
  translationText: string | null;
};

type ViewerPayload = {
  session: ViewerClientProps["initialSession"];
  events: ViewerEvent[];
  segments: Segment[];
};

type LiveKitTokenResponse =
  | {
      ok: true;
      data: {
        url: string;
        token: string;
        room: string;
        identity: string;
        role: "publisher" | "subscriber";
        expiresInSeconds: number;
      };
    }
  | { ok: false };

type ViewerLiveKitStatus =
  | "checking"
  | "connected"
  | "receiving"
  | "action_required"
  | "disabled"
  | "reconnecting"
  | "error";

type CaptionViewMode = "translation" | "both" | "original";
type CaptionTheme = "dark" | "light";

type ViewerClientProps = {
  shareToken: string;
  initialSession: {
    title: string;
    status: string;
    targetLanguage: string;
  };
  initialSegments: Segment[];
};

export function ViewerClient({
  shareToken,
  initialSession,
  initialSegments,
}: ViewerClientProps) {
  const [session, setSession] = useState(initialSession);
  const [segments, setSegments] = useState(initialSegments);
  const [events, setEvents] = useState<ViewerEvent[]>([]);
  const [connectionMode, setConnectionMode] = useState<
    "connecting" | "sse" | "polling" | "reconnecting" | "offline"
  >("connecting");
  const [liveKitStatus, setLiveKitStatus] =
    useState<ViewerLiveKitStatus>("checking");
  const [liveKitNotice, setLiveKitNotice] = useState<string | null>(null);
  const [remoteAudioCount, setRemoteAudioCount] = useState(0);
  const [viewMode, setViewMode] = useState<CaptionViewMode>("both");
  const [large, setLarge] = useState(true);
  const [theme, setTheme] = useState<CaptionTheme>("dark");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const lastSequenceRef = useRef(0);
  const liveKitRoomRef = useRef<LiveKitRoom | null>(null);
  const audioSinkRef = useRef<HTMLDivElement | null>(null);
  const liveKitRunRef = useRef(0);

  useEffect(() => {
    function syncNetworkState() {
      if (navigator.onLine) {
        setConnectionMode((current) =>
          current === "offline" ? "reconnecting" : current,
        );
      } else {
        setConnectionMode("offline");
      }
    }

    syncNetworkState();
    window.addEventListener("online", syncNetworkState);
    window.addEventListener("offline", syncNetworkState);
    return () => {
      window.removeEventListener("online", syncNetworkState);
      window.removeEventListener("offline", syncNetworkState);
    };
  }, []);

  async function playAttachedRoomAudio() {
    const elements = Array.from(
      audioSinkRef.current?.querySelectorAll("audio") ?? [],
    );
    if (!elements.length) return;
    try {
      await Promise.all(elements.map((element) => element.play()));
      setLiveKitStatus(remoteAudioCount > 0 ? "receiving" : "connected");
      setLiveKitNotice(null);
    } catch {
      setLiveKitStatus("action_required");
      setLiveKitNotice("Tap to enable room audio.");
    }
  }

  useEffect(() => {
    let cancelled = false;
    const attachedAudio = new Set<HTMLMediaElement>();
    const attachedTracks = new Set<RemoteTrack>();
    const runId = liveKitRunRef.current + 1;
    liveKitRunRef.current = runId;

    function clearAttachedAudio(updateState = true) {
      attachedAudio.forEach((element) => element.remove());
      attachedAudio.clear();
      attachedTracks.clear();
      if (updateState) setRemoteAudioCount(0);
    }

    function updateAudioCount() {
      setRemoteAudioCount(attachedAudio.size);
      setLiveKitStatus(attachedAudio.size > 0 ? "receiving" : "connected");
    }

    function attachAudioTrack(track: RemoteTrack) {
      if (track.kind !== "audio") return;
      if (attachedTracks.has(track)) return;
      attachedTracks.add(track);
      const element = track.attach() as HTMLMediaElement;
      element.autoplay = true;
      element.dataset.livekitAudio = "true";
      audioSinkRef.current?.appendChild(element);
      attachedAudio.add(element);
      updateAudioCount();
      void element.play().catch(() => {
        if (cancelled) return;
        setLiveKitStatus("action_required");
        setLiveKitNotice("Tap to enable room audio.");
      });
    }

    function detachAudioTrack(track: RemoteTrack) {
      track.detach().forEach((element) => {
        element.remove();
        attachedAudio.delete(element as HTMLMediaElement);
      });
      attachedTracks.delete(track);
      updateAudioCount();
    }

    function attachExistingAudio(room: LiveKitRoom) {
      room.remoteParticipants.forEach((participant) => {
        participant.trackPublications.forEach((publication) => {
          if (publication.isSubscribed && publication.track) {
            attachAudioTrack(publication.track);
          }
        });
      });
    }

    async function connectRoomAudio() {
      setLiveKitStatus("checking");
      setLiveKitNotice(null);
      try {
        const response = await fetch(
          `/api/viewer/session/${shareToken}/livekit-token`,
          { method: "POST" },
        );
        if (cancelled || runId !== liveKitRunRef.current) return;
        if (response.status === 503) {
          setLiveKitStatus("disabled");
          setLiveKitNotice("LiveKit is not configured.");
          return;
        }
        if (!response.ok) {
          throw new Error("LiveKit token request failed.");
        }

        const payload = (await response.json()) as LiveKitTokenResponse;
        if (!payload.ok) {
          throw new Error("LiveKit token request failed.");
        }

        const { Room, RoomEvent } = await import("livekit-client");
        if (cancelled || runId !== liveKitRunRef.current) return;
        const room = new Room({ adaptiveStream: true });
        liveKitRoomRef.current = room;

        room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
          attachAudioTrack(track);
        });
        room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
          detachAudioTrack(track);
        });
        room.on(RoomEvent.Reconnecting, () => {
          if (liveKitRoomRef.current === room) setLiveKitStatus("reconnecting");
        });
        room.on(RoomEvent.Reconnected, () => {
          if (liveKitRoomRef.current === room) updateAudioCount();
        });
        room.on(RoomEvent.Disconnected, () => {
          if (liveKitRoomRef.current === room) {
            liveKitRoomRef.current = null;
            clearAttachedAudio();
            setLiveKitStatus("error");
          }
        });

        await room.connect(payload.data.url, payload.data.token);
        if (cancelled || runId !== liveKitRunRef.current) {
          await room.disconnect(false);
          return;
        }
        attachExistingAudio(room);
        updateAudioCount();
      } catch {
        if (cancelled || runId !== liveKitRunRef.current) return;
        setLiveKitStatus("error");
        setLiveKitNotice("Room audio is unavailable.");
      }
    }

    void connectRoomAudio();

    return () => {
      cancelled = true;
      liveKitRunRef.current += 1;
      const room = liveKitRoomRef.current;
      liveKitRoomRef.current = null;
      clearAttachedAudio(false);
      if (room) {
        room.removeAllListeners();
        void room.disconnect(false).catch(() => undefined);
      }
    };
  }, [shareToken]);

  useEffect(() => {
    let cancelled = false;

    function applyPayload(payload: ViewerPayload) {
      if (cancelled) return;
      setSession(payload.session);
      if (payload.events.length) {
        lastSequenceRef.current = Math.max(
          lastSequenceRef.current,
          ...payload.events.map((event) => event.sequenceNo),
        );
        setEvents((current) => [...current, ...payload.events].slice(-20));
      }
      setSegments(payload.segments);
    }

    async function pollOnce() {
      try {
        const response = await fetch(
          `/api/viewer/session/${shareToken}/events?after=${lastSequenceRef.current}`,
          { cache: "no-store" },
        );
        if (!response.ok) throw new Error("Viewer poll failed.");
        const payload = await response.json();
        if (!payload.ok || cancelled) return;
        if (navigator.onLine) setConnectionMode("polling");
        applyPayload(payload.data as ViewerPayload);
      } catch {
        if (!cancelled) {
          setConnectionMode(navigator.onLine ? "reconnecting" : "offline");
        }
      }
    }

    function startPolling() {
      void pollOnce();
      return window.setInterval(() => void pollOnce(), 900);
    }

    let interval: number | null = null;
    let eventSource: EventSource | null = null;

    if ("EventSource" in window) {
      eventSource = new EventSource(
        `/api/viewer/session/${shareToken}/stream?after=${lastSequenceRef.current}`,
      );
      eventSource.onopen = () => {
        if (!cancelled && navigator.onLine) setConnectionMode("sse");
      };
      eventSource.addEventListener("snapshot", (event) => {
        if (navigator.onLine) setConnectionMode("sse");
        applyPayload(JSON.parse(event.data) as ViewerPayload);
      });
      eventSource.addEventListener("stream.error", () => {
        if (!cancelled) {
          setConnectionMode(navigator.onLine ? "reconnecting" : "offline");
        }
      });
      eventSource.onerror = () => {
        eventSource?.close();
        eventSource = null;
        if (!cancelled && interval == null) {
          setConnectionMode(navigator.onLine ? "reconnecting" : "offline");
          interval = startPolling();
        }
      };
    } else {
      interval = startPolling();
    }

    return () => {
      cancelled = true;
      eventSource?.close();
      if (interval != null) window.clearInterval(interval);
    };
  }, [shareToken]);

  const partial = useMemo(
    () =>
      [...events]
        .reverse()
        .find(
          (event) =>
            event.type === "partial_transcript" ||
            event.type === "partial_translation",
        ),
    [events],
  );
  const providerError = useMemo(
    () =>
      [...events].reverse().find((event) => event.type === "provider_error"),
    [events],
  );
  const latest = segments[segments.length - 1] ?? null;
  const activeTrackLabel =
    latest?.speakerLabel ??
    partial?.speakerLabel ??
    (latest?.trackId && latest.trackId !== "main"
      ? latest.trackId
      : partial?.trackId && partial.trackId !== "main"
        ? partial.trackId
        : null);
  const translation =
    latest?.translationText ?? partial?.text ?? "Waiting for captions...";
  const original =
    latest?.originalText ??
    partial?.text ??
    "Waiting for original transcript...";
  const showTranslation = viewMode !== "original";
  const showOriginal = viewMode !== "translation";
  const primaryLabel = showTranslation
    ? `Translation · ${session.targetLanguage}${activeTrackLabel ? ` · ${activeTrackLabel}` : ""}`
    : `Original${activeTrackLabel ? ` · ${activeTrackLabel}` : ""}`;
  const primaryText = showTranslation ? translation : original;
  const secondaryText = showTranslation && showOriginal ? original : null;
  const transcriptText = useMemo(() => {
    if (segments.length === 0) {
      return [
        showOriginal ? original : null,
        showTranslation ? translation : null,
      ]
        .filter(Boolean)
        .join("\n");
    }

    return segments
      .map((segment) =>
        [
          showOriginal ? segment.originalText : null,
          showTranslation ? segment.translationText : null,
        ]
          .filter(Boolean)
          .join("\n"),
      )
      .filter(Boolean)
      .join("\n\n");
  }, [original, segments, showOriginal, showTranslation, translation]);
  const isDark = theme === "dark";
  const borderSubtle = isDark ? "border-white/10" : "border-slate-200";
  const mutedText = isDark ? "text-white/55" : "text-slate-500";
  const softText = isDark ? "text-white/70" : "text-slate-600";
  const panelClass = isDark
    ? "border-white/10 bg-white/5 text-white/75"
    : "border-slate-200 bg-slate-50 text-slate-600";
  const controlClass = isDark
    ? "border-white/10 bg-white/10 text-white hover:bg-white/15"
    : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50";
  const selectedControlClass = isDark
    ? "bg-white text-slate-950"
    : "bg-slate-950 text-white";
  const liveKitStatusLabel: Record<ViewerLiveKitStatus, string> = {
    checking: "Audio checking",
    connected: "Audio ready",
    receiving: "Audio live",
    action_required: "Audio paused",
    disabled: "Audio off",
    reconnecting: "Audio reconnecting",
    error: "Audio unavailable",
  };

  async function copyVisibleTranscript() {
    setCopyStatus("idle");
    try {
      await navigator.clipboard.writeText(transcriptText);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }

  return (
    <main
      className={cn(
        "min-h-svh",
        isDark ? "bg-slate-950 text-white" : "bg-white text-slate-950",
      )}
    >
      <div className="mx-auto flex min-h-svh w-full max-w-5xl flex-col px-4 py-5 sm:px-6">
        <div ref={audioSinkRef} className="hidden" aria-hidden="true" />
        <header
          className={cn(
            "flex items-center justify-between gap-4 border-b pb-4",
            borderSubtle,
          )}
        >
          <div className="min-w-0">
            <p className={cn("truncate text-sm", mutedText)}>{session.title}</p>
            <h1 className="mt-1 truncate text-lg font-semibold">
              Live captions
            </h1>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
                borderSubtle,
                softText,
              )}
            >
              <Radio className="h-3.5 w-3.5" />
              {liveKitStatusLabel[liveKitStatus]}
              {remoteAudioCount > 0 ? ` · ${remoteAudioCount}` : ""}
            </span>
            <span
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-semibold",
                borderSubtle,
                softText,
              )}
            >
              {connectionMode === "sse"
                ? "SSE live"
                : connectionMode === "polling"
                  ? "Polling"
                  : connectionMode === "offline"
                    ? "Offline"
                    : connectionMode === "connecting"
                      ? "Connecting"
                      : "Reconnecting"}
            </span>
            <SessionStatusBadge status={session.status} />
          </div>
        </header>

        {connectionMode === "offline" ? (
          <div
            className={cn(
              "mt-4 rounded-md border px-4 py-3 text-sm",
              panelClass,
            )}
          >
            Network offline. Captions will reconnect when the connection
            returns.
          </div>
        ) : null}

        {providerError ? (
          <div className="mt-4 rounded-md border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            <p className="font-semibold">Provider issue</p>
            <p className="mt-1 text-amber-100/80">
              {providerError.text ??
                "Realtime captions are delayed. Local backup continues."}
            </p>
          </div>
        ) : null}

        {liveKitStatus === "action_required" ? (
          <div
            className={cn(
              "mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-3 text-sm",
              panelClass,
            )}
          >
            <span>{liveKitNotice ?? "Room audio is paused."}</span>
            <Button
              variant="secondary"
              onClick={() => void playAttachedRoomAudio()}
              className={controlClass}
            >
              <Volume2 className="h-4 w-4" />
              Enable audio
            </Button>
          </div>
        ) : liveKitNotice ? (
          <div
            className={cn(
              "mt-4 rounded-md border px-4 py-3 text-sm",
              panelClass,
            )}
          >
            {liveKitNotice}
          </div>
        ) : null}

        <section className="flex flex-1 flex-col justify-center py-8">
          <p
            className={cn(
              "text-xs font-semibold uppercase tracking-[0.18em]",
              isDark ? "text-white/45" : "text-slate-400",
            )}
          >
            {primaryLabel}
          </p>
          <p
            className={
              large
                ? "mt-5 text-balance text-5xl font-bold leading-tight tracking-normal sm:text-7xl"
                : "mt-5 text-balance text-3xl font-bold leading-tight tracking-normal sm:text-5xl"
            }
          >
            {primaryText}
          </p>
          {secondaryText ? (
            <div
              className={cn(
                "mt-8 border-l pl-4",
                isDark ? "border-white/20" : "border-slate-300",
              )}
            >
              <p
                className={cn(
                  "text-xs font-semibold uppercase tracking-[0.18em]",
                  isDark ? "text-white/45" : "text-slate-400",
                )}
              >
                Original
              </p>
              <p className={cn("mt-3 text-2xl leading-snug", softText)}>
                {secondaryText}
              </p>
            </div>
          ) : null}
        </section>

        <footer
          className={cn(
            "sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6",
            borderSubtle,
            isDark ? "bg-slate-950/95" : "bg-white/95",
          )}
        >
          <div className={cn("text-sm", mutedText)}>
            {segments.length} final segments
            {copyStatus === "copied" ? (
              <span className="ml-3 font-semibold">Copied.</span>
            ) : copyStatus === "failed" ? (
              <span className="ml-3 font-semibold">Copy failed.</span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div
              role="group"
              aria-label="Caption view"
              className={cn(
                "flex items-center rounded-md border p-1",
                borderSubtle,
              )}
            >
              <Languages
                className={cn("mx-2 h-4 w-4 shrink-0", softText)}
                aria-hidden="true"
              />
              {[
                ["translation", "Translation only"],
                ["both", "Both"],
                ["original", "Original only"],
              ].map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={viewMode === mode}
                  className={cn(
                    "h-9 rounded px-3 text-xs font-semibold transition",
                    viewMode === mode ? selectedControlClass : softText,
                  )}
                  onClick={() => {
                    setViewMode(mode as CaptionViewMode);
                    setCopyStatus("idle");
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <Button
              variant="secondary"
              onClick={() => void copyVisibleTranscript()}
              className={controlClass}
              aria-label="Copy visible transcript"
              title="Copy visible transcript"
            >
              <Copy className="h-4 w-4" />
              Copy
            </Button>
            <Button
              variant="secondary"
              onClick={() => setLarge((value) => !value)}
              className={controlClass}
              aria-label="Toggle caption size"
              title="Toggle caption size"
            >
              {large ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                setTheme((current) => (current === "dark" ? "light" : "dark"))
              }
              className={controlClass}
              aria-label={
                theme === "dark"
                  ? "Switch to light theme"
                  : "Switch to dark theme"
              }
              title={
                theme === "dark"
                  ? "Switch to light theme"
                  : "Switch to dark theme"
              }
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="secondary"
              onClick={() => window.location.reload()}
              className={controlClass}
              aria-label="Refresh captions"
              title="Refresh captions"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </footer>
      </div>
    </main>
  );
}
