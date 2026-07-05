"use client";

import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SerializedGlossaryTerm } from "@/server/settings-service";

type GlossaryResponse =
  { ok: true; data: { term: SerializedGlossaryTerm } } | { ok: false };

type Draft = {
  sourceTerm: string;
  targetTerm: string;
  sourceLanguage: string;
  targetLanguage: string;
  notes: string;
  enabled: boolean;
};

function draftFromTerm(term: SerializedGlossaryTerm): Draft {
  return {
    sourceTerm: term.sourceTerm,
    targetTerm: term.targetTerm,
    sourceLanguage: term.sourceLanguage ?? "",
    targetLanguage: term.targetLanguage,
    notes: term.notes ?? "",
    enabled: term.enabled,
  };
}

function emptyDraft(): Draft {
  return {
    sourceTerm: "",
    targetTerm: "",
    sourceLanguage: "",
    targetLanguage: "zh",
    notes: "",
    enabled: true,
  };
}

function requestBody(draft: Draft) {
  return {
    sourceTerm: draft.sourceTerm,
    targetTerm: draft.targetTerm,
    sourceLanguage: draft.sourceLanguage || null,
    targetLanguage: draft.targetLanguage,
    notes: draft.notes || null,
    enabled: draft.enabled,
  };
}

export function GlossarySettingsForm({
  initialTerms,
}: {
  initialTerms: SerializedGlossaryTerm[];
}) {
  const [terms, setTerms] = useState(initialTerms);
  const [drafts, setDrafts] = useState(
    Object.fromEntries(
      initialTerms.map((term) => [term.id, draftFromTerm(term)]),
    ),
  );
  const [newDraft, setNewDraft] = useState(emptyDraft());
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [status, setStatus] = useState<
    "idle" | "created" | "saved" | "deleted" | "failed"
  >("idle");

  function updateDraft(id: string, patch: Partial<Draft>) {
    setDrafts((current) => ({
      ...current,
      [id]: { ...current[id], ...patch },
    }));
    setStatus("idle");
  }

  function upsertTerm(term: SerializedGlossaryTerm) {
    setTerms((current) => {
      const rest = current.filter((item) => item.id !== term.id);
      return [term, ...rest].sort((left, right) => {
        if (left.enabled !== right.enabled) return left.enabled ? -1 : 1;
        return right.updatedAt.localeCompare(left.updatedAt);
      });
    });
    setDrafts((current) => ({
      ...current,
      [term.id]: draftFromTerm(term),
    }));
  }

  async function createTerm() {
    setPendingId("new");
    setStatus("idle");
    const response = await fetch("/api/settings/glossary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody(newDraft)),
    });
    setPendingId(null);
    const payload = (await response.json()) as GlossaryResponse;
    if (!response.ok || !payload.ok) {
      setStatus("failed");
      return;
    }
    upsertTerm(payload.data.term);
    setNewDraft(emptyDraft());
    setStatus("created");
  }

  async function saveTerm(id: string) {
    const draft = drafts[id];
    if (!draft) return;
    setPendingId(id);
    setStatus("idle");
    const response = await fetch(`/api/settings/glossary/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody(draft)),
    });
    setPendingId(null);
    const payload = (await response.json()) as GlossaryResponse;
    if (!response.ok || !payload.ok) {
      setStatus("failed");
      return;
    }
    upsertTerm(payload.data.term);
    setStatus("saved");
  }

  async function deleteTerm(id: string) {
    setPendingId(id);
    setStatus("idle");
    const response = await fetch(`/api/settings/glossary/${id}`, {
      method: "DELETE",
    });
    setPendingId(null);
    const payload = (await response.json()) as GlossaryResponse;
    if (!response.ok || !payload.ok) {
      setStatus("failed");
      return;
    }
    setTerms((current) => current.filter((term) => term.id !== id));
    setDrafts((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setStatus("deleted");
  }

  return (
    <div className="space-y-5 p-5">
      <form
        className="grid gap-4 lg:grid-cols-[1fr_1fr_120px_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          void createTerm();
        }}
      >
        <div>
          <label
            htmlFor="newSourceTerm"
            className="mb-2 block text-sm font-semibold"
          >
            Source term
          </label>
          <Input
            id="newSourceTerm"
            value={newDraft.sourceTerm}
            onChange={(event) =>
              setNewDraft((current) => ({
                ...current,
                sourceTerm: event.target.value,
              }))
            }
            required
          />
        </div>
        <div>
          <label
            htmlFor="newTargetTerm"
            className="mb-2 block text-sm font-semibold"
          >
            Preferred translation
          </label>
          <Input
            id="newTargetTerm"
            value={newDraft.targetTerm}
            onChange={(event) =>
              setNewDraft((current) => ({
                ...current,
                targetTerm: event.target.value,
              }))
            }
            required
          />
        </div>
        <div>
          <label
            htmlFor="newTargetLanguage"
            className="mb-2 block text-sm font-semibold"
          >
            Language
          </label>
          <Input
            id="newTargetLanguage"
            value={newDraft.targetLanguage}
            onChange={(event) =>
              setNewDraft((current) => ({
                ...current,
                targetLanguage: event.target.value,
              }))
            }
            required
          />
        </div>
        <div className="flex items-end">
          <Button disabled={pendingId === "new"}>
            {pendingId === "new" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Add
          </Button>
        </div>
      </form>

      {status !== "idle" ? (
        <p className="text-sm font-medium text-muted-foreground">
          {status === "created"
            ? "Glossary term added."
            : status === "saved"
              ? "Glossary term saved."
              : status === "deleted"
                ? "Glossary term deleted."
                : "Glossary change failed."}
        </p>
      ) : null}

      <div className="divide-y divide-border rounded-md border border-border">
        {terms.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            No glossary terms yet.
          </p>
        ) : null}
        {terms.map((term) => {
          const draft = drafts[term.id] ?? draftFromTerm(term);
          const pending = pendingId === term.id;
          return (
            <form
              key={term.id}
              className="grid gap-3 p-4 lg:grid-cols-[1fr_1fr_120px_auto_auto]"
              onSubmit={(event) => {
                event.preventDefault();
                void saveTerm(term.id);
              }}
            >
              <div>
                <label
                  htmlFor={`sourceTerm-${term.id}`}
                  className="mb-2 block text-xs font-semibold uppercase text-muted-foreground"
                >
                  Source
                </label>
                <Input
                  id={`sourceTerm-${term.id}`}
                  value={draft.sourceTerm}
                  onChange={(event) =>
                    updateDraft(term.id, { sourceTerm: event.target.value })
                  }
                  required
                />
              </div>
              <div>
                <label
                  htmlFor={`targetTerm-${term.id}`}
                  className="mb-2 block text-xs font-semibold uppercase text-muted-foreground"
                >
                  Translation
                </label>
                <Input
                  id={`targetTerm-${term.id}`}
                  value={draft.targetTerm}
                  onChange={(event) =>
                    updateDraft(term.id, { targetTerm: event.target.value })
                  }
                  required
                />
              </div>
              <div>
                <label
                  htmlFor={`targetLanguage-${term.id}`}
                  className="mb-2 block text-xs font-semibold uppercase text-muted-foreground"
                >
                  Language
                </label>
                <Input
                  id={`targetLanguage-${term.id}`}
                  value={draft.targetLanguage}
                  onChange={(event) =>
                    updateDraft(term.id, { targetLanguage: event.target.value })
                  }
                  required
                />
              </div>
              <label className="flex items-end gap-2 pb-3 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={(event) =>
                    updateDraft(term.id, { enabled: event.target.checked })
                  }
                  className="h-4 w-4 rounded border-border"
                />
                Enabled
              </label>
              <div className="flex items-end gap-2">
                <Button size="sm" disabled={pending}>
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={pending}
                  onClick={() => void deleteTerm(term.id)}
                  aria-label={`Delete ${term.sourceTerm}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </form>
          );
        })}
      </div>
    </div>
  );
}
