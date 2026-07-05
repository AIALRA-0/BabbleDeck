import { RoomServiceClient } from "livekit-server-sdk";
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

function managementApiUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  if (url.protocol === "wss:") url.protocol = "https:";
  if (url.protocol === "ws:") url.protocol = "http:";
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("LIVEKIT_URL must use wss, ws, https, or http.");
  }
  return url.toString().replace(/\/$/, "");
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
  const apiUrl = managementApiUrl(config.url);

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
      const client = new RoomServiceClient(
        apiUrl,
        config.apiKey,
        config.apiSecret,
        { requestTimeout: requestTimeoutMs },
      );
      const rooms = await client.listRooms([room]);
      roomCount = rooms.length;
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
      managementApiHost: new URL(apiUrl).host,
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
