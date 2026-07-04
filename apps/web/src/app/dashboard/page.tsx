import Link from "next/link";
import { Plus, Radio } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { SessionStatusBadge } from "@/components/SessionStatusBadge";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatDuration } from "@/lib/utils";
import { requireUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { serializeSession } from "@/server/serializers";

export default async function DashboardPage() {
  const user = await requireUser();
  const rows = await prisma.liveSession.findMany({
    where: { ownerUserId: user.id, archivedAt: null },
    include: {
      audioChunks: true,
      providerUsage: true,
      transcriptSegments: { include: { translations: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 25,
  });
  const sessions = rows.map((session) => serializeSession(session));

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Dashboard
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-normal">
              Live sessions
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Create a recorder link, share a viewer link, then export the saved
              transcript.
            </p>
          </div>
          <Button asChild>
            <Link href="/sessions/new">
              <Plus className="h-4 w-4" /> New live session
            </Link>
          </Button>
        </div>

        {sessions.length === 0 ? (
          <div className="mt-8 rounded-lg border border-dashed border-border bg-white p-8 text-center">
            <Radio className="mx-auto h-8 w-8 text-muted-foreground" />
            <h2 className="mt-4 text-xl font-semibold">
              Create your first live session.
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              It takes less than a minute to open a recorder and viewer page.
            </p>
            <Button asChild className="mt-5">
              <Link href="/sessions/new">New live session</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-lg border border-border bg-white">
            <div className="grid grid-cols-[1.2fr_0.7fr_0.6fr_0.9fr] gap-4 border-b border-border bg-muted/40 px-4 py-3 text-xs font-semibold uppercase text-muted-foreground max-md:hidden">
              <span>Session</span>
              <span>Status</span>
              <span>Language</span>
              <span>Created</span>
            </div>
            {sessions.map((session) => (
              <Link
                key={session.id}
                href={`/sessions/${session.id}`}
                className="grid gap-3 border-b border-border px-4 py-4 transition hover:bg-muted/30 md:grid-cols-[1.2fr_0.7fr_0.6fr_0.9fr] md:items-center"
              >
                <div>
                  <p className="font-semibold">{session.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {session.transcriptSegmentCount} segments ·{" "}
                    {session.backup.uploadedChunks} chunks ·{" "}
                    {formatDuration(session.usage.audioMs)} audio
                  </p>
                </div>
                <SessionStatusBadge status={session.status} />
                <p className="text-sm">{session.targetLanguage}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDateTime(session.createdAt)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
