export const runtime = "nodejs";

import { fail, requireApiUser } from "@/server/api";
import {
  androidDebugApkPath,
  readWrapperArtifact,
} from "@/server/wrapper-artifacts";

export async function GET() {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  let result;
  try {
    result = await readWrapperArtifact(androidDebugApkPath());
  } catch {
    return fail(
      "NOT_FOUND",
      "Android debug APK has not been built on this server.",
      404,
    );
  }

  return new Response(new Uint8Array(result.contents), {
    headers: {
      "Content-Type": "application/vnd.android.package-archive",
      "Content-Disposition": 'attachment; filename="babbledeck-debug.apk"',
      "Content-Length": String(
        result.artifact.sizeBytes ?? result.contents.length,
      ),
      "X-BabbleDeck-Artifact-SHA256": result.artifact.sha256 ?? "",
      "Cache-Control": "no-store",
    },
  });
}
