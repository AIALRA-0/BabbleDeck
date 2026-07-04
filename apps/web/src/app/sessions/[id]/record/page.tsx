import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { RecorderClient } from "@/components/RecorderClient";
import { requireUser } from "@/server/auth";
import { getSessionForAdmin } from "@/server/session-service";
import { serializeSession } from "@/server/serializers";

export default async function RecorderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ share?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { share } = await searchParams;
  const session = await getSessionForAdmin(id, user.id);
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
        />
      </main>
    </>
  );
}
