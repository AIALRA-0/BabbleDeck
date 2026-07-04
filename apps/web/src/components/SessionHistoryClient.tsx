"use client";

import { Download, FileJson, FileText, Subtitles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type Segment = {
  id: string;
  index: number;
  startMs: number | null;
  endMs: number | null;
  originalText: string;
  translationText: string | null;
};

export function SessionHistoryClient({
  sessionId,
  segments,
}: {
  sessionId: string;
  segments: Segment[];
}) {
  const [pending, setPending] = useState<string | null>(null);

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
          {segments.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">
              No transcript segments yet.
            </p>
          ) : (
            segments.map((segment) => (
              <article key={segment.id} className="p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Segment {segment.index + 1}
                </p>
                <p className="mt-3 text-lg font-semibold leading-7">
                  {segment.originalText}
                </p>
                {segment.translationText ? (
                  <p className="mt-2 text-2xl font-bold leading-tight">
                    {segment.translationText}
                  </p>
                ) : null}
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
