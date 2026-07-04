import { NextResponse } from "next/server";
import { auditLog } from "@/server/audit";
import { createAuthSession, setAuthCookie } from "@/server/auth";
import { fail, getClientIp, ok, validationError } from "@/server/api";
import { prisma } from "@/server/db";
import { checkLoginRateLimit } from "@/server/login-rate-limit";
import { verifyPassword } from "@/server/password";
import { loginSchema } from "@/server/schemas";
import { hashIp } from "@/server/security";

function safeNextPath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  if (value === "/login" || value.startsWith("/account/password")) {
    return "/dashboard";
  }
  return value;
}

function passwordRotationUrl(request: Request, next: string) {
  const url = new URL("/account/password", request.url);
  url.searchParams.set("next", safeNextPath(next));
  return url;
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const isFormPost = contentType.includes("application/x-www-form-urlencoded");
  let next = "/dashboard";
  let parsed;
  try {
    if (isFormPost) {
      const formData = await request.formData();
      next = String(formData.get("next") ?? "/dashboard");
      parsed = loginSchema.parse({
        email: formData.get("email"),
        password: formData.get("password"),
      });
    } else {
      parsed = loginSchema.parse(await request.json());
    }
  } catch (error) {
    return validationError(error);
  }

  const ip = getClientIp(request);
  const limited = checkLoginRateLimit({ ip, email: parsed.email });
  if (!limited.allowed) {
    return fail(
      "RATE_LIMITED",
      "Too many sign-in attempts. Try again soon.",
      429,
      {
        retryAfterSeconds: limited.retryAfterSeconds,
      },
    );
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.email } });
  const valid =
    user && !user.disabledAt
      ? await verifyPassword(parsed.password, user.passwordHash)
      : false;

  if (!user || !valid) {
    await auditLog({
      action: "auth.login_failed",
      entityType: "user",
      entityId: user?.id ?? null,
      ip,
      userAgent: request.headers.get("user-agent"),
    });
    if (isFormPost) {
      return NextResponse.redirect(new URL("/login?error=1", request.url), {
        status: 303,
      });
    }
    return fail(
      "UNAUTHENTICATED",
      "Sign-in failed. Check your credentials and try again.",
      401,
    );
  }

  const now = new Date();
  const session = await createAuthSession({
    userId: user.id,
    userAgent: request.headers.get("user-agent"),
    ipHash: hashIp(ip),
  });

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      firstLoginAt: user.firstLoginAt ?? now,
      lastLoginAt: now,
    },
  });

  await auditLog({
    actorUserId: user.id,
    action: "auth.login_success",
    entityType: "user",
    entityId: user.id,
    ip,
    userAgent: request.headers.get("user-agent"),
  });

  const response = isFormPost
    ? NextResponse.redirect(
        updated.passwordRotationRequired
          ? passwordRotationUrl(request, next)
          : new URL(safeNextPath(next), request.url),
        {
          status: 303,
        },
      )
    : (ok({
        user: {
          id: updated.id,
          email: updated.email,
          role: updated.role.toLowerCase(),
          passwordRotationRequired: updated.passwordRotationRequired,
        },
      }) as NextResponse);
  setAuthCookie(response, session.token, session.expiresAt);
  return response;
}
