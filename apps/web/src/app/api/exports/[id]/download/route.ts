import { getCurrentUser } from "@/server/auth";
import { fail } from "@/server/api";
import { prisma } from "@/server/db";

const contentTypes = {
  MARKDOWN: "text/markdown; charset=utf-8",
  TXT: "text/plain; charset=utf-8",
  JSON: "application/json; charset=utf-8",
  SRT: "application/x-subrip; charset=utf-8",
  VTT: "text/vtt; charset=utf-8",
} as const;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED", "Authentication required.", 401);
  const { id } = await context.params;
  const record = await prisma.exportRecord.findFirst({
    where: {
      id,
      session: { ownerUserId: user.id },
    },
    include: { session: true },
  });
  if (!record) return fail("NOT_FOUND", "Export not found.", 404);
  const ext = record.format.toLowerCase();
  const filename = `${record.session.title.replace(/[^a-z0-9_-]+/gi, "-").slice(0, 64)}.${ext}`;
  return new Response(record.content, {
    headers: {
      "Content-Type": contentTypes[record.format],
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
