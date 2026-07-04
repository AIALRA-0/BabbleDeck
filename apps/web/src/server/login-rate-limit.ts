import { checkRateLimit, type RateLimitResult } from "@/server/rate-limit";

const WINDOW_MS = 60_000;

type LoginRateLimitResult = RateLimitResult & {
  scope?: "ip" | "account";
};

function minuteLimit(name: string, fallback: number) {
  const value = Number(process.env[name]);
  if (!Number.isFinite(value) || value < 1) return fallback;
  return Math.floor(value);
}

export function checkLoginRateLimit(input: {
  ip: string;
  email: string;
}): LoginRateLimitResult {
  const ipLimit = minuteLimit("LOGIN_IP_RATE_LIMIT_PER_MINUTE", 25);
  const accountLimit = minuteLimit("LOGIN_RATE_LIMIT_PER_MINUTE", 5);
  const ipResult = checkRateLimit(`login:ip:${input.ip}`, ipLimit, WINDOW_MS);
  if (!ipResult.allowed) return { ...ipResult, scope: "ip" };

  const accountResult = checkRateLimit(
    `login:account:${input.ip}:${input.email.toLowerCase()}`,
    accountLimit,
    WINDOW_MS,
  );
  if (!accountResult.allowed) return { ...accountResult, scope: "account" };

  return { allowed: true, retryAfterSeconds: 0 };
}
