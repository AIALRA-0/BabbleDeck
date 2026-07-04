import { prisma } from "../apps/web/src/server/db";
import {
  pruneRawAudio,
  resolveAudioRetentionDays,
} from "../apps/web/src/server/audio-retention";

function argValue(name: string) {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

function numberArg(name: string) {
  const raw = argValue(name);
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

async function main() {
  const retentionDays = resolveAudioRetentionDays(
    numberArg("--retention-days") ??
      process.env.BABBLEDECK_AUDIO_RETENTION_DAYS ??
      process.env.AUDIO_RETENTION_DAYS,
  );
  const batchSize = numberArg("--batch-size");
  const dryRun =
    process.argv.includes("--dry-run") ||
    ["1", "true", "yes", "on"].includes(
      (process.env.AUDIO_RETENTION_DRY_RUN ?? "").toLowerCase(),
    );

  const result = await pruneRawAudio({
    retentionDays,
    batchSize,
    dryRun,
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main()
  .catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Audio retention failed.",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
