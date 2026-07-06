import {
  buildDeviceRuntimeEvidenceChecklistMarkdown,
  deviceRuntimePlatforms,
  type DeviceRuntimePlatform,
  type DeviceRuntimeRelease,
} from "../apps/web/src/server/device-runtime-evidence";

type Platform = DeviceRuntimePlatform;
type ReleaseInfo = DeviceRuntimeRelease;

function argValue(name: string) {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

function baseUrl() {
  return (
    argValue("--base-url") ??
    process.env.BABBLEDECK_BASE_URL ??
    "https://babbledeck.aialra.online"
  );
}

function selectedPlatforms() {
  const raw = argValue("--platforms");
  if (!raw) return [...deviceRuntimePlatforms];
  const selected = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const invalid = selected.filter(
    (item) => !deviceRuntimePlatforms.includes(item as Platform),
  );
  if (invalid.length > 0) {
    throw new Error(`Invalid platform(s): ${invalid.join(", ")}.`);
  }
  return selected as Platform[];
}

function safeText(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value
        .replace(/[\r\n\t]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    : undefined;
}

async function productionRelease(url: string): Promise<ReleaseInfo> {
  const response = await fetch(new URL("/api/health", url), {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(
      `Production health endpoint returned HTTP ${response.status}.`,
    );
  }
  const body = await response.json();
  const release = body?.data?.release;
  const commit = safeText(release?.commit);
  if (!commit) {
    throw new Error(
      "Production health endpoint did not report release.commit.",
    );
  }
  return {
    commit,
    branch: safeText(release?.branch),
    builtAt: safeText(release?.builtAt),
  };
}

async function main() {
  const url = baseUrl();
  const release = await productionRelease(url);
  const generatedAt = new Date().toISOString();
  const selected = selectedPlatforms();
  const output = {
    app: "babbledeck",
    kind: "device-runtime-evidence-checklist",
    generatedAt,
    baseUrl: url,
    release,
    platforms: selected,
  };

  if (argValue("--format") === "json") {
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    return;
  }

  process.stdout.write(
    buildDeviceRuntimeEvidenceChecklistMarkdown({
      baseUrl: url,
      release,
      generatedAt,
      platforms: selected,
    }),
  );
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : "Device runtime evidence checklist failed.",
  );
  process.exitCode = 1;
});
