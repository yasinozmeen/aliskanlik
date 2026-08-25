import { NextResponse } from "next/server";
import { toggleHabit } from "@/lib/logic";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function isTelkinDua(name: string) {
  return name
    .toLocaleLowerCase("tr-TR")
    .replace(/[^a-zçğıöşü]/g, "")
    .replace(/^tellkin/, "telkin") === "telkindua";
}

const DUA_TEXT = "Allahım Bize hem bu dünyada hem öbür dünyada iyilik ver bizi kötülükten koru, Göğsümüzü genişlet, kalbimize ferahlık ver. İşimizi bize kolaylaştır. Amin";


export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Yalnızca callback query leri isle
    if (body.callback_query) {
      const callbackQuery = body.callback_query;
      const data = callbackQuery.data; // e.g. "done_1"
      const chatId = callbackQuery.message.chat.id;
      const messageId = callbackQuery.message.message_id;
      const botToken = process.env.TELEGRAM_BOT_TOKEN;

      if (data && data.startsWith("done_")) {
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
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
