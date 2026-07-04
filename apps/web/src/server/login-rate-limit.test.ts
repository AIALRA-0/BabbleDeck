import { afterEach, describe, expect, test } from "vitest";
import { checkLoginRateLimit } from "@/server/login-rate-limit";
import { resetRateLimitsForTest } from "@/server/rate-limit";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  resetRateLimitsForTest();
});

describe("login rate limiting", () => {
  test("limits repeated attempts for the same ip and account", () => {
    process.env.LOGIN_RATE_LIMIT_PER_MINUTE = "2";
    process.env.LOGIN_IP_RATE_LIMIT_PER_MINUTE = "10";

    expect(
      checkLoginRateLimit({ ip: "203.0.113.10", email: "Admin@Example.com" }),
    ).toMatchObject({ allowed: true });
    expect(
      checkLoginRateLimit({ ip: "203.0.113.10", email: "admin@example.com" }),
    ).toMatchObject({ allowed: true });
    expect(
      checkLoginRateLimit({ ip: "203.0.113.10", email: "admin@example.com" }),
    ).toMatchObject({
      allowed: false,
      scope: "account",
    });
  });

  test("limits total attempts from one ip across changing emails", () => {
    process.env.LOGIN_RATE_LIMIT_PER_MINUTE = "10";
    process.env.LOGIN_IP_RATE_LIMIT_PER_MINUTE = "2";

    expect(
      checkLoginRateLimit({ ip: "203.0.113.20", email: "one@example.com" }),
    ).toMatchObject({ allowed: true });
    expect(
      checkLoginRateLimit({ ip: "203.0.113.20", email: "two@example.com" }),
    ).toMatchObject({ allowed: true });
    expect(
      checkLoginRateLimit({ ip: "203.0.113.20", email: "three@example.com" }),
    ).toMatchObject({
      allowed: false,
      scope: "ip",
    });
  });

  test("falls back to safe defaults for invalid env values", () => {
    process.env.LOGIN_RATE_LIMIT_PER_MINUTE = "not-a-number";
    process.env.LOGIN_IP_RATE_LIMIT_PER_MINUTE = "0";

    expect(
      checkLoginRateLimit({ ip: "203.0.113.30", email: "one@example.com" }),
    ).toMatchObject({ allowed: true });
  });
});
