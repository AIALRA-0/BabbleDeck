export function clientIpFromHeaders(headers: Headers) {
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwardedFor = headers
    .get("x-forwarded-for")
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .at(-1);
  return forwardedFor ?? "127.0.0.1";
}
