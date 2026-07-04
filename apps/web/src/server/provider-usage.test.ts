import { Prisma } from "@prisma/client";
import { afterEach, describe, expect, test } from "vitest";
import {
  estimateAudioCostUsd,
  providerAudioHourRateUsd,
  shouldDegradeForBudgetCap,
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

  test("flags active sessions once provider usage reaches the budget cap", () => {
    expect(
      shouldDegradeForBudgetCap({
        budgetCapUsd: new Prisma.Decimal("0.0001"),
        estimatedCostUsd: new Prisma.Decimal("0.0001"),
        status: "RECORDING",
      }),
    ).toBe(true);
    expect(
      shouldDegradeForBudgetCap({
        budgetCapUsd: new Prisma.Decimal("0.0001"),
        estimatedCostUsd: new Prisma.Decimal("0.0100"),
        status: "COMPLETED",
      }),
    ).toBe(false);
  });
});
