import { describe, expect, test } from "vitest";
import {
  absoluteVerificationUrl,
  deviceVerificationSessionPayload,
} from "@/components/DeviceVerificationSessionLauncher";

describe("device verification session launcher", () => {
  test("builds a Soniox verification session payload for the current release", () => {
    expect(
      deviceVerificationSessionPayload({
        releaseCommit: "beb9bb7bc92d",
        targetLanguage: "zh",
        budgetCapUsd: 0.25,
        sonioxConfigured: true,
      }),
    ).toEqual({
      title: "Device verification · beb9bb7bc92d",
      description: "Runtime evidence session for release beb9bb7bc92d.",
      sourceLanguageMode: "auto",
      targetLanguage: "zh",
      providerName: "soniox",
      qualityMode: "realtime",
      budgetCapUsd: 0.25,
    });
  });

  test("falls back to mock provider when Soniox is unavailable", () => {
    expect(
      deviceVerificationSessionPayload({
        releaseCommit: null,
        targetLanguage: "en",
        budgetCapUsd: 1,
        sonioxConfigured: false,
      }),
    ).toMatchObject({
      title: "Device verification · current",
      providerName: "mock",
      targetLanguage: "en",
    });
  });

  test("builds absolute recorder URLs for cross-device handoff", () => {
    expect(
      absoluteVerificationUrl(
        "/sessions/session-1/record?share=share-token&recorder=recorder-token",
        "https://babbledeck.aialra.online",
      ),
    ).toBe(
      "https://babbledeck.aialra.online/sessions/session-1/record?share=share-token&recorder=recorder-token",
    );
  });
});
