import { AccessToken } from "livekit-server-sdk";
import {
  createLiveKitJoinToken,
  getLiveKitConfig,
  liveKitRoomName,
} from "../apps/web/src/server/livekit";

function boolFlag(name: string) {
  return process.argv.includes(name);
}

function argNumber(name: string, fallback: number) {
  const prefix = `${name}=`;
  const raw = process.argv
    .find((arg) => arg.startsWith(prefix))
    ?.slice(prefix.length);
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function missingEnvNames() {
  return ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"].filter(
    (name) => !process.env[name]?.trim(),
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "LiveKit preflight failed.";
}

function managementApiTarget(rawUrl: string) {
  const url = new URL(rawUrl);
  if (url.protocol === "wss:") url.protocol = "https:";
  if (url.protocol === "ws:") url.protocol = "http:";
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("LIVEKIT_URL must use wss, ws, https, or http.");
  }
  const pathPrefix = url.pathname.replace(/\/+$/, "");
  return {
    host: `${url.protocol}//${url.host}`,
    rpcPrefix: pathPrefix ? `${pathPrefix}/twirp` : "/twirp",
    displayUrl: `${url.protocol}//${url.host}${pathPrefix}`,
  };
}

function decodeJwtPayload(token: string) {
  const payload = token.split(".")[1];
  if (!payload) throw new Error("Generated LiveKit token was not a JWT.");
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
    video?: {
      room?: string;
      roomJoin?: boolean;
      canPublish?: boolean;
      canPublishSources?: string[];
      canSubscribe?: boolean;
    };
  };
}

async function createManagementAuthHeader(input: {
  apiKey: string;
  apiSecret: string;
}) {
  const token = new AccessToken(input.apiKey, input.apiSecret, { ttl: "5m" });
  token.addGrant({ roomList: true });
  return `Bearer ${await token.toJwt()}`;
}

async function listRoomsViaTwirp(input: {
  target: ReturnType<typeof managementApiTarget>;
  apiKey: string;
  apiSecret: string;
  names: string[];
  timeoutMs: number;
}) {
  const url = new URL(
    `${input.target.rpcPrefix}/livekit.RoomService/ListRooms`,
    input.target.host,
  );
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      Authorization: await createManagementAuthHeader(input),
    },
    body: JSON.stringify({ names: input.names }),
    signal: AbortSignal.timeout(input.timeoutMs),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return (await response.json()) as { rooms?: unknown[] };
}

async function main() {
  const checkedAt = new Date().toISOString();
  const skipConnectivity = boolFlag("--skip-connectivity");
  const requestTimeoutMs = argNumber("--timeout-ms", 10_000);
  const config = getLiveKitConfig();
  const room = liveKitRoomName("preflight");

  if (!config) {
    process.stdout.write(
      `${JSON.stringify({
        app: "babbledeck",
        checkedAt,
        ok: false,
        configured: false,
        missing: missingEnvNames(),
        error: "LiveKit is not configured.",
      })}\n`,
    );
    process.exitCode = 1;
    return;
  }

  let tokenGenerated = false;
  let tokenGrantOk = false;
  let managementApiChecked = false;
  let managementApiOk = false;
  let roomCount: number | null = null;
  let operationError: string | undefined;
  const apiTarget = managementApiTarget(config.url);

  try {
    const token = await createLiveKitJoinToken({
      sessionId: "preflight",
      role: "publisher",
      identityPrefix: "preflight",
      displayName: "BabbleDeck LiveKit preflight",
    });
    tokenGenerated = Boolean(token?.token);
    const payload = decodeJwtPayload(token?.token ?? "");
    tokenGrantOk =
      payload.video?.room === room &&
      payload.video.roomJoin === true &&
      payload.video.canPublish === true &&
      payload.video.canSubscribe === true &&
      payload.video.canPublishSources?.includes("microphone") === true;

    if (!skipConnectivity) {
      managementApiChecked = true;
      const rooms = await listRoomsViaTwirp({
        target: apiTarget,
        apiKey: config.apiKey,
        apiSecret: config.apiSecret,
        names: [room],
        timeoutMs: requestTimeoutMs,
      });
      roomCount = rooms.rooms?.length ?? 0;
      managementApiOk = true;
    }
  } catch (error) {
    operationError = errorMessage(error);
  }

  const ok =
    tokenGenerated &&
    tokenGrantOk &&
    (skipConnectivity || (managementApiChecked && managementApiOk));

  process.stdout.write(
    `${JSON.stringify({
      app: "babbledeck",
      checkedAt,
      ok,
      configured: true,
      livekitHost: new URL(config.url).host,
      managementApiHost: new URL(apiTarget.host).host,
      managementApiPath: new URL(apiTarget.displayUrl).pathname,
      room,
      tokenGenerated,
      tokenGrantOk,
      managementApiChecked,
      managementApiOk,
      roomCount,
      error: operationError,
    })}\n`,
  );
  if (!ok) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${errorMessage(error)}\n`);
  process.exitCode = 1;
});
