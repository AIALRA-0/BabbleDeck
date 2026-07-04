import {
  ok,
  requireApiUser,
  requireSameOriginMutation,
  validationError,
} from "@/server/api";
import { prisma } from "@/server/db";
import {
  getAudioRetentionDaysSetting,
  setAudioRetentionDaysSetting,
} from "@/server/settings-service";
import { updateSettingsSchema } from "@/server/schemas";

export async function GET() {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const audioRetentionDays = await getAudioRetentionDaysSetting();
  const glossary = await prisma.glossaryTerm.findMany({
    orderBy: { createdAt: "desc" },
    take: 25,
  });
  return ok({
    defaultTargetLanguage: process.env.SONIOX_DEFAULT_TARGET_LANGUAGE ?? "zh",
    defaultProvider: process.env.SONIOX_API_KEY ? "soniox" : "mock",
    providers: {
      soniox: { configured: Boolean(process.env.SONIOX_API_KEY) },
      azure: { configured: Boolean(process.env.AZURE_TRANSLATOR_KEY) },
      openai: { configured: Boolean(process.env.OPENAI_API_KEY) },
    },
    defaultBudgetCapUsd: Number(
      process.env.DEFAULT_SESSION_BUDGET_CAP_USD ?? 1.5,
    ),
    audioRetentionDays,
    glossary: glossary.map((term) => ({
      id: term.id,
      sourceTerm: term.sourceTerm,
      targetTerm: term.targetTerm,
      targetLanguage: term.targetLanguage,
      enabled: term.enabled,
    })),
  });
}

export async function PATCH(request: Request) {
  const csrfResponse = requireSameOriginMutation(request);
  if (csrfResponse) return csrfResponse;

  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const { user } = auth;

  let parsed;
  try {
    parsed = updateSettingsSchema.parse(await request.json());
  } catch (error) {
    return validationError(error);
  }

  if (parsed.audioRetentionDays != null) {
    await setAudioRetentionDaysSetting({
      days: parsed.audioRetentionDays,
      actorUserId: user.id,
      userAgent: request.headers.get("user-agent"),
    });
  }

  return ok({
    audioRetentionDays: await getAudioRetentionDaysSetting(),
  });
}
