import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { hashToken } from "./security";

export const RECORDER_TOKEN_HEADER = "x-babbledeck-recorder-token";

export const recorderSessionSelect = {
  id: true,
  ownerUserId: true,
  status: true,
  providerName: true,
  sourceLanguageMode: true,
  targetLanguage: true,
  qualityMode: true,
  budgetCapUsd: true,
  estimatedCostUsd: true,
  startedAt: true,
  endedAt: true,
} satisfies Prisma.LiveSessionSelect;

export type RecorderSession = Prisma.LiveSessionGetPayload<{
  select: typeof recorderSessionSelect;
}>;

export type RecorderAccess = {
  kind: "admin" | "recorder_token";
  actorUserId: string | null;
  session: RecorderSession;
};

function validRecorderToken(value: string | null | undefined) {
  return value && /^[A-Za-z0-9_-]{16,256}$/.test(value) ? value : null;
}

function bearerToken(value: string | null | undefined) {
  if (!value) return null;
  const match = value.match(/^Bearer\s+(.+)$/i);
  return validRecorderToken(match?.[1]?.trim());
}

export function recorderTokenFromHeaders(
  headers: Pick<Headers, "get">,
  searchParams?: URLSearchParams,
) {
  return (
    bearerToken(headers.get("authorization")) ??
    validRecorderToken(headers.get(RECORDER_TOKEN_HEADER)) ??
    validRecorderToken(searchParams?.get("recorder")) ??
    validRecorderToken(searchParams?.get("recorderToken"))
  );
}

export function recorderTokenFromRequest(request: Request) {
  const url = new URL(request.url);
  return recorderTokenFromHeaders(request.headers, url.searchParams);
}

export async function findRecorderSessionForOwner(
  sessionId: string,
  ownerUserId: string,
) {
  return prisma.liveSession.findFirst({
    where: { id: sessionId, ownerUserId, archivedAt: null },
    select: recorderSessionSelect,
  });
}

export async function findRecorderSessionForToken(
  sessionId: string,
  token: string | null | undefined,
) {
  const recorderToken = validRecorderToken(token);
  if (!recorderToken) return null;
  return prisma.liveSession.findFirst({
    where: {
      id: sessionId,
      recorderTokenHash: hashToken(recorderToken),
      archivedAt: null,
    },
    select: recorderSessionSelect,
  });
}
