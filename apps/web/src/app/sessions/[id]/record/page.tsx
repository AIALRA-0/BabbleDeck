import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { RecorderClient } from "@/components/RecorderClient";
import { getCurrentUser, requireUser } from "@/server/auth";
import {
  getSessionForAdmin,
  getSessionForRecorderToken,
} from "@/server/session-service";
import { serializeSession } from "@/server/serializers";

const TRACK_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;

function parseTrackId(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return "main";
  if (trimmed.length > 120 || !TRACK_ID_PATTERN.test(trimmed)) return "main";
  return trimmed;
}

function parseSpeakerLabel(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.length > 120) return null;
  return trimmed;
}

export default async function RecorderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    share?: string;
    recorder?: string;
    trackId?: string;
    speakerLabel?: string;
  }>;
}) {
  const { id } = await params;
  const { share, recorder, trackId, speakerLabel } = await searchParams;
  const currentUser = await getCurrentUser();
  const adminSession =
    currentUser && !currentUser.passwordRotationRequired
      ? await getSessionForAdmin(id, currentUser.id)
      : null;
  const tokenSession =
    adminSession || !recorder
      ? null
      : await getSessionForRecorderToken(id, recorder);

  if (!adminSession && !tokenSession && !recorder) {
    await requireUser();
  }

  const session = adminSession ?? tokenSession;
  if (!session) notFound();
  const serialized = serializeSession(session);
  const releaseCommit = process.env.BABBLEDECK_RELEASE_COMMIT ?? null;
  const releaseBuiltAt = process.env.BABBLEDECK_RELEASE_BUILT_AT ?? null;
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        <RecorderClient
          sessionId={serialized.id}
          title={serialized.title}
          status={serialized.status}
          targetLanguage={serialized.targetLanguage}
          providerName={serialized.providerName}
          budgetCapUsd={serialized.budgetCapUsd}
          estimatedCostUsd={serialized.estimatedCostUsd}
          viewerUrl={share ? `/s/${share}` : null}
          recorderToken={recorder ?? null}
          trackId={parseTrackId(trackId)}
          speakerLabel={parseSpeakerLabel(speakerLabel)}
          historyUrl={adminSession ? `/sessions/${serialized.id}` : null}
          releaseCommit={releaseCommit}
          releaseBuiltAt={releaseBuiltAt}
        />
      </main>
    </>
  );
}
