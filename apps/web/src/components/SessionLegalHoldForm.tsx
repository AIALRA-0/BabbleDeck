"use client";

import { Save } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type LegalHoldResponse =
  | {
      ok: true;
      data: { session: { rawAudioLegalHold: boolean } };
    }
  | { ok: false };

export function SessionLegalHoldForm({
  sessionId,
  initialEnabled,
}: {
  sessionId: string;
  initialEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "failed">("idle");

  return (
    <form
      className="flex flex-col gap-3 rounded-lg border border-border bg-white p-4 shadow-sm"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setStatus("idle");
        const response = await fetch(`/api/sessions/${sessionId}/legal-hold`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawAudioLegalHold: enabled }),
        });
        setPending(false);
        const payload = (await response.json()) as LegalHoldResponse;
        if (!response.ok || !payload.ok) {
          setStatus("failed");
          return;
        }
        setEnabled(payload.data.session.rawAudioLegalHold);
        setStatus("saved");
      }}
    >
      <label className="flex items-start gap-3 text-sm font-semibold">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-input"
          checked={enabled}
          onChange={(event) => {
            setEnabled(event.target.checked);
            setStatus("idle");
          }}
        />
        <span>
          Legal hold
          <span className="mt-1 block font-normal text-muted-foreground">
            Keep raw audio for this session during retention cleanup.
          </span>
        </span>
      </label>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {status === "failed"
            ? "Could not save legal hold."
            : enabled
              ? "Raw audio protected."
              : "Raw audio follows retention policy."}
        </p>
        <Button size="sm" disabled={pending}>
          <Save className="h-4 w-4" />
          Save
        </Button>
      </div>
    </form>
  );
}
