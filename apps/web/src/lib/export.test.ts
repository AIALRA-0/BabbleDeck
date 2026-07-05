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

  it("renders txt with timestamps and both text tracks", () => {
    const content = renderTranscriptExport(segments, {
      title: "Test session",
      format: "txt",
      includeOriginal: true,
      includeTranslation: true,
      includeTimestamps: true,
    });

    expect(content).toContain("[00:01 - 00:03]");
    expect(content).toContain("Hello everyone.");
    expect(content).toContain("大家好。");
  });

  it("renders json with title and segment payload", () => {
    expect(
      JSON.parse(
        renderTranscriptExport(segments, {
          title: "Test session",
          format: "json",
          includeOriginal: true,
          includeTranslation: true,
          includeTimestamps: true,
        }),
      ),
    ).toMatchObject({
      title: "Test session",
      segments: [
        { originalText: "Hello everyone.", translationText: "大家好。" },
      ],
    });
  });

  it("renders valid srt cues", () => {
    const content = renderTranscriptExport(segments, {
      title: "Test session",
      format: "srt",
      includeOriginal: true,
      includeTranslation: true,
      includeTimestamps: true,
    });

    expect(content).toContain("1\n00:00:01,000 --> 00:00:03,200");
    expect(content).toContain("Hello everyone.");
    expect(content).toContain("大家好。");
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
