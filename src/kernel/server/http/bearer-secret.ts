import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

const BEARER_PREFIX = "Bearer ";

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

// Fails closed: a missing secret rejects every request instead of letting everyone in.
// Hashing both sides gives equal-length buffers, so the comparison leaks neither content nor length.
export function isAuthorizedBySecret(
  request: Request,
  secret: string | undefined,
): boolean {
  if (!secret) return false;

  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith(BEARER_PREFIX)) return false;

  const token = header.slice(BEARER_PREFIX.length);
  return timingSafeEqual(sha256(token), sha256(secret));
}
