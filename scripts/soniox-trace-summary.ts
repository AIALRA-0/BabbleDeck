import fs from "node:fs/promises";
import { prisma } from "../apps/web/src/server/db";

function argValue(name: string) {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

function numberArg(name: string, fallback: number) {
  const value = Number(argValue(name));
  return Number.isFinite(value) ? value : fallback;
}

function expectedPatterns() {
  return (argValue("--expected-texts") ?? "Brooklyn")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function regexFromPattern(pattern: string) {
  try {
    return new RegExp(pattern, "i");
  } catch {
    return new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  }
}

async function archiveTraceSession(sessionId: string | null) {
  if (!sessionId) return false;
  const now = new Date();
  const updated = await prisma.liveSession.updateMany({
    where: { id: sessionId, archivedAt: null },
    data: {
      archivedAt: now,
      endedAt: now,
      status: "ARCHIVED",
    },
  });
  return updated.count > 0;
}

async function main() {
  const title = argValue("--title");
  if (!title) throw new Error("--title is required.");

  const checkedAt = argValue("--checked-at") ?? new Date().toISOString();
  const finishedAt = argValue("--finished-at") ?? new Date().toISOString();
  const baseUrl =
    argValue("--base-url") ??
    process.env.BABBLEDECK_BASE_URL ??
    "https://babbledeck.aialra.online";
  const playwrightStatus = numberArg("--playwright-status", 1);
  const playwrightOutputPath = argValue("--playwright-output");
  const audioDurationSeconds = numberArg("--audio-duration-seconds", 0);
  const recordSeconds = numberArg("--record-seconds", 0);
  const minUsageMs = numberArg("--min-usage-ms", 10_000);
  const minAudioChunks = numberArg("--min-audio-chunks", 5);
  const minSegments = numberArg("--min-segments", 1);
  const patterns = expectedPatterns();
  const playwrightOutput = playwrightOutputPath
    ? await fs.readFile(playwrightOutputPath, "utf8").catch(() => "")
    : "";
  const playwrightPassed =
    playwrightStatus === 0 && /\b1 passed\b/.test(playwrightOutput);

  const session = await prisma.liveSession.findFirst({
    where: { title },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      providerName: true,
      createdAt: true,
      endedAt: true,
      archivedAt: true,
      transcriptSegments: {
        orderBy: { segmentIndex: "asc" },
        select: {
          segmentIndex: true,
          originalText: true,
          finalOriginalText: true,
          translations: {
            select: {
              translationText: true,
              targetLanguage: true,
            },
          },
        },
      },
      transcriptEvents: {
        where: { eventType: "PROVIDER_ERROR" },
        select: { id: true },
      },
      audioChunks: {
        select: {
          durationMs: true,
          byteSize: true,
          status: true,
        },
      },
      providerUsage: {
        select: {
          providerName: true,
          usageType: true,
          audioMs: true,
          estimatedCostUsd: true,
        },
      },
    },
  });

  const combinedText = session
    ? session.transcriptSegments
        .flatMap((segment) => [
          segment.finalOriginalText ?? segment.originalText,
          ...segment.translations.map(
            (translation) => translation.translationText,
          ),
        ])
        .join("\n")
    : "";
  const expectedTextMatches = patterns.map((pattern) => ({
    pattern,
    matched: regexFromPattern(pattern).test(combinedText),
  }));
  const providerUsageAudioMs =
    session?.providerUsage.reduce(
      (sum, item) => sum + Number(item.audioMs ?? 0),
      0,
    ) ?? 0;
  const audioChunkCount = session?.audioChunks.length ?? 0;
  const audioChunkDurationMs =
    session?.audioChunks.reduce(
      (sum, chunk) => sum + Number(chunk.durationMs ?? 0),
      0,
    ) ?? 0;
  const audioChunkBytes =
    session?.audioChunks.reduce(
      (sum, chunk) => sum + Number(chunk.byteSize ?? 0n),
      0,
    ) ?? 0;
  const segmentCount = session?.transcriptSegments.length ?? 0;
  const translationCount =
    session?.transcriptSegments.reduce(
      (sum, segment) => sum + segment.translations.length,
      0,
    ) ?? 0;
  const providerErrors = session?.transcriptEvents.length ?? 0;
  const sessionBeforeArchive = session
    ? {
        id: session.id,
        title: session.title,
        status: session.status,
        providerName: session.providerName,
        createdAt: session.createdAt.toISOString(),
        endedAt: session.endedAt?.toISOString() ?? null,
        archivedAt: session.archivedAt?.toISOString() ?? null,
      }
    : null;
  const archived = await archiveTraceSession(session?.id ?? null);
  const ok =
    playwrightPassed &&
    session?.providerName === "SONIOX" &&
    providerErrors === 0 &&
    segmentCount >= minSegments &&
    audioChunkCount >= minAudioChunks &&
    providerUsageAudioMs >= minUsageMs &&
    expectedTextMatches.every((match) => match.matched);

  const record = {
    app: "babbledeck",
    checkedAt,
    finishedAt,
    baseUrl,
    ok,
    sessionId: session?.id ?? null,
    archived,
    title,
    thresholds: {
      minUsageMs,
      minAudioChunks,
      minSegments,
    },
    playwright: {
      status: playwrightStatus,
      project: "chromium-desktop",
      grep: "soniox provider streams",
      passed: playwrightPassed,
      recordSeconds,
    },
    fakeAudio: {
      generated: true,
      durationSeconds: audioDurationSeconds || null,
      expectedTexts: patterns,
    },
    transcript: {
      segmentCount,
      translationCount,
      expectedTextMatches,
      preview: combinedText.slice(0, 500),
    },
    audioChunks: {
      count: audioChunkCount,
      durationMs: audioChunkDurationMs,
      bytes: audioChunkBytes,
    },
    providerUsage: {
      totalAudioMs: providerUsageAudioMs,
      entries:
        session?.providerUsage.map((item) => ({
          providerName: item.providerName,
          usageType: item.usageType,
          audioMs: item.audioMs,
          estimatedCostUsd: item.estimatedCostUsd?.toString() ?? null,
        })) ?? [],
    },
    providerErrors,
    sessionBeforeArchive,
  };
  process.stdout.write(`${JSON.stringify(record)}\n`);
  if (!ok) process.exitCode = 1;
}

main().finally(async () => {
  await prisma.$disconnect();
});
