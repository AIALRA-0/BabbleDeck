import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser, type CurrentUser } from "@/server/auth";
import { clientIpFromHeaders } from "@/server/client-ip";
import { validateSameOriginMutation } from "@/server/same-origin";

export type ApiErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "PASSWORD_ROTATION_REQUIRED"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "SESSION_ALREADY_ENDED"
  | "SESSION_NOT_RECORDING"
  | "AUDIO_CHUNK_TOO_LARGE"
  | "EXPORT_FAILED"
  | "INTERNAL_ERROR";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(
  code: ApiErrorCode,
  message: string,
  status = 400,
  details?: unknown,
) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code,
        message,
        details,
      },
    },
    { status },
  );
}

export function validationError(error: unknown) {
  if (error instanceof ZodError) {
    return fail("VALIDATION_ERROR", "Invalid request.", 400, error.flatten());
  }
  return fail("VALIDATION_ERROR", "Invalid request.", 400);
}

export function requireSameOriginMutation(request: Request) {
  const result = validateSameOriginMutation(request);
  if (result.allowed) return null;
  return fail("FORBIDDEN", "Cross-site mutation blocked.", 403);
}

export async function requireApiUser(options?: {
  allowPasswordRotation?: boolean;
}): Promise<{ user: CurrentUser } | { response: NextResponse }> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      response: fail("UNAUTHENTICATED", "Authentication required.", 401),
    };
  }
  if (user.passwordRotationRequired && !options?.allowPasswordRotation) {
    return {
      response: fail(
        "PASSWORD_ROTATION_REQUIRED",
        "Password change required before continuing.",
        403,
      ),
    };
  }
  return { user };
}

export function getClientIp(request: Request) {
  return clientIpFromHeaders(request.headers);
}

export function isSecureRequest(request: Request) {
  return (
    request.headers.get("x-forwarded-proto") === "https" ||
    request.url.startsWith("https:")
  );
}
