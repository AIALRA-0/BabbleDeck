-- Add track identity to transcript events and final segments so independent
-- LiveKit/provider tracks can use their own segment indexes.
ALTER TABLE "transcript_events"
ADD COLUMN "trackId" TEXT NOT NULL DEFAULT 'main',
ADD COLUMN "speakerLabel" TEXT;

ALTER TABLE "transcript_segments"
ADD COLUMN "trackId" TEXT NOT NULL DEFAULT 'main';

DROP INDEX "transcript_segments_sessionId_segmentIndex_key";
DROP INDEX "transcript_segments_sessionId_segmentIndex_idx";

CREATE UNIQUE INDEX "transcript_segments_sessionId_trackId_segmentIndex_key"
ON "transcript_segments"("sessionId", "trackId", "segmentIndex");

CREATE INDEX "transcript_segments_sessionId_trackId_segmentIndex_idx"
ON "transcript_segments"("sessionId", "trackId", "segmentIndex");

CREATE INDEX "transcript_events_sessionId_trackId_sequenceNo_idx"
ON "transcript_events"("sessionId", "trackId", "sequenceNo");
