import { fail, ok, requireApiUser, validationError } from "@/server/api";
import {
  AudioChunkUploadError,
  saveSessionAudioChunk,
} from "@/server/audio-chunk-service";
import { audioChunkSchema } from "@/server/schemas";

export const runtime = "nodejs";

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const { id } = await context.params;

  let parsed;
  let file: File | null = null;
  try {
    const formData = await request.formData();
    const fileValue = formData.get("file");
    if (!(fileValue instanceof File)) {
      return fail("VALIDATION_ERROR", "Audio chunk file is required.", 400);
    }
    file = fileValue;
    parsed = audioChunkSchema.parse({
      chunkIndex: formValue(formData, "chunkIndex"),
      startedAt: formValue(formData, "startedAt"),
      durationMs: formValue(formData, "durationMs"),
      mimeType: formValue(formData, "mimeType") ?? file.type,
      byteSize: file.size,
      checksumSha256: formValue(formData, "checksumSha256"),
    });
  } catch (error) {
    return validationError(error);
  }

  if (!file) {
    return fail("VALIDATION_ERROR", "Audio chunk file is required.", 400);
  }

  const body = Buffer.from(await file.arrayBuffer());
  try {
    const result = await saveSessionAudioChunk({
      sessionId: id,
      ownerUserId: user.id,
      chunkIndex: parsed.chunkIndex,
      startedAt: parsed.startedAt,
      durationMs: parsed.durationMs,
      body,
      mimeType: parsed.mimeType,
      checksumSha256: parsed.checksumSha256,
    });
    return ok(result);
  } catch (error) {
    if (error instanceof AudioChunkUploadError) {
      return fail(error.code, error.message, error.status);
    }
    return fail("INTERNAL_ERROR", "Audio chunk upload failed.", 500);
  }
}
