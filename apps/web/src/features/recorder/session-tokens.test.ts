import { describe, expect, test } from "vitest";
import {
  parseStoredSessionTokens,
  readStoredSessionTokens,
  sessionTokenStorageKey,
  shareTokenFromViewerUrl,
  storeSessionTokens,
  viewerPathForShareToken,
} from "@/features/recorder/session-tokens";

function fakeStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe("session token browser cache", () => {
  test("stores and reads valid one-time session tokens", () => {
    const sessionStorage = fakeStorage();
    const localStorage = fakeStorage();
    const sessionId = "session-1";

    storeSessionTokens(
      sessionId,
      {
        shareToken: "share_token_1234567890",
        recorderToken: "recorder_token_1234567890",
      },
      [sessionStorage, localStorage],
    );

    expect(
      parseStoredSessionTokens(
        localStorage.getItem(sessionTokenStorageKey(sessionId)),
      ),
    ).toMatchObject({
      shareToken: "share_token_1234567890",
      recorderToken: "recorder_token_1234567890",
    });
    expect(readStoredSessionTokens(sessionId, [sessionStorage])).toMatchObject({
      shareToken: "share_token_1234567890",
      recorderToken: "recorder_token_1234567890",
    });
  });

  test("restores a share token from persistent storage when session storage is empty", () => {
    const sessionStorage = fakeStorage();
    const localStorage = fakeStorage();
    const sessionId = "session-2";

    storeSessionTokens(
      sessionId,
      { shareToken: "share_token_abcdefghijklmnopqrstuvwxyz" },
      [localStorage],
    );

    expect(
      readStoredSessionTokens(sessionId, [sessionStorage, localStorage]),
    ).toMatchObject({
      shareToken: "share_token_abcdefghijklmnopqrstuvwxyz",
    });
  });

  test("extracts share tokens from relative and absolute viewer URLs", () => {
    expect(shareTokenFromViewerUrl("/s/share_token_1234567890")).toBe(
      "share_token_1234567890",
    );
    expect(
      shareTokenFromViewerUrl(
        "https://babbledeck.example/s/share_token_abcdefghij",
      ),
    ).toBe("share_token_abcdefghij");
    expect(shareTokenFromViewerUrl("/sessions/session-1/record")).toBeNull();
    expect(viewerPathForShareToken("share_token_1234567890")).toBe(
      "/s/share_token_1234567890",
    );
  });
});
