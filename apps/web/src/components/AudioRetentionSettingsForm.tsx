"use client";

import { Save } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SettingsResponse =
  | {
      ok: true;
      data: { audioRetentionDays: number };
    }
  | { ok: false };

export function AudioRetentionSettingsForm({
  initialDays,
}: {
  initialDays: number;
}) {
  const [days, setDays] = useState(String(initialDays));
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "failed">("idle");

  return (
    <form
      className="grid gap-4 p-5 sm:grid-cols-[1fr_auto]"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setStatus("idle");
        const response = await fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audioRetentionDays: Number(days) }),
        });
        setPending(false);
        const payload = (await response.json()) as SettingsResponse;
        if (!response.ok || !payload.ok) {
          setStatus("failed");
          return;
        }
        setDays(String(payload.data.audioRetentionDays));
        setStatus("saved");
      }}
    >
      <div>
        <label
          htmlFor="audioRetentionDays"
          className="mb-2 block text-sm font-semibold"
        >
          Raw audio retention
        </label>
        <Input
          id="audioRetentionDays"
          type="number"
          min="1"
          max="3650"
          value={days}
          onChange={(event) => {
            setDays(event.target.value);
            setStatus("idle");
          }}
        />
        <p className="mt-2 text-sm text-muted-foreground">
          {status === "saved"
            ? "Saved."
            : status === "failed"
              ? "Could not save retention."
              : "Days before ended sessions become eligible for raw audio cleanup."}
        </p>
      </div>
      <div className="flex items-end">
        <Button disabled={pending}>
          <Save className="h-4 w-4" />
          Save
        </Button>
      </div>
    </form>
  );
}
