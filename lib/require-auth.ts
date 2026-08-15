import { cookies, headers } from "next/headers";
import { COOKIE_NAME, tokenMatches } from "./auth";

export async function isAuthed(): Promise<boolean> {
  // Yerelde giriş adımını atla; canlı alan adında şifre koruması sürer.
  if (process.env.NODE_ENV === "development") return true;

  const host = (await headers()).get("host") ?? "";
  if (/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host)) return true;

  const store = await cookies();
  return tokenMatches(store.get(COOKIE_NAME)?.value);
}
