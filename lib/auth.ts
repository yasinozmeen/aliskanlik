import { createHmac } from "crypto";

const SECRET = process.env.AUTH_SECRET || "dev-secret";
export const COOKIE_NAME = "aliskanlik_auth";

export function authToken(): string {
  return createHmac("sha256", SECRET).update("aliskanlik-auth-v1").digest("hex");
}

export function checkPassword(password: string): boolean {
  const expected = process.env.APP_PASSWORD || "";
  return expected.length > 0 && password === expected;
}
