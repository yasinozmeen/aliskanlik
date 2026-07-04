import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/require-auth";
import { gtasksConfigured, listOpenTasks, completeTask } from "@/lib/gtasks";
import { bumpTaskCount, getTaskStats } from "@/lib/logic";

export const dynamic = "force-dynamic";

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

// Bir görevi tamamla: Tasks'ta kapat + bugünün sayacını +1.
export async function POST(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ ok: false }, { status: 401 });
  if (!gtasksConfigured()) {
    return NextResponse.json({ ok: false, error: "gtasks not configured" }, { status: 400 });
  }
  const { taskId } = await req.json();
  if (!taskId) return NextResponse.json({ ok: false, error: "taskId gerekli" }, { status: 400 });

  try {
    await completeTask(taskId);
    bumpTaskCount();
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }

  const tasks = await listOpenTasks().catch(() => []);
  return NextResponse.json({ ok: true, tasks, stats: getTaskStats() });
}
