import { describe, expect, test } from "vitest";
import { clientIpFromHeaders } from "@/server/client-ip";

describe("client ip parsing", () => {
  test("prefers x-real-ip from the trusted reverse proxy", () => {
    const headers = new Headers({
      "x-forwarded-for": "198.51.100.10, 203.0.113.20",
      "x-real-ip": "203.0.113.20",
    });

    expect(clientIpFromHeaders(headers)).toBe("203.0.113.20");
  });

  test("uses the proxy-appended x-forwarded-for address when x-real-ip is absent", () => {
    const headers = new Headers({
      "x-forwarded-for": "198.51.100.10, 203.0.113.20",
    });

    expect(clientIpFromHeaders(headers)).toBe("203.0.113.20");
  });

  test("falls back to localhost for requests without proxy headers", () => {
    expect(clientIpFromHeaders(new Headers())).toBe("127.0.0.1");
  });
});
