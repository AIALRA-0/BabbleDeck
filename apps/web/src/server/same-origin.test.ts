import { describe, expect, test } from "vitest";
import {
  requestOrigin,
  validateSameOriginMutation,
} from "@/server/same-origin";

function request(headers: HeadersInit) {
  return new Request("https://babbledeck.aialra.online/api/sessions", {
    method: "POST",
    headers,
  });
}

describe("same-origin mutation guard", () => {
  test("allows same-origin browser mutations", () => {
    expect(
      validateSameOriginMutation(
        request({
          origin: "https://babbledeck.aialra.online",
          "sec-fetch-site": "same-origin",
        }),
      ),
    ).toEqual({ allowed: true });
  });

  test("rejects cross-site browser mutations", () => {
    expect(
      validateSameOriginMutation(
        request({
          origin: "https://attacker.example",
          "sec-fetch-site": "cross-site",
        }),
      ),
    ).toMatchObject({ allowed: false });
  });

  test("uses forwarded proto and host for deployed origin checks", () => {
    const proxied = new Request("http://127.0.0.1:11970/api/sessions", {
      method: "POST",
      headers: {
        host: "babbledeck.aialra.online",
        origin: "https://babbledeck.aialra.online",
        "x-forwarded-proto": "https",
      },
    });

    expect(requestOrigin(proxied)).toBe("https://babbledeck.aialra.online");
    expect(validateSameOriginMutation(proxied)).toEqual({ allowed: true });
  });

  test("allows non-browser operational clients without origin metadata", () => {
    expect(validateSameOriginMutation(request({}))).toEqual({ allowed: true });
  });
});
