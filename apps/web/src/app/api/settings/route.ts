import {
  ok,
  requireApiUser,
  requireSameOriginMutation,
  validationError,
} from "@/server/api";
import {
  getAudioRetentionDaysSetting,
  getDefaultSessionSettings,
  listGlossaryTerms,
  setDefaultSessionSettings,
  setAudioRetentionDaysSetting,
} from "@/server/settings-service";
import { updateSettingsSchema } from "@/server/schemas";

export async function GET() {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const [audioRetentionDays, defaultSession, glossary] = await Promise.all([
    getAudioRetentionDaysSetting(),
    getDefaultSessionSettings(),
    listGlossaryTerms(),
  ]);
  return ok({
    defaultTargetLanguage: defaultSession.targetLanguage,
    defaultProvider: defaultSession.providerName,
    providers: {
      soniox: { configured: Boolean(process.env.SONIOX_API_KEY) },
      livekit: {
        configured: Boolean(
          process.env.LIVEKIT_URL &&
          process.env.LIVEKIT_API_KEY &&
          process.env.LIVEKIT_API_SECRET,
        ),
      },
      azure: { configured: Boolean(process.env.AZURE_TRANSLATOR_KEY) },
      openai: { configured: Boolean(process.env.OPENAI_API_KEY) },
    },
    defaultBudgetCapUsd: defaultSession.budgetCapUsd,
    audioRetentionDays,
    glossary,
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

  if (
    parsed.defaultTargetLanguage !== undefined ||
    parsed.defaultBudgetCapUsd !== undefined
  ) {
    await setDefaultSessionSettings({
      targetLanguage: parsed.defaultTargetLanguage,
      budgetCapUsd: parsed.defaultBudgetCapUsd,
      actorUserId: user.id,
      userAgent: request.headers.get("user-agent"),
    });
  }

  const [audioRetentionDays, defaultSession] = await Promise.all([
    getAudioRetentionDaysSetting(),
    getDefaultSessionSettings(),
  ]);

  return ok({
    defaultTargetLanguage: defaultSession.targetLanguage,
    defaultProvider: defaultSession.providerName,
    defaultBudgetCapUsd: defaultSession.budgetCapUsd,
    audioRetentionDays,
  });
}
