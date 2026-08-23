import { NextResponse } from "next/server";
import { toggleHabit } from "@/lib/logic";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

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
        
        // Alışkanlığı tamamla
        try {
          toggleHabit(habitId, true);
        } catch(e) {
          // Zaten tamamlandıysa hata vermesin diye try catch
        }
        
        // Telegrama callback answer gönderelim (kullanıcı popup görsün)
        if (botToken) {
          await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              callback_query_id: callbackQuery.id,
              text: `${habitName} tamamlandı! ✅`,
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
                return { text: `☑️ ${habitName} (Tamamlandı)`, callback_data: `already_done_${habitId}` };
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
