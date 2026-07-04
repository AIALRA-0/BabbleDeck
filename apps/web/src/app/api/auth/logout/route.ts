import { NextResponse } from "next/server";
import { auditLog } from "@/server/audit";
import {
  clearAuthCookie,
  getCurrentUser,
  revokeCurrentSession,
} from "@/server/auth";
import { ok, requireSameOriginMutation } from "@/server/api";

export async function POST(request: Request) {
  const csrfResponse = requireSameOriginMutation(request);
  if (csrfResponse) return csrfResponse;

  const user = await getCurrentUser();
  await revokeCurrentSession();
  if (user) {
    await auditLog({
      actorUserId: user.id,
      action: "auth.logout",
      entityType: "user",
      entityId: user.id,
      userAgent: request.headers.get("user-agent"),
    });
  }
  const response = ok({}) as NextResponse;
  clearAuthCookie(response);
  return response;
}
