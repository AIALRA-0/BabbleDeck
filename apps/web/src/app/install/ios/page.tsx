import { ShieldCheck, Smartphone } from "lucide-react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { DeviceVerificationSessionLauncher } from "@/components/DeviceVerificationSessionLauncher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/server/auth";
import { getDefaultSessionSettings } from "@/server/settings-service";

export default async function IosInstallPage() {
  await requireUser();
  const defaultSession = await getDefaultSessionSettings();
  const releaseCommit = process.env.BABBLEDECK_RELEASE_COMMIT ?? "current";
  const releaseBuiltAt = process.env.BABBLEDECK_RELEASE_BUILT_AT ?? null;

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <div className="border-b border-border pb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            iOS verification
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-normal">
            BabbleDeck iOS wrapper
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Prepare a release-bound recorder link for an iOS wrapper run from a
            macOS/Xcode host.
          </p>
        </div>

        <section className="mt-6 rounded-lg border border-border bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-md border border-border bg-muted">
                <Smartphone className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <h2 className="font-semibold">Current iOS target</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Release {releaseCommit}
                </p>
              </div>
            </div>
            <Badge tone="neutral">Mac required</Badge>
          </div>

          <dl className="grid gap-4 border-b border-border p-5 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase text-muted-foreground">
                Wrapper source
              </dt>
              <dd className="mt-1 font-medium">Capacitor iOS project</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-muted-foreground">
                Built
              </dt>
              <dd className="mt-1 font-medium">
                {releaseBuiltAt ?? "Unavailable"}
              </dd>
            </div>
          </dl>

          <div className="space-y-4 p-5">
            <div className="flex gap-3 text-sm text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                This page is protected by the admin session. Run the iOS wrapper
                from macOS with Xcode, then record evidence only after
                microphone, captions, and audio backup are confirmed.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/settings">Back to verification</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-border bg-white shadow-sm">
          <DeviceVerificationSessionLauncher
            releaseCommit={releaseCommit}
            targetLanguage={defaultSession.targetLanguage}
            budgetCapUsd={defaultSession.budgetCapUsd}
            sonioxConfigured={Boolean(process.env.SONIOX_API_KEY)}
          />
          <div className="p-5 text-sm leading-6 text-muted-foreground">
            The recorder link opens on the iOS device and includes the
            release-bound evidence form. Use it from the wrapper session after
            confirming the production URL, real microphone, captions, and audio
            backup path.
          </div>
        </section>
      </main>
    </>
  );
}
