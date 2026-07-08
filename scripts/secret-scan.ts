import { createHash } from "node:crypto";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const blockedTokenHashes = new Map([
  [
    "9ad4506456f535e1974792c63abbe2a132a877bf72ab4839015505b52a1c09e0",
    "leaked_seed_admin_password",
  ],
  [
    "f47e667363a1b8b45c71ade74c31d35592c46a9194aef98f40a83a49f70325d8",
    "leaked_seed_admin_email",
  ],
]);

const ignoredPathPatterns = [
  /^node_modules\//,
  /^apps\/web\/\.next\//,
  /^pnpm-lock\.yaml$/,
  /^\.git\//,
];

function trackedFiles() {
  return execFileSync("git", ["ls-files"], { encoding: "utf8" })
    .trim()
    .split("\n")
    .filter(Boolean)
    .filter(
      (file) => !ignoredPathPatterns.some((pattern) => pattern.test(file)),
    );
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function tokenCandidates(text: string) {
  return text.match(/[A-Za-z0-9@._:/+=-]{8,}/g) ?? [];
}

const findings: Array<{ file: string; kind: string }> = [];

for (const file of trackedFiles()) {
  let buffer: Buffer;
  try {
    buffer = fs.readFileSync(file);
  } catch {
    continue;
  }
  if (buffer.includes(0)) continue;

  const text = buffer.toString("utf8");
  for (const token of tokenCandidates(text)) {
    const kind = blockedTokenHashes.get(sha256(token));
    if (kind) findings.push({ file, kind });
  }
}

if (findings.length > 0) {
  for (const finding of findings) {
    console.error(`${finding.kind}: ${finding.file}`);
  }
  process.exit(1);
}

console.log("No blocked plaintext secrets found.");
