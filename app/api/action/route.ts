import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/require-auth";
import {
  toggleHabit,
  toggleHabitOnDate,
  addHabit,
  setHabitActive,
  renameHabit,
  deleteHabit,
  getState,
} from "@/lib/logic";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ ok: false }, { status: 401 });

  const { type, payload } = await req.json();
  try {
    switch (type) {
      case "toggle":
        toggleHabit(Number(payload.habitId), !!payload.on);
        break;
      case "toggleDate":
        toggleHabitOnDate(Number(payload.habitId), String(payload.date), !!payload.on);
        break;
      case "addHabit":
        if (payload.name?.trim()) addHabit(payload.name);
        break;
      case "setActive":
        setHabitActive(Number(payload.habitId), !!payload.active);
        break;
      case "rename":
        if (payload.name?.trim()) renameHabit(Number(payload.habitId), payload.name);
        break;
      case "delete":
        deleteHabit(Number(payload.habitId));
        break;
      default:
        return NextResponse.json({ ok: false, error: "unknown type" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }

  return NextResponse.json({ ok: true, state: getState() });
}
