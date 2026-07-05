import { describe, expect, test } from "vitest";
import {
  requestIdFromHeaders,
  requestLogRecord,
  validRequestId,
} from "./request-id";

function headers(value?: string) {
  return new Headers(value ? { "x-request-id": value } : {});
}

describe("request correlation IDs", () => {
  test("accepts UUID request IDs", () => {
    expect(validRequestId("123e4567-e89b-42d3-a456-426614174000")).toBe(true);
  });

  test("rejects non-UUID request IDs", () => {
    expect(validRequestId("../not-safe")).toBe(false);
    expect(validRequestId("123")).toBe(false);
  });

  test("preserves valid incoming IDs and generates replacements", () => {
    const incoming = "123e4567-e89b-42d3-a456-426614174000";
    expect(requestIdFromHeaders(headers(incoming))).toBe(incoming);
    expect(validRequestId(requestIdFromHeaders(headers("invalid")))).toBe(true);
  });

  test("builds structured request log records", () => {
    expect(
      requestLogRecord({
        requestId: "123e4567-e89b-42d3-a456-426614174000",
        method: "GET",
        path: "/dashboard",
        search: "?a=1",
        ip: "127.0.0.1",
        userAgent: "vitest",
      }),
    ).toMatchObject({
      app: "babbledeck",
      event: "http.request",
      requestId: "123e4567-e89b-42d3-a456-426614174000",
      method: "GET",
      path: "/dashboard",
      search: "?a=1",
      ip: "127.0.0.1",
      userAgent: "vitest",
    });
  });
});
