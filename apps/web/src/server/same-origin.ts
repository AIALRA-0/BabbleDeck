type SameOriginResult =
  | { allowed: true }
  | { allowed: false; reason: "bad_origin" | "bad_fetch_site" };

function normalizedOrigin(value: string | null) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function requestOrigin(request: Request) {
  const requestUrl = new URL(request.url);
  const forwardedProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();
  const forwardedHost =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!forwardedHost) return requestUrl.origin;
  const protocol = forwardedProto || requestUrl.protocol.replace(":", "");
  return `${protocol}://${forwardedHost}`;
}

export function validateSameOriginMutation(request: Request): SameOriginResult {
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return { allowed: false, reason: "bad_fetch_site" };
  }

  const origin = normalizedOrigin(request.headers.get("origin"));
  if (origin && origin !== normalizedOrigin(requestOrigin(request))) {
    return { allowed: false, reason: "bad_origin" };
  }

  return { allowed: true };
}
