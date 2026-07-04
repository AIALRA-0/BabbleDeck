import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { hashToken, randomToken } from "@/server/security";

export const AUTH_COOKIE = "babbledeck_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

export type CurrentUser = {
  id: string;
  email: string;
  role: string;
  displayName: string | null;
  passwordRotationRequired: boolean;
};

export async function createAuthSession(input: {
  userId: string;
  userAgent?: string | null;
  ipHash?: string | null;
}) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.authSession.create({
    data: {
      userId: input.userId,
      sessionTokenHash: hashToken(token),
      userAgent: input.userAgent ?? null,
      ipHash: input.ipHash ?? null,
      expiresAt,
    },
  });
  return { token, expiresAt };
}

export function setAuthCookie(
  response: NextResponse,
  token: string,
  expiresAt: Date,
) {
  response.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export function clearAuthCookie(response: NextResponse) {
  response.cookies.set(AUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.authSession.findUnique({
    where: { sessionTokenHash: hashToken(token) },
    include: { user: true },
  });

  if (
    !session ||
    session.revokedAt ||
    session.expiresAt <= new Date() ||
    session.user.disabledAt
  ) {
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    role: session.user.role,
    displayName: session.user.displayName,
    passwordRotationRequired: session.user.passwordRotationRequired,
  };
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function revokeCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) return;
  await prisma.authSession.updateMany({
    where: { sessionTokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
