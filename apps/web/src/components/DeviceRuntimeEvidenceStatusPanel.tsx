import { Download, Smartphone } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  DeviceRuntimeEvidenceSource,
  DeviceRuntimeEvidenceStatusReason,
  DeviceRuntimeEvidenceStatusSummary,
} from "@/server/device-runtime-evidence";
import type { WrapperArtifact } from "@/server/wrapper-artifacts";

const platformLabels = {
  android: "Android",
  ios: "iOS",
  desktop: "Desktop",
} as const;

const reasonLabels: Record<DeviceRuntimeEvidenceStatusReason, string> = {
  verified: "Current release verified",
  missing: "No evidence recorded",
  failed: "Latest record did not pass",
  release_mismatch: "Latest record is for another release",
  base_url_mismatch: "Latest record is for another URL",
  checks_incomplete: "Latest record is missing checks",
  invalid_timestamp: "Latest record timestamp is invalid",
  stale: "Latest record is stale",
};

const sourceLabels: Record<DeviceRuntimeEvidenceSource, string> = {
  admin_settings: "Settings",
  recorder_page: "Recorder",
  session_history: "Session history",
};

function formatDateTime(value: string | null) {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function DeviceRuntimeEvidenceStatusPanel({
  summary,
  androidDebugApk,
}: {
  summary: DeviceRuntimeEvidenceStatusSummary;
  androidDebugApk?: WrapperArtifact;
}) {
  return (
    <div className="border-b border-border p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold">Current release status</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Evidence must match this production release and stay within{" "}
            {summary.maxAgeHours} hours.
          </p>
        </div>
        <Badge tone={summary.ok ? "green" : "amber"}>
          {summary.ok ? "Complete" : "Missing evidence"}
        </Badge>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild variant="secondary">
          <Link href="/api/device-runtime-evidence/checklist" prefetch={false}>
            <Download className="h-4 w-4" />
            Download checklist
          </Link>
        </Button>
        {androidDebugApk?.exists ? (
          <Button asChild variant="secondary">
            <Link href="/api/wrappers/android-debug-apk" prefetch={false}>
              <Smartphone className="h-4 w-4" />
              Download Android APK
            </Link>
          </Button>
        ) : (
          <Button disabled variant="secondary">
            <Smartphone className="h-4 w-4" />
            Android APK missing
          </Button>
        )}
      </div>
      {androidDebugApk ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {androidDebugApk.exists
            ? `Android APK ready · ${Math.round((androidDebugApk.sizeBytes ?? 0) / 1024 / 1024)} MB · ${androidDebugApk.sha256?.slice(0, 12)}`
            : "Build the Android wrapper before physical device verification."}
        </p>
      ) : null}
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase text-muted-foreground">
            Release
          </dt>
          <dd className="mt-1 font-medium">
            {summary.releaseCommit ?? "Unavailable"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-muted-foreground">
            Base URL
          </dt>
          <dd className="mt-1 break-all font-medium">{summary.baseUrl}</dd>
        </div>
      </dl>
      {!summary.logExists ||
      summary.unreadable ||
      summary.invalidLineCount > 0 ? (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
          {!summary.logExists
            ? "Evidence log has not been created yet."
            : summary.unreadable
              ? "Evidence log could not be read."
              : `${summary.invalidLineCount} evidence log line${summary.invalidLineCount === 1 ? "" : "s"} could not be parsed.`}
        </p>
      ) : null}
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {summary.platforms.map((item) => {
          const recordedAt = formatDateTime(item.recordedAt);
          return (
            <div
              key={item.platform}
              className="rounded-md border border-border p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {platformLabels[item.platform]}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {reasonLabels[item.reason]}
                  </p>
                </div>
                <Badge tone={item.ok ? "green" : "neutral"}>
                  {item.ok ? "Verified" : "Missing"}
                </Badge>
              </div>
              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                <p>{recordedAt ? `Recorded ${recordedAt}` : "Not recorded"}</p>
                <p>
                  {item.source
                    ? `Source ${sourceLabels[item.source]}`
                    : "Source unavailable"}
                </p>
                <p>
                  {item.releaseCommit
                    ? `Release ${item.releaseCommit}`
                    : "Release unavailable"}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
