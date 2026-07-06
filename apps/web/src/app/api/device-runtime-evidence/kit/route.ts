export const runtime = "nodejs";

import { fail, requireApiUser } from "@/server/api";
import {
  buildDeviceRuntimeEvidenceChecklist,
  deviceRuntimeEvidenceCommand,
  getDeviceRuntimeEvidenceStatus,
} from "@/server/device-runtime-evidence";
import {
  getAndroidDebugApkArtifact,
  getDesktopReleaseBinaryArtifact,
  type WrapperArtifact,
} from "@/server/wrapper-artifacts";

function artifactPayload(
  artifact: WrapperArtifact,
  route: string,
  filename: string,
  contentType: string,
  baseUrl: string,
  handoffRoute?: string,
) {
  return {
    url: route,
    loginUrl: loginProtectedUrl(baseUrl, route),
    handoffUrl: handoffRoute ? loginProtectedUrl(baseUrl, handoffRoute) : null,
    filename,
    contentType,
    exists: artifact.exists,
    sizeBytes: artifact.sizeBytes ?? null,
    sha256: artifact.sha256 ?? null,
  };
}

function loginProtectedUrl(baseUrl: string, nextPath: string) {
  const url = new URL("/login", baseUrl);
  url.searchParams.set("next", nextPath);
  return url.toString();
}

export async function GET() {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  let checklist;
  try {
    checklist = buildDeviceRuntimeEvidenceChecklist();
  } catch {
    return fail(
      "INTERNAL_ERROR",
      "Production release metadata is unavailable.",
      500,
    );
  }

  const [status, androidDebugApk, desktopReleaseBinary] = await Promise.all([
    getDeviceRuntimeEvidenceStatus({
      baseUrl: checklist.baseUrl,
      releaseCommit: checklist.release.commit,
    }),
    getAndroidDebugApkArtifact(),
    getDesktopReleaseBinaryArtifact(),
  ]);
  const payload = {
    ok: true,
    data: {
      app: "babbledeck",
      kind: "device-runtime-verification-kit",
      generatedAt: new Date().toISOString(),
      baseUrl: checklist.baseUrl,
      release: checklist.release,
      checklist: {
        url: "/api/device-runtime-evidence/checklist",
        filename: `babbledeck-device-runtime-${checklist.release.commit}.md`,
      },
      handoffs: {
        android: loginProtectedUrl(checklist.baseUrl, "/install/android"),
        ios: loginProtectedUrl(checklist.baseUrl, "/install/ios"),
        desktop: loginProtectedUrl(checklist.baseUrl, "/install/desktop"),
      },
      artifacts: {
        androidDebugApk: artifactPayload(
          androidDebugApk,
          "/api/wrappers/android-debug-apk",
          "babbledeck-debug.apk",
          "application/vnd.android.package-archive",
          checklist.baseUrl,
          "/install/android",
        ),
        desktopReleaseBinary: artifactPayload(
          desktopReleaseBinary,
          "/api/wrappers/desktop-release-binary",
          "babbledeck-desktop-linux-x64",
          "application/octet-stream",
          checklist.baseUrl,
          "/install/desktop",
        ),
      },
      evidence: {
        status,
        recordEndpoint: "/api/device-runtime-evidence",
        commands: {
          android: deviceRuntimeEvidenceCommand("android"),
          ios: deviceRuntimeEvidenceCommand("ios"),
          desktop: deviceRuntimeEvidenceCommand("desktop"),
        },
      },
      finalVerificationCommand: `pnpm tsx scripts/check-production-readiness.ts --base-url=${checklist.baseUrl} --check-soniox-live --expected-release-commit=${checklist.release.commit} --strict`,
    },
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="babbledeck-device-runtime-kit-${checklist.release.commit}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
