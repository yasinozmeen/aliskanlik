/* Google Tasks → Telegram mesajı.
   /gorevler komutu ve akşam özetindeki "Listeyi göster" butonu aynı listeyi
   üretir; her görev bir ✅ butonu, callback_data `task_<googleId>`.
   Telegram callback_data sınırı 64 bayt — sığmayan (çok uzun id'li) görev
   butonsuz düz satır olarak yazılır. */

import { gtasksConfigured, listOpenTasks } from "@/lib/gtasks";

export const TASK_CB_PREFIX = "task_";
export const TASKS_LIST_CB = "tasks_list";
const MAX_BUTTONS = 30; // Telegram inline keyboard üst sınırı 100; okunabilirlik için 30
const CB_LIMIT = 64;

type InlineButton = { text: string; callback_data: string };

export type TasksMessage = {
  text: string;
  reply_markup?: { inline_keyboard: InlineButton[][] };
};

export const escapeHtml = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const clip = (t: string, n: number) => (t.length > n ? t.slice(0, n - 1) + "…" : t);

export async function buildTasksMessage(siteUrl: string): Promise<TasksMessage> {
  if (!gtasksConfigured()) {
    return { text: "⚠️ Google Tasks bağlı değil." };
  }
  const tasks = await listOpenTasks();
  if (tasks.length === 0) {
    return { text: "📋 Google'da açık görev yok. 🎉" };
  }

  const buttons: InlineButton[][] = [];
  const overflow: string[] = [];
  for (const t of tasks) {
    const cb = TASK_CB_PREFIX + t.id;
    if (buttons.length < MAX_BUTTONS && Buffer.byteLength(cb) <= CB_LIMIT) {
      buttons.push([{ text: `✅ ${clip(t.title, 40)}`, callback_data: cb }]);
    } else {
      overflow.push(t.title);
    }
  }

  let text = `📋 <b>Açık görevler (${tasks.length})</b>\nButona basınca Google'da kapanır.`;
  if (overflow.length) {
    text +=
      `\n\nButonsuz (${overflow.length}):\n` +
      overflow.map((t) => `• ${escapeHtml(clip(t, 60))}`).join("\n") +
      `\n<a href="${siteUrl}">Sitede aç</a>`;
  }
  return buttons.length ? { text, reply_markup: { inline_keyboard: buttons } } : { text };
}

/** Akşam özeti için tek satır + buton. Görev yoksa null (özet eklenmez). */
export async function buildTasksDigest(): Promise<TasksMessage | null> {
  if (!gtasksConfigured()) return null;
  const tasks = await listOpenTasks();
  if (tasks.length === 0) return null;
  return {
    text: `📋 Google'da ${tasks.length} açık görev var.`,
    reply_markup: { inline_keyboard: [[{ text: "Listeyi göster", callback_data: TASKS_LIST_CB }]] },
  };
}

/* Telegram'ın komut menüsü (mesaj kutusundaki "/" düğmesi). Uygulama her
   açıldığında yeniden yazılır; BotFather'dan elle girilmiş eski liste silinir. */
export async function registerBotCommands(): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return;
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/setMyCommands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        commands: [
          { command: "gorevler", description: "Google'daki açık görevleri göster" },
          { command: "bugun", description: "Bugün kalan alışkanlıkları göster" },
        ],
      }),
    });
    if (!res.ok) console.error("setMyCommands failed:", res.status, await res.text());
  } catch (e) {
    console.error("setMyCommands error:", e);
  }
}
