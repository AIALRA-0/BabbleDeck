import crypto from "node:crypto";
import {
  deleteAudioObject,
  headAudioObject,
  putAudioObject,
  resolveAudioStorageConfig,
  sha256Hex,
} from "../apps/web/src/server/audio-storage";

function argValue(name: string) {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

function boolFlag(name: string) {
  return process.argv.includes(name);
}

function safePrefix() {
  const prefix = (
    argValue("--prefix") ??
    process.env.BABBLEDECK_AUDIO_PREFLIGHT_PREFIX ??
    "preflight"
  )
    .trim()
    .replace(/^\/+|\/+$/g, "");

  if (!prefix || prefix.includes("..") || prefix.includes("\\")) {
    throw new Error("Preflight object prefix is invalid.");
  }
  return prefix;
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Audio storage preflight failed.";
}

async function main() {
  const checkedAt = new Date().toISOString();
  const requireOffHost = boolFlag("--require-off-host");
  const objectKey = `${safePrefix()}/${crypto.randomUUID()}.txt`;
  const body = Buffer.from(
    `BabbleDeck audio storage preflight ${checkedAt}\n`,
    "utf8",
  );
  const checksumSha256 = sha256Hex(body);

  let config: ReturnType<typeof resolveAudioStorageConfig>;
  try {
    config = resolveAudioStorageConfig();
  } catch (error) {
    process.stdout.write(
      `${JSON.stringify({
        app: "babbledeck",
        checkedAt,
        ok: false,
        targetDriver: "unknown",
        requireOffHost,
        objectKey,
        error: errorMessage(error),
      })}\n`,
    );
    process.exitCode = 1;
    return;
  }

  if (requireOffHost && config.driver !== "s3") {
    process.stdout.write(
      `${JSON.stringify({
        app: "babbledeck",
        checkedAt,
        ok: false,
        targetDriver: config.driver,
        requireOffHost,
        objectKey,
        error: "Current audio storage target is local.",
      })}\n`,
    );
    process.exitCode = 1;
    return;
  }

  let uploaded = false;
  let headed = false;
  let deleted = false;
  let byteSize: number | null = null;
  let operationError: string | null = null;
  let deleteError: string | null = null;

  try {
    await putAudioObject({
      objectKey,
      body,
      mimeType: "text/plain",
      checksumSha256,
      metadata: {
        "preflight-kind": "audio-storage",
        "checked-at": checkedAt,
      },
    });
    uploaded = true;

    const head = await headAudioObject(objectKey);
    headed = true;
    byteSize = head.byteSize;
    if (byteSize !== body.length) {
      operationError = `Preflight object size ${String(byteSize)} did not match expected size ${body.length}.`;
    }
  } catch (error) {
    operationError = errorMessage(error);
  } finally {
    if (uploaded) {
      try {
        await deleteAudioObject(objectKey);
        deleted = true;
      } catch (error) {
        deleteError = errorMessage(error);
      }
    }
  }

  const ok = uploaded && headed && deleted && !operationError && !deleteError;
  process.stdout.write(
    `${JSON.stringify({
      app: "babbledeck",
      checkedAt,
      ok,
      targetDriver: config.driver,
      targetBucket: config.driver === "s3" ? config.bucket : undefined,
      requireOffHost,
      objectKey,
      uploaded,
      headed,
      deleted,
      byteSize,
      expectedByteSize: body.length,
      error: operationError ?? deleteError ?? undefined,
    })}\n`,
  );
  if (!ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(errorMessage(error));
  process.exitCode = 1;
});
