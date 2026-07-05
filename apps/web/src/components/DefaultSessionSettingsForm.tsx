"use client";

import { Loader2, Save } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SettingsResponse =
  | {
      ok: true;
      data: {
        defaultTargetLanguage: string;
        defaultBudgetCapUsd: number;
      };
    }
  | { ok: false };

export function DefaultSessionSettingsForm({
  initialTargetLanguage,
  initialBudgetCapUsd,
}: {
  initialTargetLanguage: string;
  initialBudgetCapUsd: number;
}) {
  const [targetLanguage, setTargetLanguage] = useState(initialTargetLanguage);
  const [budgetCapUsd, setBudgetCapUsd] = useState(String(initialBudgetCapUsd));
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "failed">("idle");

  return (
    <form
      className="grid gap-4 p-5 sm:grid-cols-[1fr_1fr_auto]"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setStatus("idle");
        const response = await fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            defaultTargetLanguage: targetLanguage,
            defaultBudgetCapUsd: Number(budgetCapUsd),
          }),
        });
        setPending(false);
        const payload = (await response.json()) as SettingsResponse;
        if (!response.ok || !payload.ok) {
          setStatus("failed");
          return;
        }
        setTargetLanguage(payload.data.defaultTargetLanguage);
        setBudgetCapUsd(String(payload.data.defaultBudgetCapUsd));
        setStatus("saved");
      }}
    >
      <div>
        <label
          htmlFor="defaultTargetLanguage"
          className="mb-2 block text-sm font-semibold"
        >
          Default target language
        </label>
        <select
          id="defaultTargetLanguage"
          className="focus-ring h-11 w-full rounded-md border border-input bg-white px-3 text-sm"
          value={targetLanguage}
          onChange={(event) => {
            setTargetLanguage(event.target.value);
            setStatus("idle");
          }}
        >
          <option value="zh">Chinese</option>
          <option value="en">English</option>
          <option value="ja">Japanese</option>
          <option value="ko">Korean</option>
          <option value="es">Spanish</option>
        </select>
      </div>
      <div>
        <label
          htmlFor="defaultBudgetCapUsd"
          className="mb-2 block text-sm font-semibold"
        >
          Default budget cap
        </label>
        <Input
          id="defaultBudgetCapUsd"
          type="number"
          step="0.0001"
          min="0.0001"
          max="100"
          value={budgetCapUsd}
          onChange={(event) => {
            setBudgetCapUsd(event.target.value);
            setStatus("idle");
          }}
          required
        />
      </div>
      <div className="flex items-end gap-3">
        <Button disabled={pending}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save
        </Button>
        {status !== "idle" ? (
          <span className="text-sm font-medium text-muted-foreground">
            {status === "saved" ? "Saved." : "Save failed."}
          </span>
        ) : null}
      </div>
    </form>
  );
}
