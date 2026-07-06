"use client";

import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, ExternalLink, Loader2, Radio } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { storeSessionTokens } from "@/features/recorder/session-tokens";

type CreateSessionResponse =
  | {
      ok: true;
      data: {
        session: { id: string; title: string; recordUrl: string };
        shareToken: string;
        recorderToken: string;
      };
    }
  | { ok: false };

type CreatedVerificationSession = {
  id: string;
  title: string;
  recorderUrl: string;
};

export function deviceVerificationSessionPayload(input: {
  releaseCommit: string | null;
  targetLanguage: string;
  budgetCapUsd: number;
  sonioxConfigured: boolean;
}) {
  const release = input.releaseCommit?.slice(0, 12) || "current";
  return {
    title: `Device verification · ${release}`,
    description: `Runtime evidence session for release ${release}.`,
    sourceLanguageMode: "auto",
    targetLanguage: input.targetLanguage,
    providerName: input.sonioxConfigured ? "soniox" : "mock",
    qualityMode: "realtime",
    budgetCapUsd: input.budgetCapUsd,
  };
}

export function absoluteVerificationUrl(recordUrl: string, origin: string) {
  try {
    return new URL(recordUrl, origin).toString();
  } catch {
    return recordUrl;
  }
}

export function DeviceVerificationSessionLauncher({
  releaseCommit,
  targetLanguage,
  budgetCapUsd,
  sonioxConfigured,
}: {
  releaseCommit: string | null;
  targetLanguage: string;
  budgetCapUsd: number;
  sonioxConfigured: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const [created, setCreated] = useState<CreatedVerificationSession | null>(
    null,
  );
  const providerLabel = sonioxConfigured ? "Soniox realtime" : "Mock realtime";
  const release = releaseCommit?.slice(0, 12) ?? "current release";

  return (
    <div className="border-b border-border p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold">Verification session</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {providerLabel} · {targetLanguage} · {release}
          </p>
        </div>
        <Button
          type="button"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            setError("");
            setCopyStatus("idle");
            const response = await fetch("/api/sessions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(
                deviceVerificationSessionPayload({
                  releaseCommit,
                  targetLanguage,
                  budgetCapUsd,
                  sonioxConfigured,
                }),
              ),
            });
            setPending(false);
            const payload = (await response
              .json()
              .catch(() => null)) as CreateSessionResponse | null;
            if (!response.ok || !payload?.ok) {
              setError("Verification session could not be created.");
              return;
            }
            storeSessionTokens(payload.data.session.id, {
              shareToken: payload.data.shareToken,
              recorderToken: payload.data.recorderToken,
            });
            setCreated({
              id: payload.data.session.id,
              title: payload.data.session.title,
              recorderUrl: absoluteVerificationUrl(
                payload.data.session.recordUrl,
                window.location.origin,
              ),
            });
          }}
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Radio className="h-4 w-4" />
          )}
          Create verification link
        </Button>
      </div>
      {created ? (
        <div className="mt-4 grid gap-4 rounded-md border border-border bg-muted/30 p-4 sm:grid-cols-[auto_minmax(0,1fr)]">
          <div className="rounded-md border border-border bg-white p-2">
            <QRCodeSVG value={created.recorderUrl} size={132} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{created.title}</p>
            <p className="mt-1 break-all text-xs text-muted-foreground">
              {created.recorderUrl}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild size="sm" variant="secondary">
                <a href={created.recorderUrl}>
                  <ExternalLink className="h-4 w-4" />
                  Open recorder
                </a>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard?.writeText(created.recorderUrl);
                    setCopyStatus("copied");
                  } catch {
                    setCopyStatus("failed");
                  }
                }}
              >
                {copyStatus === "copied" ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copyStatus === "copied" ? "Copied" : "Copy recorder link"}
              </Button>
            </div>
            {copyStatus === "failed" ? (
              <p className="mt-2 text-xs font-medium text-red-700">
                Copy failed.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm font-medium text-red-700">{error}</p>
      ) : null}
    </div>
  );
}
