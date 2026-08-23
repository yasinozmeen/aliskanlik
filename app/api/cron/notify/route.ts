import { NextResponse } from "next/server";
import { getState, getHabits } from "@/lib/logic";
import { db } from "@/lib/db";
import type { Habit } from "@/lib/logic";

export const dynamic = "force-dynamic";

function getIstanbulTime() {
  const d = new Date();
  const trDate = new Date(d.toLocaleString("en-US", { timeZone: "Europe/Istanbul" }));
  const hours = trDate.getHours();
  const minutes = trDate.getMinutes();
  const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  return { date: trDate, timeStr, hours, minutes };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (token !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    return NextResponse.json({ ok: false, error: "Telegram yapılandırılmamış" }, { status: 500 });
  }

  const state = getState();
  const habitsList = getHabits(true); // active habits
  
  const { date, timeStr, hours, minutes } = getIstanbulTime();

  if ((hours === 23 && minutes >= 30) || hours >= 24) {
    return NextResponse.json({ ok: true, sent: false, reason: "Sessiz saatler (DND)" });
  }
  if (hours < 8) {
    return NextResponse.json({ ok: true, sent: false, reason: "Sessiz saatler (DND)" });
  }

  const incompleteState = state.habits.filter((h) => h.dueToday && !h.doneToday);
  if (incompleteState.length === 0) {
    return NextResponse.json({ ok: true, sent: false, reason: "Bütün görevler tamam." });
  }

  // Eşleştir
  const incomplete: Habit[] = [];
  for (const st of incompleteState) {
    const full = habitsList.find(h => h.id === st.id);
    if (full) incomplete.push(full);
  }

  const toNotify: Habit[] = [];
  const database = db();

  for (const h of incomplete) {
    const mode = h.notify_mode || "standard";
    if (mode === "off") continue;

    let shouldNotify = false;

    if (mode === "standard") {
      if (hours === 21 && minutes >= 0 && minutes < 15) {
        shouldNotify = true;
      }
    } else if (mode === "custom" && h.notify_time) {
      const [hTime, mTime] = h.notify_time.split(":").map(Number);
      if (hours === hTime && minutes >= mTime && minutes < mTime + 15) {
        shouldNotify = true;
      }
    } else if (mode === "periodic" && h.notify_interval) {
      if (!h.last_notified_at) {
        shouldNotify = true;
      } else {
        const last = new Date(h.last_notified_at);
        const diffMs = date.getTime() - last.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        if (diffHours >= h.notify_interval) {
          shouldNotify = true;
        }
      }
    }

    if (shouldNotify) {
      toNotify.push(h);
    }
  }

  if (toNotify.length === 0) {
    return NextResponse.json({ ok: true, sent: false, reason: "Bu periyotta bildirilecek görev yok." });
  }

  const text = `🔔 *Hatırlatma Zamanı!*\n\n${toNotify
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

    const nowIso = date.toISOString();
    const stmt = database.prepare("UPDATE habits SET last_notified_at = ? WHERE id = ?");
    for (const h of toNotify) {
      stmt.run(nowIso, h.id);
    }

    return NextResponse.json({ ok: true, sent: true, count: toNotify.length });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
