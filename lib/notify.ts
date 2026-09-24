/* Telegram alışkanlık hatırlatması — cron route'u ve /bugun komutu aynı
   fonksiyonu çağırır (HTTP round-trip yok). */
import { getState, getHabits, getGlobalSettings } from "@/lib/logic";
import { db } from "@/lib/db";
import type { Habit } from "@/lib/logic";
import { buildTasksDigest } from "@/lib/telegram-tasks";

export type NotifyResult = {
  ok: boolean;
  sent?: boolean;
  reason?: string;
  count?: number;
  digestOnly?: boolean;
  error?: string;
};

function getIstanbulTime() {
  const d = new Date();
  const trDate = new Date(d.toLocaleString("en-US", { timeZone: "Europe/Istanbul" }));
  const hours = trDate.getHours();
  const minutes = trDate.getMinutes();
  const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  return { date: trDate, timeStr, hours, minutes };
}

/** force=true: zaman/plan kontrolü yapılmadan bugün kalanların hepsi gönderilir. */
export async function runNotify(force = false): Promise<NotifyResult> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    return { ok: false, error: "Telegram yapılandırılmamış" };
  }

  const state = getState();
  const habitsList = getHabits(true); // active habits
  
  const { date, timeStr, hours, minutes } = getIstanbulTime();

  const globalSettings = getGlobalSettings();
  const dndStart = globalSettings.dndStart || "23:00";
  const dndEnd = globalSettings.dndEnd || "06:00";
  
  const [startH, startM] = dndStart.split(':').map(Number);
  const [endH, endM] = dndEnd.split(':').map(Number);
  
  const currentTotal = hours * 60 + minutes;
  const startTotal = startH * 60 + startM;
  const endTotal = endH * 60 + endM;
  
  let inDnd = false;
  if (startTotal <= endTotal) {
    // e.g. 09:00 to 17:00
    if (currentTotal >= startTotal && currentTotal < endTotal) inDnd = true;
  } else {
    // e.g. 23:00 to 06:00 (crosses midnight)
    if (currentTotal >= startTotal || currentTotal < endTotal) inDnd = true;
  }
  
  if (inDnd) {
    return { ok: true, sent: false, reason: `Sessiz saatler (${dndStart}-${dndEnd})` };
  }

  const database = db();

  // Akşam özeti: 21:00 turunda Google Tasks'taki açık görev sayısı + "Listeyi göster"
  // butonu. Günde bir kez (state tablosunda tarih tutulur); force'ta eklenmez.
  const todayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const eveningSlot = !force && hours === 21 && minutes < 15;
  let digest: Awaited<ReturnType<typeof buildTasksDigest>> = null;
  if (eveningSlot) {
    const sentOn = (database.prepare("SELECT value FROM state WHERE key = 'tasks_digest_date'").get() as { value: string } | undefined)?.value;
    if (sentOn !== todayKey) {
      try { digest = await buildTasksDigest(); } catch (e) { console.error("tasks digest error:", e); }
    }
  }
  const markDigestSent = () =>
    database.prepare("INSERT OR REPLACE INTO state (key, value) VALUES ('tasks_digest_date', ?)").run(todayKey);
  // Alışkanlık hatırlatması yoksa özet tek başına gider.
  const sendDigestOnly = async () => {
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: digest!.text, reply_markup: digest!.reply_markup }),
      });
      if (!res.ok) {
        const err = await res.text();
        console.error("tasks digest send failed:", err);
        return { ok: false, error: err };
      }
      markDigestSent();
      return { ok: true, sent: true, digestOnly: true };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  };

  const incompleteState = state.habits.filter((h) => h.dueToday && !h.doneToday);
  if (incompleteState.length === 0) {
    if (digest) return sendDigestOnly();
    return { ok: true, sent: false, reason: "Bütün görevler tamam." };
  }

  // Eşleştir
  const incomplete: Habit[] = [];
  for (const st of incompleteState) {
    const full = habitsList.find(h => h.id === st.id);
    if (full) incomplete.push(full);
  }

  const toNotify: Habit[] = [];

  for (const h of incomplete) {
    const mode = h.notify_mode || "standard";
    if (mode === "off") continue;

    let shouldNotify = false;

    if (force) { shouldNotify = true; } else if (mode === "standard") {
      if (hours === 21 && minutes >= 0 && minutes < 15) {
        shouldNotify = true;
      }
    } else if (mode === "custom" && h.notify_time) {
      const [hTime, mTime] = h.notify_time.split(":").map(Number);
      if (hours === hTime && minutes >= mTime && minutes < mTime + 15) {
        shouldNotify = true;
      }
    } else if (mode === "periodic" && h.notify_interval) {
      // Periyodik bildirimler saat başına hizalanır (N saatte bir → saati N'e
      // bölünen saatlerde, :00 turunda). Her alışkanlık kendi son bildiriminden
      // saysaydı mesajlar gün içine dağılıp ayrı ayrı gelirdi; böylece hepsi
      // aynı turda tek mesajda toplanır. Yeni alışkanlık da ilk saat başına katılır.
      const onSlot = minutes < 15 && hours % h.notify_interval === 0;
      // Aynı saat başında cron iki kez tetiklenirse ikinci mesajı engelle.
      const recentlySent =
        !!h.last_notified_at &&
        date.getTime() - new Date(h.last_notified_at).getTime() < 30 * 60 * 1000;
      if (onSlot && !recentlySent) {
        shouldNotify = true;
      }
    }

    if (shouldNotify) {
      toNotify.push(h);
    }
  }

  if (toNotify.length === 0) {
    if (digest) return sendDigestOnly();
    return { ok: true, sent: false, reason: "Bu periyotta bildirilecek görev yok." };
  }

  let text = `🔔 *Hatırlatma Zamanı!*\n\nAşağıdaki görevleri tamamladın mı?`;
  if (digest) text += `\n\n${digest.text}`;

  const inline_keyboard = toNotify.map((h) => [
    { text: `✅ ${h.name}`, callback_data: `done_${h.id}` }
  ]);
  if (digest?.reply_markup) inline_keyboard.push(...digest.reply_markup.inline_keyboard);

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard
        }
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { ok: false, error: err };
    }

    // force (elle /bugun) planlı bildirimlerin zamanlamasını etkilemesin
    if (!force) {
      const nowIso = date.toISOString();
      const stmt = database.prepare("UPDATE habits SET last_notified_at = ? WHERE id = ?");
      for (const h of toNotify) {
        stmt.run(nowIso, h.id);
      }
    }
    if (digest) markDigestSent();

    return { ok: true, sent: true, count: toNotify.length };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
