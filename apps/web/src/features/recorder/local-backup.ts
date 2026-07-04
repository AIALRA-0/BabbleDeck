"use client";

import { openDB } from "idb";

type BackupChunk = {
  id: string;
  sessionId: string;
  chunkIndex: number;
  startedAt: string;
  durationMs: number;
  mimeType: string;
  blob: Blob;
  status: "local_only" | "uploading" | "uploaded" | "failed";
};

const DB_NAME = "babbledeck-audio-backup";
const STORE = "chunks";

async function db() {
  return openDB(DB_NAME, 1, {
    upgrade(database) {
      const store = database.createObjectStore(STORE, { keyPath: "id" });
      store.createIndex("sessionId", "sessionId");
    },
  });
}

export async function saveLocalChunk(
  input: Omit<BackupChunk, "id" | "status">,
) {
  const database = await db();
  const chunk: BackupChunk = {
    ...input,
    id: `${input.sessionId}:${input.chunkIndex}`,
    status: "local_only",
  };
  await database.put(STORE, chunk);
  return chunk;
}

export async function markLocalChunkUploaded(
  sessionId: string,
  chunkIndex: number,
) {
  const database = await db();
  const id = `${sessionId}:${chunkIndex}`;
  const chunk = (await database.get(STORE, id)) as BackupChunk | undefined;
  if (!chunk) return;
  await database.put(STORE, { ...chunk, status: "uploaded" });
}

export async function countLocalChunks(sessionId: string) {
  const database = await db();
  const chunks = (await database.getAllFromIndex(
    STORE,
    "sessionId",
    sessionId,
  )) as BackupChunk[];
  return {
    total: chunks.length,
    uploaded: chunks.filter((chunk) => chunk.status === "uploaded").length,
    pending: chunks.filter((chunk) => chunk.status !== "uploaded").length,
  };
}
