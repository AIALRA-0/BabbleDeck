import crypto from "node:crypto";

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function hashIp(value: string | null | undefined) {
  if (!value) return null;
  const pepper = process.env.AUTH_SECRET ?? "babbledeck-dev-pepper";
  return crypto.createHmac("sha256", pepper).update(value).digest("hex");
}

export function timingSafeEqual(leftValue: string, rightValue: string) {
  const left = Buffer.from(leftValue);
  const right = Buffer.from(rightValue);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}
