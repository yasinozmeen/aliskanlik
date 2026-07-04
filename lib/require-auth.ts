import { cookies } from "next/headers";
import { authToken, COOKIE_NAME } from "./auth";

export async function isAuthed(): Promise<boolean> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value === authToken();
}
