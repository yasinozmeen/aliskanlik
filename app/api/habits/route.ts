import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/require-auth";
import { getHabits } from "@/lib/logic";

export const dynamic = "force-dynamic";

// Tüm alışkanlıklar (aktif + pasif) — Ayarlar sayfası tazeler.
export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, habits: getHabits(false) });
}
