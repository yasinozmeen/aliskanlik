/* Google Tasks entegrasyonu.
   Pi'deki gogcli token'ından alınan refresh_token + OAuth client ile access token
   yenilenir ve Tasks API'ye doğrudan konuşulur. Kimlik bilgileri env'den gelir
   (repoda TUTULMAZ). tasks scope'u zaten bu token'da mevcut. */

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN || "";
const TASKLIST = process.env.GOOGLE_TASKLIST || "@default";

export function gtasksConfigured(): boolean {
  return !!(CLIENT_ID && CLIENT_SECRET && REFRESH_TOKEN);
}

let _token: { value: string; exp: number } | null = null;

async function accessToken(): Promise<string> {
  const now = Date.now();
  if (_token && _token.exp > now + 30_000) return _token.value;

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: REFRESH_TOKEN,
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error("token refresh failed: " + res.status);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  _token = { value: j.access_token, exp: now + j.expires_in * 1000 };
  return j.access_token;
}

export type GTask = { id: string; title: string };

export async function listOpenTasks(): Promise<GTask[]> {
  const at = await accessToken();
  const url =
    `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(TASKLIST)}/tasks` +
    `?showCompleted=false&maxResults=100`;
  const res = await fetch(url, { headers: { Authorization: "Bearer " + at } });
  if (!res.ok) throw new Error("tasks list failed: " + res.status);
  const j = (await res.json()) as { items?: { id: string; title?: string; status?: string }[] };
  return (j.items || [])
    .filter((t) => t.status !== "completed" && t.title && t.title.trim() !== "")
    .map((t) => ({ id: t.id, title: t.title!.trim() }));
}

export async function completeTask(taskId: string): Promise<void> {
  const at = await accessToken();
  const url = `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(TASKLIST)}/tasks/${encodeURIComponent(taskId)}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { Authorization: "Bearer " + at, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "completed" }),
  });
  if (!res.ok) throw new Error("task patch failed: " + res.status);
}
