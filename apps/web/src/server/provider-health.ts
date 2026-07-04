import type { ProviderName, SessionStatus } from "@prisma/client";
import { prisma } from "./db";

const PROVIDER_DEGRADABLE_STATUSES: SessionStatus[] = [
  "CREATED",
  "READY",
  "RECORDING",
  "RECONNECTING",
  "STOPPING",
];

export async function markProviderDegraded(input: {
  sessionId: string;
  actorUserId?: string | null;
  providerName: ProviderName;
  targetLanguage?: string | null;
  code: string;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  return prisma.$transaction(async (tx) => {
    const session = await tx.liveSession.findUnique({
      where: { id: input.sessionId },
      select: { status: true, targetLanguage: true },
    });
    if (!session || !PROVIDER_DEGRADABLE_STATUSES.includes(session.status)) {
      return false;
    }

    const degraded = await tx.liveSession.updateMany({
      where: {
        id: input.sessionId,
        status: { in: PROVIDER_DEGRADABLE_STATUSES },
      },
      data: { status: "PROVIDER_DEGRADED" },
    });
    if (degraded.count === 0) return false;

    const maxEvent = await tx.transcriptEvent.findFirst({
      where: { sessionId: input.sessionId },
      orderBy: { sequenceNo: "desc" },
      select: { sequenceNo: true },
    });
    const payload = {
      code: input.code,
      message: input.message,
      ...(input.metadata ?? {}),
    };

    await tx.transcriptEvent.create({
      data: {
        sessionId: input.sessionId,
        providerName: input.providerName,
        eventType: "PROVIDER_ERROR",
        sequenceNo: (maxEvent?.sequenceNo ?? 0) + 1,
        targetLanguage: input.targetLanguage ?? session.targetLanguage ?? null,
        text: input.message,
        isFinal: true,
        payload,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        sessionId: input.sessionId,
        action: "session.provider_degraded",
        entityType: "live_session",
        entityId: input.sessionId,
        metadata: payload,
      },
    });

    return true;
  });
}
