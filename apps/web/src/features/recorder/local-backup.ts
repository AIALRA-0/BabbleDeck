"use client";

import { openDB } from "idb";

export type BackupChunkStatus =
  "local_only" | "uploading" | "uploaded" | "failed";

export type BackupChunk = {
  id: string;
  sessionId: string;
  chunkIndex: number;
  startedAt: string;
  durationMs: number;
  mimeType: string;
  blob: Blob;
  status: BackupChunkStatus;
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
  await markLocalChunkStatus(sessionId, chunkIndex, "uploaded");
}

export async function markLocalChunkUploading(
  sessionId: string,
  chunkIndex: number,
) {
  await markLocalChunkStatus(sessionId, chunkIndex, "uploading");
}

export async function markLocalChunkFailed(
  sessionId: string,
  chunkIndex: number,
) {
  await markLocalChunkStatus(sessionId, chunkIndex, "failed");
}

async function markLocalChunkStatus(
  sessionId: string,
  chunkIndex: number,
  status: BackupChunkStatus,
) {
  const database = await db();
  const id = `${sessionId}:${chunkIndex}`;
  const chunk = (await database.get(STORE, id)) as BackupChunk | undefined;
  if (!chunk) return;
  await database.put(STORE, { ...chunk, status });
}

export function summarizeLocalChunks(chunks: Pick<BackupChunk, "status">[]) {
  return {
    total: chunks.length,
    uploaded: chunks.filter((chunk) => chunk.status === "uploaded").length,
    pending: chunks.filter((chunk) => chunk.status !== "uploaded").length,
    failed: chunks.filter((chunk) => chunk.status === "failed").length,
  };
}

export async function listPendingLocalChunks(sessionId: string) {
  const database = await db();
  const chunks = (await database.getAllFromIndex(
    STORE,
    "sessionId",
    sessionId,
  )) as BackupChunk[];
  return chunks
    .filter((chunk) => chunk.status !== "uploaded")
    .sort((first, second) => first.chunkIndex - second.chunkIndex);
}

export async function deleteUploadedLocalChunks(sessionId: string) {
  const database = await db();
  const chunks = (await database.getAllFromIndex(
    STORE,
    "sessionId",
    sessionId,
  )) as BackupChunk[];
  const uploadedChunks = chunks.filter((chunk) => chunk.status === "uploaded");
  const transaction = database.transaction(STORE, "readwrite");
  await Promise.all(
    uploadedChunks.map((chunk) => transaction.store.delete(chunk.id)),
  );
  await transaction.done;
  return uploadedChunks.length;
}

export async function countLocalChunks(sessionId: string) {
  const database = await db();
  const chunks = (await database.getAllFromIndex(
    STORE,
    "sessionId",
    sessionId,
  )) as BackupChunk[];
  return summarizeLocalChunks(chunks);
}
