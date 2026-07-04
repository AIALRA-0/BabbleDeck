"use client";

import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CreateSessionResponse = {
  ok: true;
  data: {
    session: { id: string; recordUrl: string };
    shareToken: string;
    recorderToken: string;
  };
};

export function NewSessionForm() {
  const router = useRouter();
  const [title, setTitle] = useState("Live caption session");
  const [targetLanguage, setTargetLanguage] = useState("zh");
  const [providerName, setProviderName] = useState("mock");
  const [budgetCapUsd, setBudgetCapUsd] = useState("1.50");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <form
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        const response = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            targetLanguage,
            sourceLanguageMode: "auto",
            providerName,
            qualityMode: "realtime",
            budgetCapUsd: Number(budgetCapUsd),
          }),
        });
        setPending(false);
        const payload = (await response.json()) as
          CreateSessionResponse | { ok: false };
        if (!response.ok || !payload.ok) {
          setError(
            "Session could not be created. Check the form and try again.",
          );
          return;
        }
        sessionStorage.setItem(
          `babbledeck:${payload.data.session.id}:tokens`,
          JSON.stringify({
            shareToken: payload.data.shareToken,
            recorderToken: payload.data.recorderToken,
          }),
        );
        router.push(payload.data.session.recordUrl);
      }}
    >
      <div>
        <label htmlFor="title" className="mb-2 block text-sm font-semibold">
          Title
        </label>
        <Input
          id="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="targetLanguage"
            className="mb-2 block text-sm font-semibold"
          >
            Target language
          </label>
          <select
            id="targetLanguage"
            className="focus-ring h-11 w-full rounded-md border border-input bg-white px-3 text-sm"
            value={targetLanguage}
            onChange={(event) => setTargetLanguage(event.target.value)}
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
            htmlFor="providerName"
            className="mb-2 block text-sm font-semibold"
          >
            Provider
          </label>
          <select
            id="providerName"
            className="focus-ring h-11 w-full rounded-md border border-input bg-white px-3 text-sm"
            value={providerName}
            onChange={(event) => setProviderName(event.target.value)}
          >
            <option value="mock">Mock realtime</option>
            <option value="soniox">Soniox realtime</option>
          </select>
        </div>
      </div>
      <div>
        <label
          htmlFor="budgetCapUsd"
          className="mb-2 block text-sm font-semibold"
        >
          Budget cap
        </label>
        <Input
          id="budgetCapUsd"
          type="number"
          step="0.01"
          min="0.01"
          value={budgetCapUsd}
          onChange={(event) => setBudgetCapUsd(event.target.value)}
        />
      </div>
      {error ? (
        <p className="text-sm font-medium text-red-700">{error}</p>
      ) : null}
      <Button disabled={pending}>
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
        Create session
      </Button>
    </form>
  );
}
