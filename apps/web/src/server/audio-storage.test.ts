import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { sha256Hex, uploadAudioChunk } from "@/server/audio-storage";

const originalEnv = { ...process.env };
let storageRoot: string | null = null;

afterEach(async () => {
  if (storageRoot) {
    await fs.rm(storageRoot, { recursive: true, force: true });
    storageRoot = null;
  }
  process.env = { ...originalEnv };
});

describe("audio storage", () => {
  test("writes local audio chunks to the configured storage root", async () => {
    storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "babbledeck-audio-"));
    process.env.AUDIO_STORAGE_DRIVER = "local";
    process.env.AUDIO_STORAGE_DIR = storageRoot;

    const body = Buffer.from("babbledeck audio bytes");
    const result = await uploadAudioChunk({
      sessionId: "6ca13183-f9df-4bb0-94bc-2f5a88f3bc96",
      chunkIndex: 7,
      body,
      mimeType: "audio/webm",
      checksumSha256: sha256Hex(body),
    });

    const saved = await fs.readFile(path.join(storageRoot, result.objectKey));
    expect(result).toMatchObject({
      driver: "local",
      objectKey:
        "sessions/6ca13183-f9df-4bb0-94bc-2f5a88f3bc96/audio/chunk-000007.webm",
    });
    expect(saved).toEqual(body);
  });
});
