import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/require-auth";
import { getHistory } from "@/lib/logic";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, history: getHistory(90) });
}
