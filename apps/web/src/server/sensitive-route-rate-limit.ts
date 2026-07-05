import {
  checkRateLimit,
  minuteLimit,
  type RateLimitResult,
} from "@/server/rate-limit";

const WINDOW_MS = 60_000;

export function checkExportRateLimit(input: {
  userId: string;
  sessionId: string;
}): RateLimitResult {
  return checkRateLimit(
    `export:${input.userId}:${input.sessionId}`,
    minuteLimit("EXPORT_RATE_LIMIT_PER_MINUTE", 20),
    WINDOW_MS,
  );
}

export function checkAudioChunkUploadRateLimit(input: {
  sessionId: string;
  ip: string;
}): RateLimitResult {
  return checkRateLimit(
    `audio-chunk:${input.sessionId}:${input.ip}`,
    minuteLimit("AUDIO_CHUNK_UPLOAD_RATE_LIMIT_PER_MINUTE", 240),
    WINDOW_MS,
  );
}
