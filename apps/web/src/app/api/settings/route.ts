import { ok, requireApiUser } from "@/server/api";
import { prisma } from "@/server/db";

export async function GET() {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
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
    glossary: glossary.map((term) => ({
      id: term.id,
      sourceTerm: term.sourceTerm,
      targetTerm: term.targetTerm,
      targetLanguage: term.targetLanguage,
      enabled: term.enabled,
    })),
  });
}
