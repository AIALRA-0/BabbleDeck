"use client";

import { Loader2, Radio } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { storeSessionTokens } from "@/features/recorder/session-tokens";

type CreateSessionResponse =
  | {
      ok: true;
      data: {
        session: { id: string; recordUrl: string };
        shareToken: string;
        recorderToken: string;
      };
    }
  | { ok: false };

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
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
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
            router.push(payload.data.session.recordUrl);
          }}
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Radio className="h-4 w-4" />
          )}
          Start verification session
        </Button>
      </div>
      {error ? (
        <p className="mt-3 text-sm font-medium text-red-700">{error}</p>
      ) : null}
    </div>
  );
}
