import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .email()
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(200),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(200),
    newPassword: z.string().min(12).max(200),
    confirmPassword: z.string().min(1).max(200),
  })
  .superRefine((value, context) => {
    if (value.newPassword !== value.confirmPassword) {
      context.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "Passwords do not match.",
      });
    }
    if (value.currentPassword === value.newPassword) {
      context.addIssue({
        code: "custom",
        path: ["newPassword"],
        message: "Choose a different password.",
      });
    }
  });

export const createSessionSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).optional().nullable(),
  sourceLanguageMode: z.string().trim().min(1).max(40).default("auto"),
  targetLanguage: z.string().trim().min(2).max(16).default("zh"),
  providerName: z.enum(["mock", "soniox"]).default("mock"),
  qualityMode: z.string().trim().min(1).max(40).default("realtime"),
  budgetCapUsd: z.coerce.number().positive().max(100).optional().nullable(),
});

export const transcriptEventSchema = z.object({
  type: z.enum([
    "partial_transcript",
    "final_transcript",
    "partial_translation",
    "final_translation",
    "language_detected",
    "segment_corrected",
    "provider_error",
    "usage",
  ]),
  text: z.string().max(5000).optional(),
  language: z.string().max(20).optional(),
  targetLanguage: z.string().max(20).optional(),
  isFinal: z.boolean().optional(),
  segmentIndex: z.coerce.number().int().min(0).max(100000).optional(),
  startMs: z.coerce.number().int().min(0).optional(),
  endMs: z.coerce.number().int().min(0).optional(),
  confidence: z.coerce.number().min(0).max(1).optional(),
});

export const appendEventsSchema = z.object({
  events: z.array(transcriptEventSchema).min(1).max(20),
});

export const audioChunkSchema = z.object({
  chunkIndex: z.coerce.number().int().min(0).max(1_000_000),
  startedAt: z.string().datetime().optional(),
  durationMs: z.coerce.number().int().min(0).max(120_000).optional(),
  mimeType: z.string().min(1).max(160),
  byteSize: z.coerce
    .number()
    .int()
    .min(0)
    .max(25 * 1024 * 1024),
  checksumSha256: z.string().length(64).optional(),
});

export const exportSchema = z.object({
  format: z.enum(["markdown", "txt", "json", "srt", "vtt"]),
  includeOriginal: z.boolean().default(true),
  includeTranslation: z.boolean().default(true),
  includeTimestamps: z.boolean().default(true),
});
