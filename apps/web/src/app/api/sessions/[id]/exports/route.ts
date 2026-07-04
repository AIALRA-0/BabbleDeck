import { getCurrentUser } from "@/server/auth";
import { fail, ok, validationError } from "@/server/api";
import { buildExport, getSessionForAdmin } from "@/server/session-service";
import { exportSchema } from "@/server/schemas";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED", "Authentication required.", 401);
  const { id } = await context.params;
  const session = await getSessionForAdmin(id, user.id);
  if (!session) return fail("NOT_FOUND", "Session not found.", 404);
  let parsed;
  try {
    parsed = exportSchema.parse(await request.json());
  } catch (error) {
    return validationError(error);
  }
  const record = await buildExport({
    sessionId: id,
    requestedByUserId: user.id,
    options: {
      title: session.title,
      format: parsed.format,
      includeOriginal: parsed.includeOriginal,
      includeTranslation: parsed.includeTranslation,
      includeTimestamps: parsed.includeTimestamps,
    },
  });
  if (!record) return fail("EXPORT_FAILED", "Export failed.", 500);
  return ok({
    exportId: record.id,
    downloadUrl: `/api/exports/${record.id}/download`,
  });
}
