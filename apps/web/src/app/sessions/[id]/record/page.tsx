import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { RecorderClient } from "@/components/RecorderClient";
import { getCurrentUser, requireUser } from "@/server/auth";
import {
  getSessionForAdmin,
  getSessionForRecorderToken,
} from "@/server/session-service";
import { serializeSession } from "@/server/serializers";

export default async function RecorderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ share?: string; recorder?: string }>;
}) {
  const { id } = await params;
  const { share, recorder } = await searchParams;
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
          historyUrl={adminSession ? `/sessions/${serialized.id}` : null}
        />
      </main>
    </>
  );
}
