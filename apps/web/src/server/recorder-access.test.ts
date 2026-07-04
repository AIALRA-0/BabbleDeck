import { describe, expect, test } from "vitest";
import {
  RECORDER_TOKEN_HEADER,
  recorderTokenFromHeaders,
} from "./recorder-access";

function headers(values: Record<string, string>) {
  return {
    get: (name: string) => values[name.toLowerCase()] ?? null,
  };
}

describe("recorder access helpers", () => {
  test("reads a bearer recorder token before fallback headers", () => {
    expect(
      recorderTokenFromHeaders(
        headers({
          authorization: "Bearer recorder_token_1234567890",
          [RECORDER_TOKEN_HEADER]: "recorder_token_header_1234567890",
        }),
      ),
    ).toBe("recorder_token_1234567890");
  });

  test("reads recorder tokens from header or query parameters", () => {
    expect(
      recorderTokenFromHeaders(
        headers({
          [RECORDER_TOKEN_HEADER]: "recorder_token_header_1234567890",
        }),
      ),
    ).toBe("recorder_token_header_1234567890");
    expect(
      recorderTokenFromHeaders(
        headers({}),
        new URLSearchParams("recorder=recorder_token_query_1234567890"),
      ),
    ).toBe("recorder_token_query_1234567890");
  });

  test("rejects malformed recorder tokens", () => {
    expect(
      recorderTokenFromHeaders(headers({ authorization: "Bearer short" })),
    ).toBeNull();
    expect(
      recorderTokenFromHeaders(
        headers({ [RECORDER_TOKEN_HEADER]: "../not-a-token" }),
      ),
    ).toBeNull();
  });
});
