import { AccessToken, TrackSource } from "livekit-server-sdk";
import { randomToken } from "./security";

export type LiveKitParticipantRole = "publisher" | "subscriber";

export type LiveKitTokenInput = {
  sessionId: string;
  role: LiveKitParticipantRole;
  identityPrefix: string;
  displayName?: string | null;
};

type LiveKitConfig = {
  url: string;
  apiKey: string;
  apiSecret: string;
  tokenTtlSeconds: number;
};

function positiveIntegerEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export function liveKitRoomName(sessionId: string) {
  return `babbledeck-${sessionId}`;
}

export function getLiveKitConfig(): LiveKitConfig | null {
  const url = process.env.LIVEKIT_URL?.trim();
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
  if (!url || !apiKey || !apiSecret) return null;
  return {
    url,
    apiKey,
    apiSecret,
    tokenTtlSeconds: positiveIntegerEnv("LIVEKIT_TOKEN_TTL_SECONDS", 15 * 60),
  };
}

export function liveKitConfigured() {
  return Boolean(getLiveKitConfig());
}

function identityPrefix(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

export async function createLiveKitJoinToken(input: LiveKitTokenInput) {
  const config = getLiveKitConfig();
  if (!config) return null;

  const room = liveKitRoomName(input.sessionId);
  const role = input.role;
  const identity = `${identityPrefix(input.identityPrefix) || role}-${randomToken(8)}`;
  const token = new AccessToken(config.apiKey, config.apiSecret, {
    identity,
    name: input.displayName ?? undefined,
    ttl: config.tokenTtlSeconds,
  });
  token.addGrant({
    room,
    roomJoin: true,
    canPublish: role === "publisher",
    canPublishData: role === "publisher",
    canPublishSources:
      role === "publisher" ? [TrackSource.MICROPHONE] : undefined,
    canSubscribe: true,
  });

  return {
    url: config.url,
    token: await token.toJwt(),
    room,
    identity,
    role,
    expiresInSeconds: config.tokenTtlSeconds,
  };
}
