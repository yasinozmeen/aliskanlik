import { NextResponse } from "next/server";
import { toggleHabit } from "@/lib/logic";
import { db } from "@/lib/db";
import { createTask, completeTask, gtasksConfigured } from "@/lib/gtasks";
import { bumpTaskCount } from "@/lib/logic";
import { DUA_TEXT, isTelkinDua } from "@/lib/dua";
import { buildTasksMessage, TASK_CB_PREFIX, TASKS_LIST_CB } from "@/lib/telegram-tasks";
import { runNotify } from "@/lib/notify";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.APP_URL || "https://aliskanlik.yasinozmeen.me";

const escapeHtml = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function tg(method: string, payload: Record<string, unknown>) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return;
  await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

// html=true ise metin Telegram HTML'i olarak yorumlanır (çağıran escape eder)
async function sendText(chatId: number | string, text: string, replyTo?: number, html = false) {
  await tg("sendMessage", {
    chat_id: chatId,
    text,
    reply_to_message_id: replyTo,
    ...(html ? { parse_mode: "HTML", link_preview_options: { is_disabled: true } } : {}),
  });
}

/* /gorevler → Google Tasks'taki açık görevler, her biri ✅ butonlu. */
async function sendTasksList(chatId: number | string) {
  try {
    const msg = await buildTasksMessage(SITE_URL);
    await tg("sendMessage", {
      chat_id: chatId,
      text: msg.text,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      ...(msg.reply_markup ? { reply_markup: msg.reply_markup } : {}),
    });
  } catch (e) {
    console.error("Telegram /gorevler error:", e);
    await sendText(chatId, "❌ Görevler alınamadı, sonra tekrar dene.");
  }
}

/* /bugun → bugün kalan alışkanlıklar (cron'un force modu, doğrudan çağrı). */
async function sendTodayHabits(chatId: number | string) {
  try {
    const r = await runNotify(true);
    if (!r.ok) throw new Error(r.error || "notify failed");
    if (!r.sent) await sendText(chatId, `✅ ${r.reason || "Bugün kalan alışkanlık yok."}`);
  } catch (e) {
    console.error("Telegram /bugun error:", e);
    await sendText(chatId, "❌ Liste alınamadı, sonra tekrar dene.");
  }
}

/* Yalnız sahibin sohbetinden gelen komutlar işlenir. */
async function handleCommand(chatId: number | string, text: string): Promise<boolean> {
  const cmd = text.split(/\s+/)[0].split("@")[0].toLowerCase();
  if (cmd === "/gorevler") { await sendTasksList(chatId); return true; }
  if (cmd === "/bugun") { await sendTodayHabits(chatId); return true; }
  if (cmd === "/start") {
    await sendText(chatId, "Merhaba! Yazdığın her mesaj Google Tasks'a görev olarak eklenir.\n/gorevler — açık görevler\n/bugun — bugün kalan alışkanlıklar");
    return true;
  }
  return false;
}

/* Bota yazılan düz metin → Google Tasks'ta yeni görev.
   Yalnız TELEGRAM_CHAT_ID'den gelen mesaj kabul edilir (bot herkese açık,
   yabancı biri listeye görev yazamasın). İlk satır başlık, kalanı not.
   Sayaç artmaz — /api/tasks'taki "ekleme" ile aynı kural. */
async function handleTextMessage(message: any) {
  const ownerChat = process.env.TELEGRAM_CHAT_ID;
  const chatId = message.chat?.id;
  if (!ownerChat || String(chatId) !== String(ownerChat)) return;

  const text = String(message.text || "").trim();
  if (!text) return;
  if (text.startsWith("/")) { await handleCommand(chatId, text); return; } // komutlar görev değil

  if (!gtasksConfigured()) {
    await sendText(chatId, "⚠️ Google Tasks bağlı değil, görev eklenemedi.", message.message_id);
    return;
  }

  // text trim'li olduğundan ilk satır boş olamaz
  const [first, ...rest] = text.split("\n");
  const title = first.trim().slice(0, 1024);
  const notes = rest.join("\n").trim().slice(0, 8000) || undefined;

  try {
    await createTask(title, notes);
    await sendText(
      chatId,
      `📝 Görev eklendi: <a href="${SITE_URL}">${escapeHtml(title)}</a>`,
      message.message_id,
      true,
    );
  } catch (e) {
    console.error("Telegram → Tasks error:", e);
    await sendText(chatId, "❌ Görev eklenemedi, sonra tekrar dene.", message.message_id);
  }
}

// Telegram yanıt gecikirse aynı update'i tekrar yollar → aynı görev iki kez eklenmesin.
const seenUpdates = new Set<number>();
// Şu an Google'da kapatılmakta olan görevler (çift tık → çift sayaç engeli)
const completingTasks = new Set<string>();

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (typeof body.update_id === "number") {
      if (seenUpdates.has(body.update_id)) return NextResponse.json({ ok: true });
      seenUpdates.add(body.update_id);
      if (seenUpdates.size > 200) seenUpdates.delete(seenUpdates.values().next().value!);
    }

    if (body.message?.text) {
      await handleTextMessage(body.message);
      return NextResponse.json({ ok: true });
    }
    
    // Yalnızca callback query leri isle
    if (body.callback_query) {
      const callbackQuery = body.callback_query;
      const data = callbackQuery.data; // e.g. "done_1"
      const chatId = callbackQuery.message?.chat?.id;
      const messageId = callbackQuery.message?.message_id;
      if (chatId == null) return NextResponse.json({ ok: true }); // inline mod / eski mesaj
      const botToken = process.env.TELEGRAM_BOT_TOKEN;

      const ownerChat = process.env.TELEGRAM_CHAT_ID;
      const isOwner = !!ownerChat && String(chatId) === String(ownerChat);

      if (data === TASKS_LIST_CB) {
        await tg("answerCallbackQuery", { callback_query_id: callbackQuery.id });
        if (isOwner) await sendTasksList(chatId);
      } else if (data && data.startsWith("tdone_")) {
        await tg("answerCallbackQuery", { callback_query_id: callbackQuery.id, text: "Bu görev zaten tamamlandı!" });
      } else if (data && data.startsWith(TASK_CB_PREFIX)) {
        // Google Tasks görevini kapat (siteden kapatmakla aynı kural: sayaç +1)
        const taskId = data.slice(TASK_CB_PREFIX.length);
        if (!isOwner || !gtasksConfigured()) {
          await tg("answerCallbackQuery", { callback_query_id: callbackQuery.id, text: "Yetkisiz." });
        } else if (completingTasks.has(taskId)) {
          // Seri çift tık: ilk istek henüz bitmedi, ikincisi sayaç artırmasın
          await tg("answerCallbackQuery", { callback_query_id: callbackQuery.id, text: "İşleniyor…" });
        } else {
          completingTasks.add(taskId);
          let ok = true;
          try {
            await completeTask(taskId);
            bumpTaskCount();
          } catch (e) {
            ok = false;
            console.error("Telegram task complete error:", e);
          } finally {
            completingTasks.delete(taskId);
          }
          await tg("answerCallbackQuery", {
            callback_query_id: callbackQuery.id,
            text: ok ? "Görev tamamlandı! ✅" : "Kapatılamadı, tekrar dene.",
            show_alert: !ok,
          });
          if (ok) {
            const keyboard = callbackQuery.message.reply_markup?.inline_keyboard || [];
            const newKeyboard = keyboard.map((row: any[]) =>
              row.map((btn: any) =>
                btn.callback_data === data
                  ? { text: `☑️ ${String(btn.text).replace(/^✅ /, "")}`, callback_data: `tdone_${taskId}`.slice(0, 64) }
                  : btn,
              ),
            );
            await tg("editMessageReplyMarkup", {
              chat_id: chatId,
              message_id: messageId,
              reply_markup: { inline_keyboard: newKeyboard },
            });
          }
        }
      } else if (data && data.startsWith("done_")) {
        const habitId = parseInt(data.replace("done_", ""), 10);
        
        // Alışkanlığın adını bulalım
        let habitName = "Görev";
        try {
          const row = db().prepare("SELECT name FROM habits WHERE id = ?").get(habitId) as { name: string };
          if (row) habitName = row.name;
        } catch(e) {}
        
        const isDua = isTelkinDua(habitName);

        if (!isDua) {
          // Alışkanlığı tamamla
          try {
            toggleHabit(habitId, true);
          } catch(e) {
            // Zaten tamamlandıysa hata vermesin diye try catch
          }
        }
        
        // Telegrama callback answer gönderelim (kullanıcı popup görsün)
        if (botToken) {
          await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              callback_query_id: callbackQuery.id,
              text: isDua ? "Duayı okuyup Amin diyin..." : `${habitName} tamamlandı! ✅`,
              show_alert: false
            })
          });

          // Opsiyonel: Mesajdaki o butonu kaldıralım veya güncelleyelim.
          // Mevcut buton listesini çek
          const keyboard = callbackQuery.message.reply_markup?.inline_keyboard || [];
          
          // Tıklanan butonu bulup metnini güncelleyelim ve callback_data'sını değiştirelim ki tekrar basılmasın
          const newKeyboard = keyboard.map((row: any[]) => 
            row.map((btn: any) => {
              if (btn.callback_data === data) {
                return { 
                  text: isDua ? `⏳ ${habitName} (Amin Bekleniyor)` : `☑️ ${habitName} (Tamamlandı)`, 
                  callback_data: isDua ? `dua_pending_${habitId}` : `already_done_${habitId}` 
                };
              }
              return btn;
            })
          );

          await fetch(`https://api.telegram.org/bot${botToken}/editMessageReplyMarkup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
              reply_markup: {
                inline_keyboard: newKeyboard
              }
            })
          });

          if (isDua) {
            // Duayı yeni mesaj olarak gönderelim
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                text: `Bir dua daha\n\n${DUA_TEXT}`,
                reply_markup: {
                  inline_keyboard: [
                    [{ text: "Amin", callback_data: `dua_amin_${habitId}` }]
                  ]
                }
              })
            });
          }
        }
      } else if (data && data.startsWith("dua_amin_")) {
        const habitId = parseInt(data.replace("dua_amin_", ""), 10);
        
        try {
          toggleHabit(habitId, true);
        } catch(e) {}
        
        if (botToken) {
          await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              callback_query_id: callbackQuery.id,
              text: `Amin! Dua tamamlandı. ✅`,
              show_alert: false
            })
          });

          await fetch(`https://api.telegram.org/bot${botToken}/editMessageReplyMarkup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
              reply_markup: {
                inline_keyboard: [
                  [{ text: "☑️ Amin (Tamamlandı)", callback_data: `already_done_${habitId}` }]
                ]
              }
            })
          });
        }
      } else if (data && data.startsWith("dua_pending_")) {
        if (botToken) {
          await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              callback_query_id: callbackQuery.id,
              text: `Lütfen aşağıya gönderilen duayı okuyup Amin butonuna basın!`,
              show_alert: true
            })
          });
        }
      } else if (data && data.startsWith("already_done_")) {
        // Kullanıcı zaten tamamlanmış butona bastıysa
        if (botToken) {
          await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              callback_query_id: callbackQuery.id,
              text: `Bu görev zaten tamamlandı!`,
              show_alert: false
            })
          });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Telegram Webhook Error:", e);
    // 200 dönülür: 500'de Telegram aynı update'i defalarca yeniden yollar
    return NextResponse.json({ ok: false });
  }
}
