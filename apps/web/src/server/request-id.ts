const REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validRequestId(
  value: string | null | undefined,
): value is string {
  return typeof value === "string" && REQUEST_ID_PATTERN.test(value);
}

export function requestIdFromHeaders(headers: Pick<Headers, "get">) {
  const requestId = headers.get("x-request-id");
  return validRequestId(requestId) ? requestId : crypto.randomUUID();
}

export function requestLogRecord(input: {
  requestId: string;
  method: string;
  path: string;
  search?: string;
  ip?: string | null;
  userAgent?: string | null;
}) {
  return {
    app: "babbledeck",
    event: "http.request",
    requestId: input.requestId,
    method: input.method,
    path: input.path,
    search: input.search || undefined,
    ip: input.ip || undefined,
    userAgent: input.userAgent || undefined,
    loggedAt: new Date().toISOString(),
  };
}
