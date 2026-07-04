import { describe, expect, test } from "vitest";
import { summarizeLocalChunks, type BackupChunk } from "./local-backup";

function chunk(status: BackupChunk["status"]) {
  return { status };
}

describe("local recorder backup summaries", () => {
  test("counts uploaded, pending, and failed chunks", () => {
    expect(
      summarizeLocalChunks([
        chunk("uploaded"),
        chunk("local_only"),
        chunk("uploading"),
        chunk("failed"),
      ]),
    ).toEqual({
      total: 4,
      uploaded: 1,
      pending: 3,
      failed: 1,
    });
  });
});
