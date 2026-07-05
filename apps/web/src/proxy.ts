import { NextResponse, type NextRequest } from "next/server";
import { requestIdFromHeaders, requestLogRecord } from "@/server/request-id";
import { isSuspiciousProbePath } from "@/server/suspicious-probe";

function shouldLogRequest(pathname: string) {
  if (process.env.BABBLEDECK_REQUEST_LOGS === "0") return false;
  if (pathname === "/api/health") return false;
  return process.env.NODE_ENV === "production";
}

export function proxy(request: NextRequest) {
  const requestId = requestIdFromHeaders(request.headers);

  if (shouldLogRequest(request.nextUrl.pathname)) {
    console.log(
      JSON.stringify(
        requestLogRecord({
          requestId,
          method: request.method,
          path: request.nextUrl.pathname,
          search: request.nextUrl.search,
          ip: request.headers.get("x-real-ip"),
          userAgent: request.headers.get("user-agent"),
        }),
      ),
    );
  }

  if (isSuspiciousProbePath(request.nextUrl.pathname)) {
    const response = new NextResponse("Not found", {
      status: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8",
      },
    });
    response.headers.set("x-request-id", requestId);
    response.headers.set("x-correlation-id", requestId);
    return response;
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  response.headers.set("x-request-id", requestId);
  response.headers.set("x-correlation-id", requestId);

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/).*)",
  ],
};
