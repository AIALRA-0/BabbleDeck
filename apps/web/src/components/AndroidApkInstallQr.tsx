"use client";

import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, ExternalLink, Smartphone } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const ANDROID_INSTALL_ROUTE = "/install/android";

export function androidApkInstallUrl(baseUrl: string) {
  const url = new URL("/login", baseUrl);
  url.searchParams.set("next", ANDROID_INSTALL_ROUTE);
  return url.toString();
}

export function AndroidApkInstallQr({ baseUrl }: { baseUrl: string }) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const installUrl = androidApkInstallUrl(baseUrl);

  return (
    <div className="mt-4 grid gap-4 rounded-md border border-border bg-muted/30 p-4 sm:grid-cols-[auto_minmax(0,1fr)]">
      <div className="rounded-md border border-border bg-white p-2">
        <QRCodeSVG value={installUrl} size={132} />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Android APK install QR</p>
        </div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Scan from Android, sign in, review the release, and download the APK.
        </p>
        <p className="mt-2 break-all text-xs text-muted-foreground">
          {installUrl}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild size="sm" variant="secondary">
            <a href={installUrl}>
              <ExternalLink className="h-4 w-4" />
              Open install link
            </a>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={async () => {
              try {
                await navigator.clipboard?.writeText(installUrl);
                setCopyStatus("copied");
              } catch {
                setCopyStatus("failed");
              }
            }}
          >
            {copyStatus === "copied" ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {copyStatus === "copied" ? "Copied" : "Copy install link"}
          </Button>
        </div>
        {copyStatus === "failed" ? (
          <p className="mt-2 text-xs font-medium text-red-700">Copy failed.</p>
        ) : null}
      </div>
    </div>
  );
}
