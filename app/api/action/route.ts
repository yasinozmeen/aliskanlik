import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/require-auth";
import {
  toggleHabit,
  toggleHabitOnDate,
  addHabit,
  setHabitActive,
  renameHabit,
  deleteHabit,
  setHabitSchedule,
  setHabitNotification,
  setGlobalSettings,
  getState,
  InputError,
} from "@/lib/logic";
import type { ScheduleInput, NotifyInput, GlobalSettings } from "@/lib/logic";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ ok: false }, { status: 401 });

  let type: string;
  let payload: Record<string, unknown>;
  try {
    const body = await req.json();
    if (typeof body !== "object" || body === null) throw new Error("bad body");
    type = String(body.type ?? "");
    payload = (body.payload ?? {}) as Record<string, unknown>;
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
      throw new Error("bad payload");
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Geçersiz istek." }, { status: 400 });
  }

  try {
    switch (type) {
      case "toggle":
        toggleHabit(Number(payload.habitId), !!payload.on);
        break;
      case "toggleDate":
        toggleHabitOnDate(Number(payload.habitId), String(payload.date), !!payload.on);
        break;
      case "addHabit": {
        const name = String(payload.name ?? "").trim();
        if (name) addHabit(name);
        break;
      }
      case "setActive":
        setHabitActive(Number(payload.habitId), !!payload.active);
        break;
      case "rename": {
        const name = String(payload.name ?? "").trim();
        if (name) renameHabit(Number(payload.habitId), name);
        break;
      }
      case "delete":
        deleteHabit(Number(payload.habitId));
        break;
      case "setSchedule":
        setHabitSchedule(Number(payload.habitId), payload.schedule as ScheduleInput);
        break;
      case "setNotification":
        setHabitNotification(Number(payload.habitId), payload.notify as NotifyInput);
        break;
      case "setGlobalSettings":
        setGlobalSettings(payload.settings as GlobalSettings);
        break;
      default:
        return NextResponse.json({ ok: false, error: "unknown type" }, { status: 400 });
    }
  } catch (e) {
    // Kullanıcı girdisi hatası mesajıyla ve 400 ile döner; beklenmedik iç hata
    // 500 döner ve JavaScript detayı dışarı sızmaz.
    if (e instanceof InputError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
    }
    console.error("action failed:", type, e);
    return NextResponse.json(
      { ok: false, error: "İşlem tamamlanamadı." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, state: getState() });
}
