import { describe, expect, test } from "vitest";
import {
  isEndedBeforeRetentionCutoff,
  resolveAudioRetentionDays,
  retentionCutoff,
} from "@/server/audio-retention";

describe("audio retention", () => {
  test("resolves retention days from safe positive values", () => {
    expect(resolveAudioRetentionDays("14")).toBe(14);
    expect(resolveAudioRetentionDays(1.9)).toBe(1);
    expect(resolveAudioRetentionDays("0", 30)).toBe(30);
    expect(resolveAudioRetentionDays("not-a-number", 30)).toBe(30);
  });

  test("matches only ended sessions before the retention cutoff", () => {
    const now = new Date("2026-07-04T12:00:00.000Z");
    const cutoff = retentionCutoff(now, 30);

    expect(cutoff.toISOString()).toBe("2026-06-04T12:00:00.000Z");
    expect(
      isEndedBeforeRetentionCutoff(
        new Date("2026-06-04T11:59:59.999Z"),
        cutoff,
      ),
    ).toBe(true);
    expect(isEndedBeforeRetentionCutoff(cutoff, cutoff)).toBe(false);
    expect(isEndedBeforeRetentionCutoff(null, cutoff)).toBe(false);
  });
});
