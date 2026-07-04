import { describe, expect, it } from "vitest";
import { renderTranscriptExport } from "./export";

const segments = [
  {
    index: 0,
    startMs: 1000,
    endMs: 3200,
    originalText: "Hello everyone.",
    translationText: "大家好。",
    targetLanguage: "zh",
  },
];

describe("renderTranscriptExport", () => {
  it("renders markdown with original and translation", () => {
    expect(
      renderTranscriptExport(segments, {
        title: "Test session",
        format: "markdown",
        includeOriginal: true,
        includeTranslation: true,
        includeTimestamps: true,
      }),
    ).toContain("大家好。");
  });

  it("renders valid webvtt header", () => {
    expect(
      renderTranscriptExport(segments, {
        title: "Test session",
        format: "vtt",
        includeOriginal: true,
        includeTranslation: true,
        includeTimestamps: true,
      }).startsWith("WEBVTT"),
    ).toBe(true);
  });
});
