import { fail, requireApiUser } from "@/server/api";
import { prisma } from "@/server/db";

const contentTypes = {
  MARKDOWN: "text/markdown; charset=utf-8",
  TXT: "text/plain; charset=utf-8",
  JSON: "application/json; charset=utf-8",
  SRT: "application/x-subrip; charset=utf-8",
  VTT: "text/vtt; charset=utf-8",
} as const;

type ExportContentType = keyof typeof contentTypes;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const { id } = await context.params;
  const record = await prisma.exportRecord.findFirst({
    where: {
      id,
      session: { ownerUserId: user.id },
    },
    include: { session: true },
  });
  if (!record) return fail("NOT_FOUND", "Export not found.", 404);
  const format = record.format as ExportContentType;
  const ext = format.toLowerCase();
  const filename = `${record.session.title.replace(/[^a-z0-9_-]+/gi, "-").slice(0, 64)}.${ext}`;
  return new Response(record.content, {
    headers: {
      "Content-Type": contentTypes[format],
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
