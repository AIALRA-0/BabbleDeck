import { describe, expect, test } from "vitest";
import {
  legalHoldMetadata,
  rawAudioLegalHold,
} from "@/server/settings-service";

describe("settings service", () => {
  test("reads and writes raw audio legal hold metadata", () => {
    const metadata = legalHoldMetadata({}, true, "user-1");

    expect(rawAudioLegalHold(metadata)).toBe(true);
    expect(metadata).toMatchObject({
      rawAudioLegalHold: true,
      rawAudioLegalHoldUpdatedByUserId: "user-1",
    });
  });

  test("treats missing legal hold metadata as disabled", () => {
    expect(rawAudioLegalHold({})).toBe(false);
    expect(rawAudioLegalHold({ rawAudioLegalHold: false })).toBe(false);
  });
});
