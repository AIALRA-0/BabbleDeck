"use client";

import {
  Download,
  Edit3,
  FileJson,
  FileText,
  Save,
  Subtitles,
  X,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";

type Segment = {
  id: string;
  index: number;
  startMs: number | null;
  endMs: number | null;
  originalText: string;
  translationText: string | null;
  editedAt: string | null;
};

type SegmentUpdateResponse =
  | {
      ok: true;
      data: { segment: Segment };
    }
  | { ok: false };

export function SessionHistoryClient({
  sessionId,
  segments,
}: {
  sessionId: string;
  segments: Segment[];
}) {
  const [items, setItems] = useState(segments);
  const [pending, setPending] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    originalText: "",
    translationText: "",
  });
  const [editStatus, setEditStatus] = useState<
    "idle" | "saving" | "saved" | "failed"
  >("idle");

  function startEdit(segment: Segment) {
    setEditingId(segment.id);
    setDraft({
      originalText: segment.originalText,
      translationText: segment.translationText ?? "",
    });
    setEditStatus("idle");
  }

  async function saveEdit(segmentId: string) {
    setEditStatus("saving");
    const response = await fetch(
      `/api/sessions/${sessionId}/segments/${segmentId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalText: draft.originalText,
          translationText: draft.translationText,
        }),
      },
    );
    const payload = (await response.json()) as SegmentUpdateResponse;
    if (!response.ok || !payload.ok) {
      setEditStatus("failed");
      return;
    }
    setItems((current) =>
      current.map((segment) =>
        segment.id === payload.data.segment.id ? payload.data.segment : segment,
      ),
    );
    setEditingId(null);
    setEditStatus("saved");
  }

  async function exportFormat(
    format: "markdown" | "txt" | "json" | "srt" | "vtt",
  ) {
    setPending(format);
    const response = await fetch(`/api/sessions/${sessionId}/exports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        format,
        includeOriginal: true,
        includeTranslation: true,
        includeTimestamps: true,
      }),
    });
    const payload = await response.json();
    setPending(null);
    if (!payload.ok) return;
    window.location.href = payload.data.downloadUrl;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="rounded-lg border border-border bg-white shadow-sm">
        <div className="border-b border-border p-5">
          <h2 className="text-lg font-semibold">Transcript timeline</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Final segments are exportable and safe to review after recording
            ends.
          </p>
        </div>
        <div className="divide-y divide-border">
          {items.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">
              No transcript segments yet.
            </p>
          ) : (
            items.map((segment) => (
              <article key={segment.id} className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Segment {segment.index + 1}
                    </p>
                    {segment.editedAt ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Edited {formatDateTime(segment.editedAt)}
                      </p>
                    ) : null}
                  </div>
                  {editingId === segment.id ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => void saveEdit(segment.id)}
                        disabled={
                          editStatus === "saving" ||
                          draft.originalText.trim().length === 0
                        }
                      >
                        <Save className="h-4 w-4" />
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingId(null);
                          setEditStatus("idle");
                        }}
                        disabled={editStatus === "saving"}
                      >
                        <X className="h-4 w-4" />
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => startEdit(segment)}
                    >
                      <Edit3 className="h-4 w-4" />
                      Edit
                    </Button>
                  )}
                </div>
                {editingId === segment.id ? (
                  <div className="mt-4 grid gap-3">
                    <label className="grid gap-2 text-sm font-semibold">
                      Original
                      <textarea
                        className="min-h-28 rounded-md border border-input bg-white px-3 py-2 text-base leading-6 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                        value={draft.originalText}
                        onChange={(event) => {
                          setDraft((current) => ({
                            ...current,
                            originalText: event.target.value,
                          }));
                          setEditStatus("idle");
                        }}
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-semibold">
                      Translation
                      <textarea
                        className="min-h-28 rounded-md border border-input bg-white px-3 py-2 text-base leading-6 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                        value={draft.translationText}
                        onChange={(event) => {
                          setDraft((current) => ({
                            ...current,
                            translationText: event.target.value,
                          }));
                          setEditStatus("idle");
                        }}
                      />
                    </label>
                    {editStatus === "failed" ? (
                      <p className="text-sm font-medium text-red-700">
                        Could not save correction.
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <p className="mt-3 text-lg font-semibold leading-7">
                      {segment.originalText}
                    </p>
                    {segment.translationText ? (
                      <p className="mt-2 text-2xl font-bold leading-tight">
                        {segment.translationText}
                      </p>
                    ) : null}
                  </>
                )}
              </article>
            ))
          )}
        </div>
      </section>
      <aside className="rounded-lg border border-border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Export</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Generate a fresh export from final transcript segments.
        </p>
        <div className="mt-5 grid gap-2">
          <Button
            variant="secondary"
            onClick={() => void exportFormat("markdown")}
            disabled={Boolean(pending)}
          >
            <FileText className="h-4 w-4" /> Markdown
          </Button>
          <Button
            variant="secondary"
            onClick={() => void exportFormat("txt")}
            disabled={Boolean(pending)}
          >
            <Download className="h-4 w-4" /> TXT
          </Button>
          <Button
            variant="secondary"
            onClick={() => void exportFormat("json")}
            disabled={Boolean(pending)}
          >
            <FileJson className="h-4 w-4" /> JSON
          </Button>
          <Button
            variant="secondary"
            onClick={() => void exportFormat("srt")}
            disabled={Boolean(pending)}
          >
            <Subtitles className="h-4 w-4" /> SRT
          </Button>
          <Button
            variant="secondary"
            onClick={() => void exportFormat("vtt")}
            disabled={Boolean(pending)}
          >
            <Subtitles className="h-4 w-4" /> VTT
          </Button>
        </div>
        {pending ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Preparing {pending} export...
          </p>
        ) : null}
      </aside>
    </div>
  );
}
