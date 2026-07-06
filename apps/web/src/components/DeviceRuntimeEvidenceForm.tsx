"use client";

import { CheckCircle2, Loader2, Mic, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/utils";

type Platform = "android" | "ios" | "desktop";
type EvidenceSource = "admin_settings" | "recorder_page" | "session_history";

type CheckName =
  | "productionUrlOpened"
  | "microphoneGranted"
  | "recordingStarted"
  | "captionsVisible"
  | "audioBackupConfirmed";

type EvidenceResponse =
  | {
      ok: true;
      data: {
        recordedAt: string;
        platform: Platform;
        source: EvidenceSource;
        sessionId: string | null;
        release: { commit: string };
      };
    }
  | { ok: false };

type EvidenceReceipt = Extract<EvidenceResponse, { ok: true }>["data"];

const checkLabels: { name: CheckName; label: string }[] = [
  { name: "productionUrlOpened", label: "Production URL opened" },
  { name: "microphoneGranted", label: "Microphone granted" },
  { name: "recordingStarted", label: "Recording started" },
  { name: "captionsVisible", label: "Captions visible" },
  { name: "audioBackupConfirmed", label: "Audio backup confirmed" },
];

const defaultChecks: Record<CheckName, boolean> = {
  productionUrlOpened: true,
  microphoneGranted: false,
  recordingStarted: false,
  captionsVisible: false,
  audioBackupConfirmed: false,
};

const platformLabels: Record<Platform, string> = {
  android: "Android",
  ios: "iOS",
  desktop: "Desktop",
};

const sourceLabels: Record<EvidenceSource, string> = {
  admin_settings: "Settings",
  recorder_page: "Recorder",
  session_history: "Session history",
};

function clientSnapshot() {
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    ("standalone" in window.navigator &&
      Boolean(
        (window.navigator as Navigator & { standalone?: boolean }).standalone,
      ));
  return {
    reportedUserAgent: window.navigator.userAgent,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    displayMode: standalone ? "standalone" : "browser",
    language: window.navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

function detectRuntimePlatform(): Platform {
  const userAgent = window.navigator.userAgent;
  if (/android/i.test(userAgent)) return "android";
  if (/iphone|ipad|ipod/i.test(userAgent)) return "ios";
  return "desktop";
}

export function DeviceRuntimeEvidenceForm({
  releaseCommit,
  releaseBuiltAt,
  source = "admin_settings",
  observedChecks,
  detectPlatform = false,
  initialNotes = "",
  notesPlaceholder = "Release-bound wrapper runtime notes",
  className = "space-y-5 p-5",
  recorderAuth,
}: {
  releaseCommit: string | null;
  releaseBuiltAt: string | null;
  source?: EvidenceSource;
  observedChecks?: Partial<Record<CheckName, boolean>>;
  detectPlatform?: boolean;
  initialNotes?: string;
  notesPlaceholder?: string;
  className?: string;
  recorderAuth?: { sessionId: string; recorderToken?: string | null };
}) {
  const [platform, setPlatform] = useState<Platform>("android");
  const [checks, setChecks] =
    useState<Record<CheckName, boolean>>(defaultChecks);
  const [notes, setNotes] = useState(initialNotes);
  const [pending, setPending] = useState(false);
  const [micPending, setMicPending] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "saved" | "failed" | "mic-failed"
  >("idle");
  const [receipt, setReceipt] = useState<EvidenceReceipt | null>(null);

  const allChecks = useMemo(
    () => checkLabels.every((item) => checks[item.name]),
    [checks],
  );

  useEffect(() => {
    if (detectPlatform) setPlatform(detectRuntimePlatform());
  }, [detectPlatform]);

  useEffect(() => {
    if (!observedChecks) return;
    setChecks((current) => {
      let changed = false;
      const next = { ...current };
      for (const item of checkLabels) {
        if (observedChecks[item.name] === true && !next[item.name]) {
          next[item.name] = true;
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [observedChecks]);

  async function verifyMicrophone() {
    setMicPending(true);
    setStatus("idle");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      for (const track of stream.getTracks()) track.stop();
      setChecks((current) => ({ ...current, microphoneGranted: true }));
    } catch {
      setStatus("mic-failed");
    } finally {
      setMicPending(false);
    }
  }

  return (
    <form
      className={className}
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setStatus("idle");
        setReceipt(null);
        const response = await fetch("/api/device-runtime-evidence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            platform,
            source,
            passed: allChecks,
            checks,
            notes,
            recorderSessionId: recorderAuth?.sessionId,
            recorderToken: recorderAuth?.recorderToken ?? undefined,
            client: clientSnapshot(),
          }),
        });
        setPending(false);
        const payload = (await response.json()) as EvidenceResponse;
        if (response.ok && payload.ok) {
          setReceipt(payload.data);
          setStatus("saved");
        } else {
          setStatus("failed");
        }
      }}
    >
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <label
            htmlFor="devicePlatform"
            className="mb-2 block text-sm font-semibold"
          >
            Platform
          </label>
          <select
            id="devicePlatform"
            className="focus-ring h-11 w-full rounded-md border border-input bg-white px-3 text-sm"
            value={platform}
            onChange={(event) => {
              setPlatform(event.target.value as Platform);
              setStatus("idle");
            }}
          >
            <option value="android">Android</option>
            <option value="ios">iOS</option>
            <option value="desktop">Desktop</option>
          </select>
        </div>
        <div className="flex items-end">
          <Button
            type="button"
            variant="secondary"
            disabled={micPending}
            onClick={verifyMicrophone}
          >
            {micPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
            Check mic
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {checkLabels.map((item) => (
          <label
            key={item.name}
            className="flex min-h-11 items-center gap-3 rounded-md border border-border px-3 py-2 text-sm font-medium"
          >
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={checks[item.name]}
              onChange={(event) => {
                setChecks((current) => ({
                  ...current,
                  [item.name]: event.target.checked,
                }));
                setStatus("idle");
              }}
            />
            {item.label}
          </label>
        ))}
      </div>

      <div>
        <label
          htmlFor="deviceEvidenceNotes"
          className="mb-2 block text-sm font-semibold"
        >
          Notes
        </label>
        <Input
          id="deviceEvidenceNotes"
          value={notes}
          maxLength={300}
          placeholder={notesPlaceholder}
          onChange={(event) => {
            setNotes(event.target.value);
            setStatus("idle");
          }}
        />
      </div>

      {receipt ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
          <p className="font-semibold">Evidence receipt</p>
          <dl className="mt-2 grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase text-emerald-800">
                Recorded
              </dt>
              <dd className="mt-1">{formatDateTime(receipt.recordedAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-emerald-800">
                Platform
              </dt>
              <dd className="mt-1">{platformLabels[receipt.platform]}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-emerald-800">
                Release
              </dt>
              <dd className="mt-1 break-all">{receipt.release.commit}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-emerald-800">
                Source
              </dt>
              <dd className="mt-1">{sourceLabels[receipt.source]}</dd>
            </div>
            {receipt.sessionId ? (
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold uppercase text-emerald-800">
                  Session
                </dt>
                <dd className="mt-1 break-all">{receipt.sessionId}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={pending || !allChecks || !releaseCommit}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : status === "saved" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Record evidence
        </Button>
        <span className="text-sm text-muted-foreground">
          {status === "saved"
            ? "Evidence recorded."
            : status === "failed"
              ? "Evidence was not recorded."
              : status === "mic-failed"
                ? "Microphone check failed."
                : releaseCommit
                  ? `Release ${releaseCommit}${releaseBuiltAt ? ` · ${releaseBuiltAt}` : ""}`
                  : "Release metadata unavailable."}
        </span>
      </div>
    </form>
  );
}
