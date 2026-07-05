import { describe, expect, test } from "vitest";
import { isSuspiciousProbePath } from "./suspicious-probe";

describe("suspicious probe path detection", () => {
  test.each([
    "/.env",
    "/%2eenv",
    "/.git/config",
    "/wp-config.php",
    "/phpinfo.php",
    "/config.php.bak",
    "/config.json",
    "/aws.config.js",
    "/%22/_next/static/chunks/app.js%22",
  ])("flags scanner path %s", (pathname) => {
    expect(isSuspiciousProbePath(pathname)).toBe(true);
  });

  test.each([
    "/",
    "/login",
    "/sessions/new",
    "/api/health",
    "/_next/static/chunks/app.js",
    "/.well-known/acme-challenge/token",
  ])("allows expected app path %s", (pathname) => {
    expect(isSuspiciousProbePath(pathname)).toBe(false);
  });
});
