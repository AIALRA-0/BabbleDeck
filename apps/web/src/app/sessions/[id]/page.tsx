import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
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
        <div className="mt-6 grid gap-3 sm:grid-cols-5">
          {[
            ["Target", serialized.targetLanguage],
            ["Provider", serialized.providerName],
            ["Backup chunks", String(serialized.backup.uploadedChunks)],
            ["Audio processed", formatDuration(serialized.usage.audioMs)],
            ["Cost", `$${serialized.estimatedCostUsd.toFixed(4)}`],
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
          <SessionHistoryClient sessionId={serialized.id} segments={segments} />
        </div>
      </main>
    </>
  );
}
