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
const BUTTONS_PER_ROW = 5;

type InlineButton = { text: string; callback_data: string };

export type TasksMessage = {
  text: string;
  reply_markup?: { inline_keyboard: InlineButton[][] };
};

export const escapeHtml = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function buildTasksMessage(siteUrl: string): Promise<TasksMessage> {
  if (!gtasksConfigured()) {
    return { text: "⚠️ Google Tasks bağlı değil." };
  }
  const tasks = await listOpenTasks();
  if (tasks.length === 0) {
    return { text: "📋 Google'da açık görev yok. 🎉" };
  }

  // Metin tam haliyle numaralı listede; butonlar yalnız numara taşır
  // (Telegram buton yazısını genişliğe göre kırpıyor, uzun başlık okunmuyordu).
  const lines: string[] = [];
  const flat: InlineButton[] = [];
  const noButton: number[] = [];
  tasks.forEach((t, i) => {
    const n = i + 1;
    lines.push(`${n}. ${escapeHtml(t.title)}`);
    const cb = TASK_CB_PREFIX + t.id;
    if (flat.length < MAX_BUTTONS && Buffer.byteLength(cb) <= CB_LIMIT) {
      flat.push({ text: `✅ ${n}`, callback_data: cb });
    } else {
      noButton.push(n);
    }
  });
  const buttons: InlineButton[][] = [];
  for (let i = 0; i < flat.length; i += BUTTONS_PER_ROW) buttons.push(flat.slice(i, i + BUTTONS_PER_ROW));

  let text = `📋 <b>Açık görevler (${tasks.length})</b>\n\n${lines.join("\n")}\n\nNumaraya basınca Google'da kapanır.`;
  if (noButton.length) {
    text += `\n(${noButton.join(", ")} yalnız <a href="${siteUrl}">siteden</a> kapatılabilir.)`;
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
