import { afterEach, describe, expect, test } from "vitest";
import {
  estimateAudioCostUsd,
  providerAudioHourRateUsd,
} from "@/server/provider-usage";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("provider usage", () => {
  test("uses zero-cost mock audio by default", () => {
    expect(providerAudioHourRateUsd("MOCK", "realtime")).toBe(0);
    expect(
      estimateAudioCostUsd({
        providerName: "MOCK",
        qualityMode: "realtime",
        audioMs: 60_000,
      }).toNumber(),
    ).toBe(0);
  });

  test("estimates configured provider audio cost", () => {
    process.env.PROVIDER_COST_SONIOX_REALTIME_AUDIO_HOUR_USD = "0.72";
    expect(providerAudioHourRateUsd("SONIOX", "realtime")).toBe(0.72);
    expect(
      estimateAudioCostUsd({
        providerName: "SONIOX",
        qualityMode: "realtime",
        audioMs: 30 * 60 * 1000,
      }).toNumber(),
    ).toBeCloseTo(0.36);
  });
});
