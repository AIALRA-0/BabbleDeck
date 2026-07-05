import { NextResponse } from "next/server";
import { getHealthStatus } from "@/server/health";

export const dynamic = "force-dynamic";

export async function GET() {
  const health = await getHealthStatus();
  return NextResponse.json(
    {
      ok: health.status === "ok",
      data: health,
    },
    {
      status: health.checks.database.ok ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
