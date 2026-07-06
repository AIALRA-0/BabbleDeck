import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { DeviceRuntimeEvidenceForm } from "@/components/DeviceRuntimeEvidenceForm";
import { SessionLegalHoldForm } from "@/components/SessionLegalHoldForm";
import { SessionHistoryClient } from "@/components/SessionHistoryClient";
import { SessionStatusBadge } from "@/components/SessionStatusBadge";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatDuration } from "@/lib/utils";
import { requireUser } from "@/server/auth";
import { getSessionForAdmin } from "@/server/session-service";
import { serializeSegment, serializeSession } from "@/server/serializers";

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const session = await getSessionForAdmin(id, user.id);
  if (!session) notFound();
  const serialized = serializeSession(session);
  const segments = session.transcriptSegments.map(serializeSegment);
  const releaseCommit = process.env.BABBLEDECK_RELEASE_COMMIT ?? null;
  const releaseBuiltAt = process.env.BABBLEDECK_RELEASE_BUILT_AT ?? null;

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              History
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-normal">
              {serialized.title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <SessionStatusBadge status={serialized.status} />
              <span className="text-sm text-muted-foreground">
                Created {formatDateTime(serialized.createdAt)}
              </span>
            </div>
          </div>
          <Button asChild variant="secondary">
            <Link href={`/sessions/${serialized.id}/record`}>
              Open recorder
            </Link>
          </Button>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-6">
          {[
            ["Target", serialized.targetLanguage],
            ["Provider", serialized.providerName],
            ["Backup chunks", String(serialized.backup.uploadedChunks)],
            ["Audio processed", formatDuration(serialized.usage.audioMs)],
            ["Cost", `$${serialized.estimatedCostUsd.toFixed(4)}`],
            ["Legal hold", serialized.rawAudioLegalHold ? "On" : "Off"],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg border border-border bg-white p-4 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                {label}
              </p>
              <p className="mt-2 text-lg font-semibold">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-6">
          <SessionLegalHoldForm
            sessionId={serialized.id}
            initialEnabled={serialized.rawAudioLegalHold}
          />
        </div>
        <section className="mt-6 rounded-lg border border-border bg-white shadow-sm">
          <div className="border-b border-border p-5">
            <h2 className="font-semibold">Device evidence</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Record release-bound runtime evidence from this session device.
            </p>
          </div>
          <DeviceRuntimeEvidenceForm
            releaseCommit={releaseCommit}
            releaseBuiltAt={releaseBuiltAt}
            source="session_history"
            detectPlatform
            observedChecks={{
              productionUrlOpened: true,
              recordingStarted: Boolean(serialized.startedAt),
              captionsVisible: segments.length > 0,
              audioBackupConfirmed: serialized.backup.uploadedChunks > 0,
            }}
            initialNotes={`Session history · ${serialized.id}`}
            notesPlaceholder="Device, wrapper, and completed session notes"
          />
        </section>
        <div className="mt-6">
          <SessionHistoryClient sessionId={serialized.id} segments={segments} />
        </div>
      </main>
    </>
  );
}
