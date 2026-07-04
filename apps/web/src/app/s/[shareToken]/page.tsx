import { notFound } from "next/navigation";
import { ViewerClient } from "@/components/ViewerClient";
import { getSessionByShareToken } from "@/server/session-service";
import { serializeSegment, serializeSession } from "@/server/serializers";

export default async function ViewerPage({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const { shareToken } = await params;
  const session = await getSessionByShareToken(shareToken);
  if (!session) notFound();
  const serialized = serializeSession(session);
  return (
    <ViewerClient
      shareToken={shareToken}
      initialSession={{
        title: serialized.title,
        status: serialized.status,
        targetLanguage: serialized.targetLanguage,
      }}
      initialSegments={session.transcriptSegments.map(serializeSegment)}
    />
  );
}
