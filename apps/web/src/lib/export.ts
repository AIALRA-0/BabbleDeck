export type ExportSegment = {
  index: number;
  trackId?: string;
  speakerLabel?: string | null;
  startMs: number | null;
  endMs: number | null;
  originalText: string;
  translationText: string | null;
  targetLanguage: string | null;
};

export type ExportOptions = {
  title: string;
  format: "markdown" | "txt" | "json" | "srt" | "vtt";
  includeOriginal: boolean;
  includeTranslation: boolean;
  includeTimestamps: boolean;
};

function timestamp(ms: number | null) {
  if (ms == null) return "00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function subtitleTimestamp(ms: number | null, separator: "," | ".") {
  const safeMs = Math.max(0, ms ?? 0);
  const hours = Math.floor(safeMs / 3_600_000);
  const minutes = Math.floor((safeMs % 3_600_000) / 60_000);
  const seconds = Math.floor((safeMs % 60_000) / 1000);
  const millis = safeMs % 1000;
  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(
      2,
      "0",
    )}:${seconds.toString().padStart(2, "0")}${separator}${millis
    .toString()
    .padStart(3, "0")}`;
}

function segmentLines(segment: ExportSegment, options: ExportOptions) {
  const lines: string[] = [];
  if (options.includeTimestamps) {
    lines.push(`[${timestamp(segment.startMs)} - ${timestamp(segment.endMs)}]`);
  }
  if (segment.speakerLabel || (segment.trackId && segment.trackId !== "main")) {
    lines.push(segment.speakerLabel ?? `Track ${segment.trackId}`);
  }
  if (options.includeOriginal) lines.push(segment.originalText);
  if (options.includeTranslation && segment.translationText)
    lines.push(segment.translationText);
  return lines;
}

export function renderTranscriptExport(
  segments: ExportSegment[],
  options: ExportOptions,
) {
  if (options.format === "json") {
    return JSON.stringify({ title: options.title, segments }, null, 2);
  }

  if (options.format === "srt" || options.format === "vtt") {
    const separator = options.format === "srt" ? "," : ".";
    const body = segments
      .map((segment, index) => {
        const endMs = segment.endMs ?? (segment.startMs ?? 0) + 2500;
        const cue = [
          options.format === "srt" ? String(index + 1) : "",
          `${subtitleTimestamp(segment.startMs, separator)} --> ${subtitleTimestamp(endMs, separator)}`,
          ...segmentLines(segment, { ...options, includeTimestamps: false }),
        ].filter(Boolean);
        return cue.join("\n");
      })
      .join("\n\n");
    return options.format === "vtt" ? `WEBVTT\n\n${body}\n` : `${body}\n`;
  }

  if (options.format === "markdown") {
    return [
      `# ${options.title}`,
      "",
      ...segments.flatMap((segment) => [
        `## Segment ${segment.index + 1}`,
        segment.speakerLabel || (segment.trackId && segment.trackId !== "main")
          ? `Track: ${segment.speakerLabel ?? segment.trackId}`
          : "",
        "",
        ...segmentLines(segment, options),
        "",
      ]),
    ].join("\n");
  }

  return segments
    .map((segment) => segmentLines(segment, options).join("\n"))
    .join("\n\n");
}
