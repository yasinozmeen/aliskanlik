import { createHmac, timingSafeEqual } from "crypto";

export const COOKIE_NAME = "aliskanlik_auth";

function authSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET üretim ortamında zorunludur.");
  }
  return "dev-secret";
}

export function authToken(): string {
  return createHmac("sha256", authSecret()).update("aliskanlik-auth-v1").digest("hex");
}

/** Çerezdeki jetonu beklenenle zamanlama-güvenli karşılaştırır. */
export function tokenMatches(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const actual = Buffer.from(value);
  const expected = Buffer.from(authToken());
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function checkPassword(password: unknown): boolean {
  const expected = process.env.APP_PASSWORD || "";
  if (!expected || typeof password !== "string") return false;

  const actualBuffer = Buffer.from(password);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}
