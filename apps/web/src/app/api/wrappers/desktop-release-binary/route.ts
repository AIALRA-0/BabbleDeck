export const runtime = "nodejs";

import { fail, requireApiUser } from "@/server/api";
import {
  desktopReleaseBinaryPath,
  readWrapperArtifact,
} from "@/server/wrapper-artifacts";

export async function GET() {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  let result;
  try {
    result = await readWrapperArtifact(desktopReleaseBinaryPath());
  } catch {
    return fail(
      "NOT_FOUND",
      "Desktop release binary has not been built on this server.",
      404,
    );
  }

  return new Response(new Uint8Array(result.contents), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition":
        'attachment; filename="babbledeck-desktop-linux-x64"',
      "Content-Length": String(
        result.artifact.sizeBytes ?? result.contents.length,
      ),
      "X-BabbleDeck-Artifact-SHA256": result.artifact.sha256 ?? "",
      "Cache-Control": "no-store",
    },
  });
}
