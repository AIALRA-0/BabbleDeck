import { describe, expect, test } from "vitest";
import { androidApkInstallUrl } from "@/components/AndroidApkInstallQr";

describe("android APK install QR", () => {
  test("builds a login-gated Android APK download URL", () => {
    expect(androidApkInstallUrl("https://babbledeck.aialra.online")).toBe(
      "https://babbledeck.aialra.online/login?next=%2Fapi%2Fwrappers%2Fandroid-debug-apk",
    );
  });
});
