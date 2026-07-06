export const runtime = "nodejs";

import { fail, requireApiUser } from "@/server/api";
import { buildDeviceRuntimeEvidenceChecklist } from "@/server/device-runtime-evidence";

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

  const filename = `babbledeck-device-runtime-${checklist.release.commit}.md`;
  return new Response(checklist.markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
