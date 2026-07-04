import { fail } from "@/server/api";
import { prisma } from "@/server/db";
import { getSessionByShareToken } from "@/server/session-service";
import {
  serializeEvent,
  serializeSegment,
  serializeSession,
} from "@/server/serializers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();

function sse(event: string, data: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ shareToken: string }> },
) {
  const { shareToken } = await context.params;
  const session = await getSessionByShareToken(shareToken);
  if (!session) return fail("NOT_FOUND", "Session link not found.", 404);

  const url = new URL(request.url);
  let lastSequence = Number(url.searchParams.get("after") ?? 0);
  if (!Number.isFinite(lastSequence)) lastSequence = 0;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(interval);
        controller.close();
      };

      async function sendSnapshot() {
        const freshSession = await getSessionByShareToken(shareToken);
        if (!freshSession || closed) {
          close();
          return;
        }

        const events = await prisma.transcriptEvent.findMany({
          where: {
            sessionId: freshSession.id,
            sequenceNo: lastSequence > 0 ? { gt: lastSequence } : undefined,
          },
          orderBy: { sequenceNo: "asc" },
          take: 100,
        });

        if (events.length) {
          lastSequence = Math.max(...events.map((event) => event.sequenceNo));
        }

        controller.enqueue(
          sse("snapshot", {
            session: serializeSession(freshSession),
            events: events.map(serializeEvent),
            segments: freshSession.transcriptSegments.map(serializeSegment),
          }),
        );
      }

      const interval = setInterval(() => {
        void sendSnapshot().catch(() => {
          if (!closed) {
            controller.enqueue(
              sse("stream.error", {
                message: "Live stream delayed. Retrying.",
              }),
            );
          }
        });
      }, 1000);

      request.signal.addEventListener("abort", close);

      await sendSnapshot();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
