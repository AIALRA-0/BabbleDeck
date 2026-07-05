import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type AuditCheck = {
  name: string;
  ok: boolean;
  message: string;
};

const SECRET_SCAN_PATTERN = [
  "Aial" + "rla",
  "SMOKE_" + "PASSWORD",
  "SECRET_" + "ACCESS_KEY=.*" + "[A-Za-z0-9]{8}",
  "SONIOX_API_KEY=.*" + "[A-Za-z0-9]{8}",
  "SEED_ADMIN_" + "PASSWORD=.*" + "Aial",
  "R2_SECRET_" + "ACCESS_KEY=.*" + "[A-Za-z0-9]{8}",
].join("|");

const REQUIRED_ENV_EXAMPLE_KEYS = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "SEED_ADMIN_EMAIL",
  "SEED_ADMIN_PASSWORD",
  "SONIOX_API_KEY",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
];

const SENSITIVE_ENV_NAMES = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "SEED_ADMIN_PASSWORD",
  "SONIOX_API_KEY",
  "AUDIO_STORAGE_SECRET_ACCESS_KEY",
  "R2_SECRET_ACCESS_KEY",
  "S3_SECRET_ACCESS_KEY",
  "AWS_SECRET_ACCESS_KEY",
  "OPENAI_API_KEY",
  "AZURE_TRANSLATOR_KEY",
];

function argValue(name: string) {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

function addCheck(checks: AuditCheck[], input: AuditCheck) {
  checks.push(input);
}

function codeFromError(error: unknown) {
  return typeof error === "object" && error && "code" in error
    ? Number((error as { code?: unknown }).code)
    : null;
}

async function readText(relativePath: string) {
  return fs.readFile(path.join(process.cwd(), relativePath), "utf8");
}

async function repoSecretScan(checks: AuditCheck[]) {
  try {
    const { stdout } = await execFileAsync("rg", [
      "-n",
      SECRET_SCAN_PATTERN,
      ".",
      "--glob",
      "!node_modules/**",
      "--glob",
      "!apps/web/.next/**",
      "--glob",
      "!pnpm-lock.yaml",
    ]);
    const matches = stdout.split(/\r?\n/).filter(Boolean).length;
    addCheck(checks, {
      name: "repo_secret_scan",
      ok: false,
      message: `Repository secret-like scan found ${matches} matching line(s).`,
    });
  } catch (error) {
    if (codeFromError(error) === 1) {
      addCheck(checks, {
        name: "repo_secret_scan",
        ok: true,
        message: "Repository secret-like scan found no matches.",
      });
      return;
    }
    addCheck(checks, {
      name: "repo_secret_scan",
      ok: false,
      message: "Repository secret-like scan could not run.",
    });
  }
}

async function envExamplePlaceholders(checks: AuditCheck[]) {
  try {
    const contents = await readText(".env.example");
    const missing = REQUIRED_ENV_EXAMPLE_KEYS.filter(
      (key) => !new RegExp(`^${key}=`, "m").test(contents),
    );
    const assignments = contents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        return index === -1
          ? null
          : { key: line.slice(0, index), value: line.slice(index + 1) };
      })
      .filter((item): item is { key: string; value: string } => Boolean(item));
    const suspicious = assignments
      .filter(({ key, value }) =>
        /PASSWORD|SECRET|API_KEY|ACCESS_KEY|TOKEN|_KEY$/i.test(key)
          ? value &&
            !value.startsWith("replace-with") &&
            !value.includes("placeholder")
          : false,
      )
      .map(({ key }) => key);

    addCheck(checks, {
      name: "env_example_placeholders",
      ok: missing.length === 0 && suspicious.length === 0,
      message:
        missing.length === 0 && suspicious.length === 0
          ? ".env.example contains required sensitive keys with placeholders or blanks."
          : `Missing keys: ${missing.join(", ") || "none"}; suspicious placeholders: ${
              suspicious.join(", ") || "none"
            }.`,
    });
  } catch {
    addCheck(checks, {
      name: "env_example_placeholders",
      ok: false,
      message: ".env.example could not be read.",
    });
  }
}

async function sourceBaseline(checks: AuditCheck[]) {
  const files = await Promise.all([
    readText("apps/web/src/server/same-origin.ts"),
    readText("apps/web/src/server/login-rate-limit.ts"),
    readText("apps/web/src/server/sensitive-route-rate-limit.ts"),
    readText("apps/web/src/server/session-service.ts"),
    readText("apps/web/src/server/recorder-access.ts"),
    readText("apps/web/src/app/api/sessions/route.ts"),
    readText("apps/web/src/app/api/settings/route.ts"),
    readText("apps/web/src/app/api/auth/login/route.ts"),
    readText("e2e/mvp.spec.ts"),
    readText(".github/workflows/ci.yml"),
  ]);
  const source = files.join("\n");

  const requiredSnippets = [
    "validateSameOriginMutation",
    "LOGIN_RATE_LIMIT_PER_MINUTE",
    "LOGIN_IP_RATE_LIMIT_PER_MINUTE",
    "EXPORT_RATE_LIMIT_PER_MINUTE",
    "AUDIO_CHUNK_UPLOAD_RATE_LIMIT_PER_MINUTE",
    "RECORDER_CONTROL_RATE_LIMIT_PER_MINUTE",
    "TRANSCRIPT_EVENT_APPEND_RATE_LIMIT_PER_MINUTE",
    "shareTokenHash: hashToken",
    "recorderTokenHash: hashToken",
    "auth.login_failed",
    "anonymous users cannot access admin surfaces",
    "Secret scan",
  ];
  const missing = requiredSnippets.filter(
    (snippet) => !source.includes(snippet),
  );
  addCheck(checks, {
    name: "source_security_controls",
    ok: missing.length === 0,
    message:
      missing.length === 0
        ? "Source checks found same-origin guards, rate limits, hashed scoped tokens, auth audit logging, protected-route E2E coverage, and CI secret scan."
        : `Source security controls missing snippets: ${missing.join(", ")}.`,
  });
}

async function securityHeaders(baseUrl: URL, checks: AuditCheck[]) {
  try {
    const response = await fetch(baseUrl, { method: "HEAD" });
    const headers = response.headers;
    const missing = [
      (headers.get("strict-transport-security") ?? "")
        .toLowerCase()
        .includes("max-age=")
        ? undefined
        : "strict-transport-security",
      (headers.get("content-security-policy") ?? "").includes(
        "frame-ancestors 'none'",
      )
        ? undefined
        : "content-security-policy",
      headers.get("x-frame-options")?.toUpperCase() === "DENY"
        ? undefined
        : "x-frame-options",
      headers.get("x-content-type-options")?.toLowerCase() === "nosniff"
        ? undefined
        : "x-content-type-options",
      headers.get("referrer-policy") === "strict-origin-when-cross-origin"
        ? undefined
        : "referrer-policy",
    ].filter((item): item is string => Boolean(item));

    addCheck(checks, {
      name: "live_security_headers",
      ok: response.ok && missing.length === 0,
      message:
        response.ok && missing.length === 0
          ? "Live production security headers are present."
          : `Live production security headers missing or invalid: ${
              missing.join(", ") || "HEAD request failed"
            }.`,
    });
  } catch {
    addCheck(checks, {
      name: "live_security_headers",
      ok: false,
      message: "Live production security headers could not be checked.",
    });
  }
}

async function expectApiError(input: {
  checks: AuditCheck[];
  baseUrl: URL;
  name: string;
  path: string;
  method?: string;
  headers?: HeadersInit;
  body?: string;
  status: number;
  code: string;
}) {
  try {
    const response = await fetch(new URL(input.path, input.baseUrl), {
      method: input.method ?? "GET",
      headers: input.headers,
      body: input.body,
    });
    const body = await response.json();
    const ok =
      response.status === input.status && body?.error?.code === input.code;
    addCheck(input.checks, {
      name: input.name,
      ok,
      message: ok
        ? `${input.path} returned ${input.code} as expected.`
        : `${input.path} returned status ${response.status} and code ${
            body?.error?.code ?? "unknown"
          }, expected ${input.status}/${input.code}.`,
    });
  } catch {
    addCheck(input.checks, {
      name: input.name,
      ok: false,
      message: `${input.path} could not be checked.`,
    });
  }
}

async function liveApiBaseline(baseUrl: URL, checks: AuditCheck[]) {
  await expectApiError({
    checks,
    baseUrl,
    name: "protected_auth_me_requires_auth",
    path: "/api/auth/me",
    status: 401,
    code: "UNAUTHENTICATED",
  });
  await expectApiError({
    checks,
    baseUrl,
    name: "protected_settings_requires_auth",
    path: "/api/settings",
    status: 401,
    code: "UNAUTHENTICATED",
  });
  await expectApiError({
    checks,
    baseUrl,
    name: "protected_sessions_requires_auth",
    path: "/api/sessions",
    status: 401,
    code: "UNAUTHENTICATED",
  });
  await expectApiError({
    checks,
    baseUrl,
    name: "cross_origin_session_mutation_blocked",
    path: "/api/sessions",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://attacker.invalid",
    },
    body: JSON.stringify({
      title: "blocked security baseline mutation",
      providerName: "mock",
      targetLanguage: "zh",
    }),
    status: 403,
    code: "FORBIDDEN",
  });
}

async function healthDoesNotLeakSecrets(baseUrl: URL, checks: AuditCheck[]) {
  try {
    const response = await fetch(new URL("/api/health", baseUrl), {
      headers: { Accept: "application/json" },
    });
    const text = await response.text();
    const leaked = SENSITIVE_ENV_NAMES.filter((name) => {
      const value = process.env[name];
      return value && value.length >= 8 && text.includes(value);
    });
    const parsed = JSON.parse(text);
    const shapeOk =
      parsed?.ok === true &&
      typeof parsed?.data?.checks?.providers?.soniox?.configured === "boolean";
    addCheck(checks, {
      name: "health_endpoint_non_secret",
      ok: response.ok && leaked.length === 0 && shapeOk,
      message:
        response.ok && leaked.length === 0 && shapeOk
          ? "Health endpoint reports booleans without leaking configured secret values."
          : `Health endpoint check failed; leaked names: ${
              leaked.join(", ") || "none"
            }.`,
    });
  } catch {
    addCheck(checks, {
      name: "health_endpoint_non_secret",
      ok: false,
      message: "Health endpoint non-secret shape could not be checked.",
    });
  }
}

async function main() {
  const baseUrl = new URL(
    argValue("--base-url") ??
      process.env.BABBLEDECK_SECURITY_BASE_URL ??
      process.env.BABBLEDECK_BASE_URL ??
      process.env.PRODUCTION_BASE_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      "https://babbledeck.aialra.online",
  );
  const checks: AuditCheck[] = [];
  await repoSecretScan(checks);
  await envExamplePlaceholders(checks);
  await sourceBaseline(checks);
  await securityHeaders(baseUrl, checks);
  await liveApiBaseline(baseUrl, checks);
  await healthDoesNotLeakSecrets(baseUrl, checks);

  const ok = checks.every((check) => check.ok);
  const record = {
    app: "babbledeck",
    checkedAt: new Date().toISOString(),
    baseUrl: baseUrl.toString(),
    ok,
    checks,
  };
  process.stdout.write(`${JSON.stringify(record)}\n`);
  if (!ok) process.exitCode = 1;
}

main().catch((error) => {
  const record = {
    app: "babbledeck",
    checkedAt: new Date().toISOString(),
    ok: false,
    error:
      error instanceof Error
        ? error.message
        : "Security baseline audit failed.",
  };
  process.stdout.write(`${JSON.stringify(record)}\n`);
  process.exitCode = 1;
});
