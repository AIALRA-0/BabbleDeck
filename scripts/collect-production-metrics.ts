import { Prisma, type SessionStatus } from "@prisma/client";
import { prisma } from "../apps/web/src/server/db";

const ACTIVE_SESSION_STATUSES: SessionStatus[] = [
  "READY",
  "RECORDING",
  "RECONNECTING",
  "PROVIDER_DEGRADED",
  "STOPPING",
];

type FirstTokenLatencyRow = {
  count: bigint;
  averageMs: number | string | null;
  p95Ms: number | string | null;
};

function positiveNumberEnv(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function decimalString(value: Prisma.Decimal | null | undefined) {
  return value?.toFixed(6) ?? "0.000000";
}

function integerString(value: bigint | number | null | undefined) {
  return value == null ? "0" : value.toString();
}

function optionalMilliseconds(value: number | string | null | undefined) {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : null;
  return numeric != null && Number.isFinite(numeric)
    ? Math.max(0, Math.round(numeric))
    : null;
}

async function firstTokenLatency(windowStart: Date) {
  const rows = await prisma.$queryRaw<FirstTokenLatencyRow[]>(Prisma.sql`
    with first_transcript_event as (
      select distinct on ("sessionId")
        "sessionId",
        "createdAt"
      from transcript_events
      where "eventType" in ('PARTIAL_TRANSCRIPT', 'FINAL_TRANSCRIPT')
      order by "sessionId", "sequenceNo" asc
    )
    select
      count(*)::bigint as "count",
      avg(extract(epoch from (fte."createdAt" - ls."startedAt")) * 1000)::double precision as "averageMs",
      percentile_cont(0.95) within group (
        order by extract(epoch from (fte."createdAt" - ls."startedAt")) * 1000
      )::double precision as "p95Ms"
    from live_sessions ls
    join first_transcript_event fte on fte."sessionId" = ls.id
    where ls."startedAt" is not null
      and fte."createdAt" >= ${windowStart}
      and fte."createdAt" >= ls."startedAt"
  `);

  const row = rows[0];
  return {
    samples: Number(row?.count ?? 0n),
    averageMs: optionalMilliseconds(row?.averageMs),
    p95Ms: optionalMilliseconds(row?.p95Ms),
  };
}

async function main() {
  const collectedAt = new Date();
  const windowSeconds = positiveNumberEnv(
    "BABBLEDECK_METRICS_WINDOW_SECONDS",
    3600,
  );
  const windowStart = new Date(collectedAt.getTime() - windowSeconds * 1000);

  const [
    sessionTotal,
    sessionStatusRows,
    recorderConnectionsTotal,
    activeRecorderConnections,
    activeViewerParticipants,
    viewerJoinsLastWindow,
    providerErrorsLastWindow,
    providerUsageTotal,
    providerUsageWindow,
    sessionCostTotal,
    firstTokenLatencyWindow,
    audioUploaded,
    audioFailedLastWindow,
    authFailuresLastWindow,
    exportCompletedTotal,
    exportFailedTotal,
  ] = await Promise.all([
    prisma.liveSession.count(),
    prisma.liveSession.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.recorderConnection.count(),
    prisma.recorderConnection.count({ where: { endedAt: null } }),
    prisma.sessionParticipant.count({
      where: { role: "VIEWER", leftAt: null },
    }),
    prisma.sessionParticipant.count({
      where: {
        role: "VIEWER",
        joinedAt: { gte: windowStart },
      },
    }),
    prisma.transcriptEvent.count({
      where: {
        eventType: "PROVIDER_ERROR",
        createdAt: { gte: windowStart },
      },
    }),
    prisma.providerUsage.aggregate({
      _sum: { audioMs: true, estimatedCostUsd: true },
    }),
    prisma.providerUsage.aggregate({
      where: { createdAt: { gte: windowStart } },
      _sum: { audioMs: true, estimatedCostUsd: true },
    }),
    prisma.liveSession.aggregate({
      _sum: { estimatedCostUsd: true },
    }),
    firstTokenLatency(windowStart),
    prisma.audioChunk.aggregate({
      where: { status: "UPLOADED" },
      _count: { _all: true },
      _sum: { byteSize: true, durationMs: true },
    }),
    prisma.audioChunk.count({
      where: {
        status: "FAILED",
        uploadedAt: { gte: windowStart },
      },
    }),
    prisma.auditLog.count({
      where: {
        action: "auth.login_failed",
        createdAt: { gte: windowStart },
      },
    }),
    prisma.exportRecord.count({ where: { status: "COMPLETED" } }),
    prisma.exportRecord.count({ where: { status: "FAILED" } }),
  ]);

  const sessionsByStatus = Object.fromEntries(
    sessionStatusRows.map((row) => [row.status, row._count._all]),
  );

  const activeSessions = ACTIVE_SESSION_STATUSES.reduce(
    (total, status) => total + (sessionsByStatus[status] ?? 0),
    0,
  );

  const record = {
    app: "babbledeck",
    collectedAt: collectedAt.toISOString(),
    windowSeconds,
    sessions: {
      total: sessionTotal,
      active: activeSessions,
      recording: sessionsByStatus.RECORDING ?? 0,
      reconnecting: sessionsByStatus.RECONNECTING ?? 0,
      degraded: sessionsByStatus.PROVIDER_DEGRADED ?? 0,
      completed: sessionsByStatus.COMPLETED ?? 0,
      failed: sessionsByStatus.FAILED ?? 0,
      archived: sessionsByStatus.ARCHIVED ?? 0,
      byStatus: sessionsByStatus,
    },
    connections: {
      recorderTotal: recorderConnectionsTotal,
      recorderActive: activeRecorderConnections,
      viewerActive: activeViewerParticipants,
      viewerJoinsLastWindow,
    },
    provider: {
      errorsLastWindow: providerErrorsLastWindow,
      audioMsTotal: providerUsageTotal._sum.audioMs ?? 0,
      audioMsLastWindow: providerUsageWindow._sum.audioMs ?? 0,
      estimatedUsageCostUsdTotal: decimalString(
        providerUsageTotal._sum.estimatedCostUsd,
      ),
      estimatedUsageCostUsdLastWindow: decimalString(
        providerUsageWindow._sum.estimatedCostUsd,
      ),
      estimatedSessionCostUsdTotal: decimalString(
        sessionCostTotal._sum.estimatedCostUsd,
      ),
      firstTokenLatencyLastWindow: firstTokenLatencyWindow,
    },
    audio: {
      uploadedChunksTotal: audioUploaded._count._all,
      uploadFailuresLastWindow: audioFailedLastWindow,
      uploadedBytesTotal: integerString(audioUploaded._sum.byteSize),
      uploadedDurationMsTotal: audioUploaded._sum.durationMs ?? 0,
    },
    auth: {
      failuresLastWindow: authFailuresLastWindow,
    },
    exports: {
      completedTotal: exportCompletedTotal,
      failedTotal: exportFailedTotal,
    },
  };

  process.stdout.write(`${JSON.stringify(record)}\n`);
}

main()
  .catch((error) => {
    console.error(
      error instanceof Error
        ? error.message
        : "Production metrics collection failed.",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
