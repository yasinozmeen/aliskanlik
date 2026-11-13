import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/require-auth";
import {
  gtasksConfigured,
  listOpenTasks,
  completeTask,
  createTask,
  updateTask,
} from "@/lib/gtasks";
import { bumpTaskCount, getTaskStats } from "@/lib/logic";

export const dynamic = "force-dynamic";

// Google Tasks açıklama alanının üst sınırı 8192 karakter.
const NOTES_MAX = 8192;

// Açık görevleri + sayaç istatistiğini döner.
export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ ok: false }, { status: 401 });
  const stats = getTaskStats();
  if (!gtasksConfigured()) {
    return NextResponse.json({ ok: true, configured: false, tasks: [], stats });
  }
  try {
    const tasks = await listOpenTasks();
    return NextResponse.json({ ok: true, configured: true, tasks, stats });
  } catch (e) {
    return NextResponse.json({ ok: true, configured: true, tasks: [], stats, error: String(e) });
  }
}

// İki iş yapar:
//   { taskId } → görevi tamamla (Tasks'ta kapat + bugünün sayacını +1)
//   { title, notes? } → Tasks'a yeni görev ekle (sayaç değişmez, tamamlanma değil)
export async function POST(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ ok: false }, { status: 401 });
  if (!gtasksConfigured()) {
    return NextResponse.json({ ok: false, error: "gtasks not configured" }, { status: 400 });
  }
  const body = await req.json();

  try {
    if (typeof body.title === "string") {
      const title = body.title.trim().slice(0, 500);
      if (!title) return NextResponse.json({ ok: false, error: "title boş" }, { status: 400 });
      const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, NOTES_MAX) : "";
      await createTask(title, notes || undefined);
    } else if (body.taskId) {
      await completeTask(body.taskId);
      bumpTaskCount();
    } else {
      return NextResponse.json({ ok: false, error: "taskId veya title gerekli" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }

  const tasks = await listOpenTasks().catch(() => []);
  return NextResponse.json({ ok: true, tasks, stats: getTaskStats() });
}

// Mevcut bir Google Tasks görevinin başlığını ve (gönderildiyse) açıklamasını değiştirir.
// notes alanı hiç gönderilmezse açıklamaya dokunulmaz; boş gönderilirse açıklama silinir.
export async function PATCH(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ ok: false }, { status: 401 });
  if (!gtasksConfigured()) {
    return NextResponse.json({ ok: false, error: "gtasks not configured" }, { status: 400 });
  }

  const body = await req.json();
  const taskId = typeof body.taskId === "string" ? body.taskId.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 500) : "";
  if (!taskId || !title) {
    return NextResponse.json({ ok: false, error: "taskId ve title gerekli" }, { status: 400 });
  }

  try {
    const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, NOTES_MAX) : undefined;
    await updateTask(taskId, title, notes);
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }

  const tasks = await listOpenTasks().catch(() => []);
  return NextResponse.json({ ok: true, tasks, stats: getTaskStats() });
}
