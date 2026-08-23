import { NextResponse } from "next/server";
import { getState } from "@/lib/logic";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  // Yetkisiz erişimleri engellemek için basit bir şifre (token) kontrolü
  if (token !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    return NextResponse.json({ ok: false, error: "Telegram yapılandırılmamış" }, { status: 500 });
  }

  // Sistemi ve alışkanlıkları oku
  const state = getState();
  
  // Sadece bugün yapılması gereken VE henüz yapılmamış (doneToday = false) olanları bul
  const incomplete = state.habits.filter((h) => h.dueToday && !h.doneToday);

  // Hepsi tamamlandıysa mesaj atma
  if (incomplete.length === 0) {
    return NextResponse.json({ ok: true, sent: false, reason: "Bütün görevler tamam." });
  }

  const text = `⏳ *Gün bitiyor!*\nBugün tamamlamadığın ${incomplete.length} alışkanlık var:\n\n${incomplete
    .map((h) => `— ${h.name}`)
    .join("\n")}\n\n[Sisteme Git](https://aliskanlik.yasinozmeen.me)`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ ok: false, error: err }, { status: 500 });
    }

    return NextResponse.json({ ok: true, sent: true, count: incomplete.length });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
