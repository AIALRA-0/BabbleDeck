import { prisma } from "../apps/web/src/server/db";

type JsonResponse<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string };
};

type CreateSessionResponse = {
  session: {
    id: string;
    title: string;
    status: string;
  };
  shareToken: string;
  recorderToken: string;
};

type ViewerResult = {
  index: number;
  bytesRead: number;
  firstByteMs: number | null;
  receivedMs: number;
};

function argValue(name: string) {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

function positiveInteger(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function cookiePairs(setCookie: string | null) {
  if (!setCookie) return [];
  return setCookie
    .split(/,(?=[^;,]+=)/)
    .map((part) => part.split(";", 1)[0]?.trim())
    .filter((part): part is string => Boolean(part));
}

function mergeCookies(current: Map<string, string>, response: Response) {
  for (const pair of cookiePairs(response.headers.get("set-cookie"))) {
    const index = pair.indexOf("=");
    if (index <= 0) continue;
    current.set(pair.slice(0, index), pair.slice(index + 1));
  }
}

function cookieHeader(cookies: Map<string, string>) {
  return [...cookies.entries()]
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

async function parseJson<T>(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text) as JsonResponse<T>;
  } catch {
    throw new Error(
      `Expected JSON response from ${response.url}; status ${response.status}; body ${text.slice(0, 200)}`,
    );
  }
}

async function apiJson<T>(
  url: URL,
  init: RequestInit,
  options?: { expectOk?: boolean },
) {
  const response = await fetch(url, init);
  const body = await parseJson<T>(response);
  const ok = response.ok && body.ok === true;
  if ((options?.expectOk ?? true) && !ok) {
    throw new Error(
      `${init.method ?? "GET"} ${url.pathname} failed with ${response.status}: ${
        body.error?.code ?? "UNKNOWN"
      } ${body.error?.message ?? ""}`.trim(),
    );
  }
  return { response, body };
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string) {
  let timeout: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`${label} timed out.`)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

function openViewer(input: {
  index: number;
  baseUrl: URL;
  shareToken: string;
  expectedOriginal: string;
  expectedTranslation: string;
  timeoutMs: number;
}) {
  const controller = new AbortController();
  let markReady!: () => void;
  const ready = new Promise<void>((resolve) => {
    markReady = resolve;
  });
  const startedAt = Date.now();

  const done = (async (): Promise<ViewerResult> => {
    const url = new URL(
      `/api/viewer/session/${input.shareToken}/stream?loadSmokeViewer=${input.index}`,
      input.baseUrl,
    );
    const response = await fetch(url, {
      headers: { Accept: "text/event-stream" },
      signal: controller.signal,
    });
    if (!response.ok || !response.body) {
      throw new Error(
        `viewer ${input.index} stream failed with status ${response.status}.`,
      );
    }
    markReady();
    const decoder = new TextDecoder();
    const reader = response.body.getReader();
    let buffer = "";
    let bytesRead = 0;
    let firstByteMs: number | null = null;
    const deadline = Date.now() + input.timeoutMs;

    try {
      while (Date.now() < deadline) {
        const remaining = Math.max(1, deadline - Date.now());
        const read = await withTimeout(
          reader.read(),
          remaining,
          `viewer ${input.index} stream read`,
        );
        if (read.done) break;
        if (firstByteMs == null) firstByteMs = Date.now() - startedAt;
        bytesRead += read.value.byteLength;
        buffer += decoder.decode(read.value, { stream: true });
        if (
          buffer.includes(input.expectedOriginal) &&
          buffer.includes(input.expectedTranslation)
        ) {
          return {
            index: input.index,
            bytesRead,
            firstByteMs,
            receivedMs: Date.now() - startedAt,
          };
        }
        if (buffer.length > 200_000) buffer = buffer.slice(-100_000);
      }
    } finally {
      controller.abort();
    }

    throw new Error(
      `viewer ${input.index} did not receive the load smoke transcript.`,
    );
  })().catch((error) => {
    markReady();
    throw error;
  });

  return {
    ready,
    done,
    abort: () => controller.abort(),
  };
}

function percentile(values: number[], percentileValue: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.ceil((percentileValue / 100) * sorted.length) - 1,
  );
  return sorted[index];
}

async function archiveSmokeSession(sessionId: string | null) {
  if (!sessionId) return false;
  const updated = await prisma.liveSession.updateMany({
    where: { id: sessionId, archivedAt: null },
    data: {
      archivedAt: new Date(),
      endedAt: new Date(),
      status: "ARCHIVED",
    },
  });
  return updated.count > 0;
}

async function main() {
  const baseUrl = new URL(
    argValue("--base-url") ??
      process.env.BABBLEDECK_LOAD_SMOKE_BASE_URL ??
      process.env.BABBLEDECK_BASE_URL ??
      process.env.PRODUCTION_BASE_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      "https://babbledeck.aialra.online",
  );
  const viewerCount = clamp(
    positiveInteger(
      argValue("--viewers") ?? process.env.BABBLEDECK_LOAD_SMOKE_VIEWERS,
      10,
    ),
    1,
    200,
  );
  const timeoutMs = clamp(
    positiveInteger(process.env.BABBLEDECK_LOAD_SMOKE_TIMEOUT_SECONDS, 45) *
      1000,
    5_000,
    300_000,
  );
  const adminEmail = (
    process.env.BABBLEDECK_LOAD_SMOKE_ADMIN_EMAIL ??
    process.env.SEED_ADMIN_EMAIL ??
    "admin@example.invalid"
  ).toLowerCase();
  const adminPassword =
    process.env.BABBLEDECK_LOAD_SMOKE_ADMIN_PASSWORD ??
    requiredEnv("SEED_ADMIN_PASSWORD");
  const runId = `load-smoke-${Date.now()}`;
  const originalText = `BabbleDeck ${runId} original`;
  const translationText = `BabbleDeck ${runId} translation`;
  const cookies = new Map<string, string>();
  const startedAt = new Date();
  let sessionId: string | null = null;
  const viewers: ReturnType<typeof openViewer>[] = [];

  try {
    const login = await apiJson<{ user: { email: string } }>(
      new URL("/api/auth/login", baseUrl),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: adminEmail, password: adminPassword }),
      },
    );
    mergeCookies(cookies, login.response);
    if (login.body.data?.user.email !== adminEmail) {
      throw new Error("Login smoke returned an unexpected admin user.");
    }

    const create = await apiJson<CreateSessionResponse>(
      new URL("/api/sessions", baseUrl),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieHeader(cookies),
          Origin: baseUrl.origin,
        },
        body: JSON.stringify({
          title: `Load smoke ${new Date().toISOString()}`,
          description: "Automated production load smoke; archived on cleanup.",
          sourceLanguageMode: "auto",
          targetLanguage: "zh",
          providerName: "mock",
          qualityMode: "realtime",
        }),
      },
    );
    sessionId = create.body.data?.session.id ?? null;
    const shareToken = create.body.data?.shareToken;
    const recorderToken = create.body.data?.recorderToken;
    if (!sessionId || !shareToken || !recorderToken) {
      throw new Error("Session creation did not return load smoke tokens.");
    }

    await apiJson(new URL(`/api/sessions/${sessionId}/start`, baseUrl), {
      method: "POST",
      headers: {
        "X-BabbleDeck-Recorder-Token": recorderToken,
      },
    });

    for (let index = 0; index < viewerCount; index += 1) {
      viewers.push(
        openViewer({
          index,
          baseUrl,
          shareToken,
          expectedOriginal: originalText,
          expectedTranslation: translationText,
          timeoutMs,
        }),
      );
    }

    await withTimeout(
      Promise.all(viewers.map((viewer) => viewer.ready)),
      timeoutMs,
      "viewer stream readiness",
    );

    await apiJson(new URL(`/api/sessions/${sessionId}/events`, baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-BabbleDeck-Recorder-Token": recorderToken,
      },
      body: JSON.stringify({
        events: [
          {
            type: "final_transcript",
            text: originalText,
            language: "en",
            targetLanguage: "zh",
            isFinal: true,
            segmentIndex: 0,
            startMs: 0,
            endMs: 1000,
          },
          {
            type: "final_translation",
            text: translationText,
            language: "en",
            targetLanguage: "zh",
            isFinal: true,
            segmentIndex: 0,
            startMs: 0,
            endMs: 1000,
          },
        ],
      }),
    });

    const viewerResults = await withTimeout(
      Promise.all(viewers.map((viewer) => viewer.done)),
      timeoutMs,
      "viewer transcript fanout",
    );

    await apiJson(new URL(`/api/sessions/${sessionId}/stop`, baseUrl), {
      method: "POST",
      headers: {
        "X-BabbleDeck-Recorder-Token": recorderToken,
      },
    });

    const archived = await archiveSmokeSession(sessionId);
    await apiJson(
      new URL("/api/auth/logout", baseUrl),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieHeader(cookies),
          Origin: baseUrl.origin,
        },
        body: "{}",
      },
      { expectOk: false },
    ).catch(() => null);

    const receivedMs = viewerResults.map((result) => result.receivedMs);
    const firstByteMs = viewerResults
      .map((result) => result.firstByteMs)
      .filter((value): value is number => value != null);
    const record = {
      app: "babbledeck",
      checkedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      baseUrl: baseUrl.toString(),
      ok: true,
      viewerCount,
      sessionId,
      archived,
      transcriptFanout: {
        received: viewerResults.length,
        minReceivedMs: Math.min(...receivedMs),
        maxReceivedMs: Math.max(...receivedMs),
        p95ReceivedMs: percentile(receivedMs, 95),
        p95FirstByteMs: percentile(firstByteMs, 95),
      },
      viewers: viewerResults,
    };
    process.stdout.write(`${JSON.stringify(record)}\n`);
  } catch (error) {
    for (const viewer of viewers) viewer.abort();
    const archived = await archiveSmokeSession(sessionId).catch(() => false);
    const record = {
      app: "babbledeck",
      checkedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      baseUrl: baseUrl.toString(),
      ok: false,
      viewerCount,
      sessionId,
      archived,
      error: error instanceof Error ? error.message : "Load smoke failed.",
    };
    process.stdout.write(`${JSON.stringify(record)}\n`);
    process.exitCode = 1;
  }
}

main().finally(async () => {
  await prisma.$disconnect();
});
