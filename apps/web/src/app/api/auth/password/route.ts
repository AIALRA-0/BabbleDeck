import { auditLog } from "@/server/audit";
import {
  fail,
  ok,
  requireApiUser,
  requireSameOriginMutation,
  validationError,
} from "@/server/api";
import { prisma } from "@/server/db";
import { hashPassword, verifyPassword } from "@/server/password";
import { changePasswordSchema } from "@/server/schemas";
import { revokeOtherUserSessions } from "@/server/auth";

export async function POST(request: Request) {
  const csrfResponse = requireSameOriginMutation(request);
  if (csrfResponse) return csrfResponse;

  const auth = await requireApiUser({ allowPasswordRotation: true });
  if ("response" in auth) return auth.response;

  let parsed;
  try {
    parsed = changePasswordSchema.parse(await request.json());
  } catch (error) {
    return validationError(error);
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
  });
  if (!user || user.disabledAt) {
    return fail("UNAUTHENTICATED", "Authentication required.", 401);
  }

  const valid = await verifyPassword(parsed.currentPassword, user.passwordHash);
  if (!valid) {
    return fail("UNAUTHENTICATED", "Current password is incorrect.", 401);
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(parsed.newPassword),
      passwordRotationRequired: false,
    },
  });
  await revokeOtherUserSessions(user.id);

  await auditLog({
    actorUserId: user.id,
    action: "auth.password_changed",
    entityType: "user",
    entityId: user.id,
    userAgent: request.headers.get("user-agent"),
  });

  return ok({
    user: {
      id: updated.id,
      email: updated.email,
      role: updated.role.toLowerCase(),
      passwordRotationRequired: updated.passwordRotationRequired,
    },
  });
}
