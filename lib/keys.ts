import { createHash, randomBytes } from "crypto";

export function newApiKey() {
  return `sb_live_${randomBytes(24).toString("base64url")}`;
}

export function newClaimToken() {
  return randomBytes(24).toString("base64url");
}

export function hashSecret(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
