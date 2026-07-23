import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/require-auth";
import {
  addMeasurementType,
  archiveMeasurementType,
  getHabits,
  getMeasurementHistory,
  getMeasurementSettings,
  getState,
  recordMeasurements,
  setMeasurementHabit,
  updateMeasurementType,
} from "@/lib/logic";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({
    ok: true,
    habits: getHabits(false),
    settings: getMeasurementSettings(),
    history: getMeasurementHistory(),
  });
}

export async function POST(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const { action, payload = {} } = await req.json();
    switch (action) {
      case "setHabit": {
        const habitId =
          payload.habitId === null || payload.habitId === ""
            ? null
            : Number(payload.habitId);
        if (habitId !== null && !Number.isInteger(habitId)) {
          return NextResponse.json(
            { ok: false, error: "Geçerli bir alışkanlık seçin." },
            { status: 400 }
          );
        }
        setMeasurementHabit(habitId);
        break;
      }
      case "addType":
        addMeasurementType(String(payload.name ?? ""), String(payload.unit ?? ""));
        break;
      case "updateType":
        updateMeasurementType(
          Number(payload.id),
          String(payload.name ?? ""),
          String(payload.unit ?? "")
        );
        break;
      case "archiveType":
        archiveMeasurementType(Number(payload.id));
        break;
      case "record":
        recordMeasurements(
          Number(payload.habitId),
          Array.isArray(payload.values)
            ? payload.values.map((item: { typeId: unknown; value: unknown }) => ({
                typeId: Number(item.typeId),
                value: Number(item.value),
              }))
            : []
        );
        return NextResponse.json({ ok: true, state: getState() });
      default:
        return NextResponse.json(
          { ok: false, error: "Bilinmeyen ölçüm işlemi." },
          { status: 400 }
        );
    }

    return NextResponse.json({
      ok: true,
      habits: getHabits(false),
      settings: getMeasurementSettings(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Ölçüm işlemi tamamlanamadı.",
      },
      { status: 400 }
    );
  }
}
