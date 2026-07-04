import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { hashIp } from "./security";

export async function auditLog(input: {
  actorUserId?: string | null;
  sessionId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      sessionId: input.sessionId ?? null,
      action: input.action,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      ipHash: hashIp(input.ip),
      userAgent: input.userAgent ?? null,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });
}
