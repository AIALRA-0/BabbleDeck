import { Download, ShieldCheck, Smartphone } from "lucide-react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/server/auth";
import { getAndroidDebugApkArtifact } from "@/server/wrapper-artifacts";

function formatBytes(value?: number) {
  if (!value) return "Unavailable";
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export default async function AndroidInstallPage() {
  await requireUser();
  const artifact = await getAndroidDebugApkArtifact();
  const releaseCommit = process.env.BABBLEDECK_RELEASE_COMMIT ?? "current";
  const releaseBuiltAt = process.env.BABBLEDECK_RELEASE_BUILT_AT ?? null;

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <div className="border-b border-border pb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Android install
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-normal">
            BabbleDeck wrapper
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Install the server-built Android wrapper for the current production
            release.
          </p>
        </div>

        <section className="mt-6 rounded-lg border border-border bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-md border border-border bg-muted">
                <Smartphone className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <h2 className="font-semibold">Current APK</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Release {releaseCommit}
                </p>
              </div>
            </div>
            <Badge tone={artifact.exists ? "green" : "amber"}>
              {artifact.exists ? "Ready" : "Missing"}
            </Badge>
          </div>

          <dl className="grid gap-4 border-b border-border p-5 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase text-muted-foreground">
                Size
              </dt>
              <dd className="mt-1 font-medium">
                {formatBytes(artifact.sizeBytes)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-muted-foreground">
                Built
              </dt>
              <dd className="mt-1 font-medium">
                {releaseBuiltAt ?? "Unavailable"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold uppercase text-muted-foreground">
                SHA-256
              </dt>
              <dd className="mt-1 break-all font-mono text-xs">
                {artifact.sha256 ?? "Unavailable"}
              </dd>
            </div>
          </dl>

          <div className="space-y-4 p-5">
            <div className="flex gap-3 text-sm text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                This page is protected by the admin session. After installing,
                open a release verification recorder link on the device and
                record evidence only after microphone, captions, and audio
                backup are confirmed.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {artifact.exists ? (
                <Button asChild>
                  <Link href="/api/wrappers/android-debug-apk" prefetch={false}>
                    <Download className="h-4 w-4" />
                    Download APK
                  </Link>
                </Button>
              ) : (
                <Button disabled>
                  <Download className="h-4 w-4" />
                  APK missing
                </Button>
              )}
              <Button asChild variant="secondary">
                <Link href="/settings">Back to verification</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
