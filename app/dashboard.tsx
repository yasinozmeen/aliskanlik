"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { AppState, HabitState, HeatCell, MeasurementType } from "@/lib/logic";

type GTask = { id: string; title: string };
const DUA_TEXT =
  "Allahım Bize hem bu dünyada hem öbür dünyada iyilik ver bizi kötülükten koru, Göğsümüzü genişlet, kalbimize ferahlık ver. İşimizi bize kolaylaştır. Amin";

function isTelkinDua(name: string) {
  return name
    .toLocaleLowerCase("tr-TR")
    .replace(/[^a-zçğıöşü]/g, "")
    .replace(/^tellkin/, "telkin") === "telkindua";
}

/* ————————————————————————— Yardımcılar ————————————————————————— */

function fmtDate(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return {
    gun: d.toLocaleDateString("tr-TR", { weekday: "long" }),
    tarih: d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }),
  };
}

/** "17 Ağu" · yarın/öbür gün ise gün adı yerine yakınlık yazar. */
function fmtNextDue(iso: string, today: string) {
  const diff = Math.round(
    (new Date(iso + "T12:00:00").getTime() - new Date(today + "T12:00:00").getTime()) / 86400000
  );
  if (diff === 1) return "yarın";
  if (diff === 2) return "öbür gün";
  return new Date(iso + "T12:00:00").toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
  });
}

type TaskTitlePart =
  | { type: "text"; value: string }
  | { type: "link"; url: string; number: number };

function splitTaskTitle(title: string): TaskTitlePart[] {
  const parts: TaskTitlePart[] = [];
  let cursor = 0;
  let linkNumber = 0;

  for (const match of title.matchAll(/(?:https?|codex):\/\/[^\s]+/gi)) {
    const start = match.index ?? 0;
    const rawUrl = match[0];
    const url = rawUrl.replace(/[)\]},.;!]+$/g, "");
    const trailing = rawUrl.slice(url.length);

    if (start > cursor) parts.push({ type: "text", value: title.slice(cursor, start) });
    if (url) {
      linkNumber += 1;
      parts.push({ type: "link", url, number: linkNumber });
    }
    if (trailing) parts.push({ type: "text", value: trailing });
    cursor = start + rawUrl.length;
  }

  if (cursor < title.length) parts.push({ type: "text", value: title.slice(cursor) });
  return parts.length ? parts : [{ type: "text", value: title }];
}

function TaskTitle({ title }: { title: string }) {
  return (
    <span className="font-body text-[0.9rem] leading-snug break-words">
      {splitTaskTitle(title).map((part, index) =>
        part.type === "link" ? (
          <a
            key={`link-${index}`}
            href={part.url}
            target="_blank"
            rel="noopener noreferrer"
            title={part.url}
            aria-label={`Bağlantı ${part.number}: ${part.url}`}
            className="relative mx-0.5 inline-flex items-center gap-1 px-1 align-baseline font-mono text-[0.68rem] font-bold uppercase text-[var(--color-ink)] underline decoration-[3px] decoration-[var(--color-pop)] underline-offset-[3px] after:absolute after:-inset-x-1 after:-inset-y-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-pop-deep)]"
          >
            link {part.number}
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="square"
              strokeLinejoin="miter"
              className="h-3.5 w-3.5"
            >
              <path d="M14 5h5v5" />
              <path d="m10 14 9-9" />
              <path d="M19 14v5H5V5h5" />
            </svg>
          </a>
        ) : (
          <span key={`text-${index}`} className="whitespace-pre-wrap">
            {part.value}
          </span>
        )
      )}
    </span>
  );
}

/* ————————————————————————— Alışkanlık kartı ————————————————————————— */

function HabitCard({
  habit,
  index,
  busy,
  today,
  onToggle,
}: {
  habit: HabitState;
  index: number;
  busy: boolean;
  today: string;
  onToggle: (on: boolean) => void;
}) {
  const done = habit.doneToday;
  const periodic = habit.scheduleLabel !== "her gün";
  return (
    <button
      onClick={() => !busy && onToggle(!done)}
      className={`press brut text-left p-3.5 flex flex-col min-h-[9.5rem] ${
        done ? "bg-[var(--color-green)] text-[var(--color-cream)]" : "bg-[var(--color-cream)]"
      } ${busy ? "opacity-60" : ""}`}
    >
      <div className="flex items-start justify-between">
        <span
          className={`label text-[0.65rem] ${done ? "text-[var(--color-cream)]/70" : "text-[var(--color-muted)]"}`}
        >
          {String(index + 1).padStart(2, "0")}
        </span>
        <span
          className={`w-6 h-6 border-2 flex items-center justify-center text-sm font-black ${
            done
              ? "border-[var(--color-cream)] bg-[var(--color-cream)] text-[var(--color-green)]"
              : "border-[var(--color-ink)] bg-transparent"
          }`}
        >
          {done ? "✓" : ""}
        </span>
      </div>

      <h3 className="font-display font-black uppercase leading-[0.95] text-[1.05rem] mt-1 break-words">
        {habit.name}
      </h3>

      {periodic && (
        <span
          className={`label mt-1.5 inline-block self-start px-1.5 py-0.5 text-[0.5rem] leading-tight ${
            done
              ? "bg-[var(--color-cream)]/20 text-[var(--color-cream)]"
              : "bg-[var(--color-pop-pale)] text-[var(--color-pop-deep)]"
          }`}
        >
          {habit.scheduleLabel}
        </span>
      )}

      <div className="mt-auto pt-2">
        <div className="flex items-end gap-1.5">
          <span
            className={`font-mono font-bold leading-none text-[2.4rem] flood ${
              done ? "" : habit.streak > 0 ? "text-[var(--color-pop)]" : "text-[var(--color-ink)]"
            }`}
            key={habit.streak}
          >
            {habit.streak}
          </span>
          <span
            className={`label text-[0.6rem] pb-1.5 leading-[1.1] ${
              done ? "text-[var(--color-cream)]/80" : "text-[var(--color-muted)]"
            }`}
          >
            {periodic ? "kez" : "gün"}
            <br />
            üst üste
          </span>
        </div>
        <div
          className={`label text-[0.62rem] mt-1.5 ${
            done ? "text-[var(--color-cream)]/80" : "text-[var(--color-muted)]"
          }`}
        >
          RKR {habit.record} · AY %{habit.monthPct}
          {done && habit.doneTime ? ` · ${habit.doneTime}` : ""}
        </div>
        {periodic && done && habit.nextDue && (
          <div
            className={`label text-[0.58rem] mt-1 ${
              done ? "text-[var(--color-cream)]" : "text-[var(--color-pop-deep)]"
            }`}
          >
            sıradaki {fmtNextDue(habit.nextDue, today)}
          </div>
        )}
      </div>
    </button>
  );
}

/* ————————————————————————— İstatistik çubukları ————————————————————————— */

function MonthBars({ habits }: { habits: HabitState[] }) {
  return (
    <div className="flex flex-col gap-2.5">
      {habits.map((h) => (
        <div key={h.id} className="flex items-center gap-2.5">
          <span className="label text-[0.62rem] w-[5.5rem] shrink-0 truncate">{h.name}</span>
          <div className="flex-1 h-4 border-2 border-[var(--color-ink)] bg-[var(--color-cream-2)] relative">
            <div
              className="h-full bg-[var(--color-pop)]"
              style={{ width: `${Math.min(100, h.monthPct)}%` }}
            />
          </div>
          <span className="label text-[0.62rem] w-9 text-right shrink-0">%{h.monthPct}</span>
        </div>
      ))}
    </div>
  );
}

const SEG = [
  { key: "sabah", color: "var(--color-pop)" },
  { key: "ogle", color: "var(--color-blue)" },
  { key: "aksam", color: "var(--color-ink)" },
  { key: "gece", color: "#9CA3AF" },
] as const;

function TimeBars({ habits }: { habits: HabitState[] }) {
  return (
    <div className="flex flex-col gap-2.5">
      {habits.map((h) => {
        const total = SEG.reduce((s, seg) => s + h.timeDist[seg.key], 0);
        return (
          <div key={h.id} className="flex items-center gap-2.5">
            <span className="label text-[0.62rem] w-[5.5rem] shrink-0 truncate">{h.name}</span>
            <div className="flex-1 h-4 border-2 border-[var(--color-ink)] bg-[var(--color-cream-2)] flex overflow-hidden">
              {total === 0 ? (
                <span className="label text-[0.55rem] text-[var(--color-muted)] pl-1.5 self-center">
                  —
                </span>
              ) : (
                SEG.map((seg) => {
                  const v = h.timeDist[seg.key];
                  if (v === 0) return null;
                  return (
                    <div
                      key={seg.key}
                      style={{ width: `${(v / total) * 100}%`, background: seg.color }}
                    />
                  );
                })
              )}
            </div>
          </div>
        );
      })}
      <div className="label text-[0.58rem] text-[var(--color-muted)] flex flex-wrap gap-x-3 gap-y-1 mt-0.5">
        <span>
          <span style={{ color: "var(--color-pop)" }}>■</span> sabah
        </span>
        <span>
          <span style={{ color: "var(--color-blue)" }}>■</span> öğle
        </span>
        <span>
          <span style={{ color: "var(--color-ink)" }}>■</span> akşam
        </span>
        <span>
          <span style={{ color: "#9CA3AF" }}>■</span> gece
        </span>
      </div>
    </div>
  );
}

/* ————————————————————————— Isı haritası ————————————————————————— */

const AYK = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

function weekday(iso: string) {
  return (new Date(iso + "T00:00:00Z").getUTCDay() + 6) % 7; // Pzt=0
}
function monthOf(iso: string) {
  return Number(iso.split("-")[1]) - 1;
}

function HeatMap({ cells, total }: { cells: HeatCell[]; total: number }) {
  // Haftalara (sütun) böl — her sütun Pzt→Paz
  const weeks: (HeatCell | null)[][] = [];
  let col: (HeatCell | null)[] = new Array(7).fill(null);
  for (const c of cells) {
    const wd = weekday(c.date);
    if (wd === 0 && col.some((x) => x !== null)) {
      weeks.push(col);
      col = new Array(7).fill(null);
    }
    col[wd] = c;
  }
  if (col.some((x) => x !== null)) weeks.push(col);
  // En yeni hafta EN SOLDA olsun (kullanıcı isteği): kronolojiyi ters çevir
  const weeksRev = [...weeks].reverse();

  function color(count: number) {
    if (count <= 0) return "var(--color-line)";
    if (count >= total) return "var(--color-pop-deep)";
    const r = count / Math.max(1, total);
    if (r >= 0.66) return "var(--color-pop)";
    if (r >= 0.33) return "var(--color-pop-soft)";
    return "var(--color-pop-pale)";
  }

  // Ay etiketleri: bir sütunun ayı solundakinden (daha yeni) farklıysa yaz
  const monthLabels = weeksRev.map((w) => {
    const first = w.find((x) => x !== null);
    return first ? monthOf(first.date) : -1;
  });

  const GAP = 2;
  const LABW = 22;
  const days = ["Pzt", "", "Çar", "", "Cum", "", ""];

  // Sabit genişlik, kaydırma yok: sütunlar flex-1 ile alanı doldurur, kareler aspect-square
  return (
    <div>
      {/* Ay etiketleri */}
      <div className="flex mb-1" style={{ gap: GAP }}>
        <div style={{ width: LABW }} className="shrink-0" />
        {weeksRev.map((_, i) => {
          const m = monthLabels[i];
          const show = m >= 0 && m !== monthLabels[i - 1];
          return (
            <div
              key={i}
              className="flex-1 label text-[0.5rem] text-[var(--color-muted)] whitespace-nowrap"
            >
              {show ? AYK[m] : ""}
            </div>
          );
        })}
      </div>

      <div className="flex items-stretch" style={{ gap: GAP }}>
        {/* Gün etiketleri */}
        <div className="flex flex-col shrink-0" style={{ width: LABW, gap: GAP }}>
          {days.map((g, i) => (
            <div
              key={i}
              className="flex-1 label text-[0.5rem] text-[var(--color-muted)] flex items-center justify-end"
            >
              {g}
            </div>
          ))}
        </div>

        {/* Sütunlar (en yeni solda) */}
        {weeksRev.map((w, i) => (
          <div key={i} className="flex-1 flex flex-col" style={{ gap: GAP }}>
            {w.map((cell, j) => (
              <div
                key={j}
                className="aspect-square"
                title={cell ? `${cell.date}: ${cell.count}` : ""}
                style={{
                  background: cell ? color(cell.count) : "transparent",
                  border: cell ? "1px solid rgba(10,10,10,0.12)" : "none",
                }}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div
        className="label text-[0.55rem] text-[var(--color-muted)] flex items-center gap-1.5 mt-2"
        style={{ marginLeft: LABW }}
      >
        az
        {["var(--color-pop-pale)", "var(--color-pop-soft)", "var(--color-pop)", "var(--color-pop-deep)"].map(
          (c, i) => (
            <span key={i} style={{ width: 11, height: 11, background: c, display: "inline-block" }} />
          )
        )}
        çok
      </div>
    </div>
  );
}

/* ————————————————————————— Bölüm başlığı ————————————————————————— */

function Band({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="band text-[0.72rem] font-bold px-3 py-2 mb-3 flex items-center">
      <span className="flex-1">{children}</span>
      {action}
    </div>
  );
}

function MeasurementModal({
  habitName,
  types,
  values,
  busy,
  error,
  onValueChange,
  onCancel,
  onSave,
}: {
  habitName: string;
  types: MeasurementType[];
  values: Record<number, string>;
  busy: boolean;
  error: string;
  onValueChange: (typeId: number, value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const complete = types.length > 0 && types.every((type) => values[type.id]?.trim());

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-ink)]/55 px-4 py-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="olcum-baslik"
      aria-describedby="olcum-aciklama"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !busy) onCancel();
        }}
        className="brut drop w-full max-w-sm max-h-[calc(100dvh-2.5rem)] overflow-y-auto bg-[var(--color-cream)] p-4"
      >
        <p className="label text-[0.62rem] text-[var(--color-pop-deep)]">
          {habitName} // tamamlanıyor
        </p>
        <h2
          id="olcum-baslik"
          className="font-display font-black uppercase text-[1.7rem] leading-none mt-1"
        >
          Ölçüleri kaydet
        </h2>
        <p
          id="olcum-aciklama"
          className="font-body text-sm leading-relaxed text-[var(--color-muted)] mt-2 mb-4"
        >
          Bugünün değerlerini gir. Kaydedince alışkanlık da tamamlanır.
        </p>

        {types.length === 0 ? (
          <div className="brut-sm bg-[var(--color-pop-pale)] p-3">
            <p className="text-sm font-semibold leading-relaxed">
              Veri girmek için önce Ayarlar&apos;dan en az bir ölçü alanı ekle.
            </p>
            <Link
              href="/ayarlar"
              className="press band mt-3 min-h-11 px-3 flex items-center justify-center text-[0.68rem] font-bold"
            >
              ölçüm ayarlarına git
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {types.map((type, index) => (
              <label key={type.id} className="block">
                <span className="label block text-[0.6rem] font-bold mb-1.5">
                  {type.name}
                  {type.unit ? (
                    <span className="text-[var(--color-muted)]"> // {type.unit}</span>
                  ) : null}
                </span>
                <div className="grid grid-cols-[1fr_auto] border-2 border-[var(--color-ink)] bg-white">
                  <input
                    autoFocus={index === 0}
                    type="text"
                    inputMode="decimal"
                    value={values[type.id] ?? ""}
                    onChange={(event) => onValueChange(type.id, event.target.value)}
                    disabled={busy}
                    aria-label={`${type.name}${type.unit ? `, ${type.unit}` : ""}`}
                    className="min-w-0 min-h-12 bg-transparent px-3 font-mono text-xl font-bold outline-none disabled:opacity-50"
                  />
                  {type.unit ? (
                    <span className="band min-w-14 px-3 grid place-items-center label text-[0.62rem]">
                      {type.unit}
                    </span>
                  ) : null}
                </div>
              </label>
            ))}
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="mt-3 bg-[var(--color-pop-pale)] border-2 border-[var(--color-pop-deep)] px-3 py-2 text-sm font-semibold"
          >
            {error}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2 mt-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="press brut-sm min-h-12 bg-[var(--color-cream)] px-3 font-display font-black uppercase text-sm disabled:opacity-50"
          >
            vazgeç
          </button>
          <button
            type="submit"
            disabled={busy || !complete}
            className="press brut-sm min-h-12 bg-[var(--color-pop)] px-3 font-display font-black uppercase text-sm disabled:opacity-40"
          >
            {busy ? "kaydediliyor…" : "kaydet ve bitir"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ————————————————————————— Ana bileşen ————————————————————————— */

export default function Dashboard({ initial }: { initial: AppState }) {
  const [state, setState] = useState<AppState>(initial);
  const [tasks, setTasks] = useState<GTask[]>([]);
  const [tasksConfigured, setTasksConfigured] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [habitBusy, setHabitBusy] = useState<number | null>(null);
  const [taskBusy, setTaskBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState("");
  const [duaOpen, setDuaOpen] = useState(false);
  const [measurementHabit, setMeasurementHabit] = useState<HabitState | null>(null);
  const [measurementValues, setMeasurementValues] = useState<Record<number, string>>({});
  const [measurementBusy, setMeasurementBusy] = useState(false);
  const [measurementError, setMeasurementError] = useState("");

  const loadTasks = useCallback(async () => {
    try {
      const r = await fetch("/api/tasks");
      if (!r.ok) return;
      const j = await r.json();
      setTasks(j.tasks || []);
      setTasksConfigured(j.configured);
      setState((s) => ({ ...s, tasks: j.stats }));
    } finally {
      setTasksLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  async function toggleHabit(habitId: number, on: boolean) {
    const habit = state.habits.find((item) => item.id === habitId);
    if (on && habit?.measurementRequired) {
      setMeasurementHabit(habit);
      setMeasurementValues(
        Object.fromEntries(state.measurementTypes.map((type) => [type.id, ""]))
      );
      setMeasurementError("");
      return;
    }

    setHabitBusy(habitId);
    try {
      const r = await fetch("/api/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "toggle", payload: { habitId, on } }),
      });
      const j = await r.json();
      if (j.ok) {
        setState(j.state);
        if (on && habit && isTelkinDua(habit.name)) setDuaOpen(true);
      }
    } finally {
      setHabitBusy(null);
    }
  }

  async function saveMeasurements() {
    if (!measurementHabit || measurementBusy) return;
    const values = state.measurementTypes.map((type) => ({
      typeId: type.id,
      value: Number((measurementValues[type.id] ?? "").trim().replace(",", ".")),
    }));
    if (values.some((item) => !Number.isFinite(item.value) || item.value < 0)) {
      setMeasurementError("Tüm alanlara geçerli, sıfır veya daha büyük bir sayı gir.");
      return;
    }

    setMeasurementBusy(true);
    setMeasurementError("");
    try {
      const response = await fetch("/api/measurements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "record",
          payload: { habitId: measurementHabit.id, values },
        }),
      });
      const json = await response.json();
      if (!json.ok) {
        setMeasurementError(json.error || "Ölçümler kaydedilemedi.");
        return;
      }
      setState(json.state);
      setMeasurementHabit(null);
      setMeasurementValues({});
    } catch {
      setMeasurementError("Bağlantı kurulamadı. Değerler kaydedilmedi; tekrar dene.");
    } finally {
      setMeasurementBusy(false);
    }
  }

  async function completeTask(taskId: string) {
    setTaskBusy(taskId);
    try {
      const r = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });
      const j = await r.json();
      if (j.ok) {
        setTasks(j.tasks || []);
        setState((s) => ({ ...s, tasks: j.stats }));
      }
    } finally {
      setTaskBusy(null);
    }
  }

  async function addTask() {
    const title = newTitle.trim();
    if (!title || addBusy) return;
    setAddBusy(true);
    try {
      const r = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const j = await r.json();
      if (j.ok) {
        setTasks(j.tasks || []);
        setNewTitle("");
        setAdding(false);
      }
    } finally {
      setAddBusy(false);
    }
  }

  function startEditingTask(task: GTask) {
    setAdding(false);
    setNewTitle("");
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditError("");
  }

  function cancelEditingTask() {
    setEditingTaskId(null);
    setEditTitle("");
    setEditError("");
  }

  async function saveTaskTitle(taskId: string) {
    const title = editTitle.trim();
    if (!title || editBusy) return;
    setEditBusy(true);
    setEditError("");
    try {
      const r = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, title }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setEditError("Görev güncellenemedi. Tekrar dene.");
        return;
      }
      setTasks(j.tasks || []);
      setEditingTaskId(null);
      setEditTitle("");
    } catch {
      setEditError("Bağlantı kurulamadı. Değişiklik kaydedilmedi.");
    } finally {
      setEditBusy(false);
    }
  }

  const { gun, tarih } = fmtDate(state.today);
  const dueHabits = state.habits.filter((h) => h.dueToday);
  const upcomingHabits = state.habits.filter((h) => !h.dueToday);

  return (
    <main className="min-h-[100dvh] px-4 py-6 max-w-lg mx-auto pb-16">
      {measurementHabit && (
        <MeasurementModal
          habitName={measurementHabit.name}
          types={state.measurementTypes}
          values={measurementValues}
          busy={measurementBusy}
          error={measurementError}
          onValueChange={(typeId, value) =>
            setMeasurementValues((current) => ({ ...current, [typeId]: value }))
          }
          onCancel={() => {
            setMeasurementHabit(null);
            setMeasurementValues({});
            setMeasurementError("");
          }}
          onSave={saveMeasurements}
        />
      )}

      {duaOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-ink)]/55 px-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dua-baslik"
          aria-describedby="dua-metin"
        >
          <div className="brut drop w-full max-w-sm bg-[var(--color-cream)] p-4">
            <p className="label text-[0.62rem] text-[var(--color-pop-deep)]">telkin-dua tamam</p>
            <h2 id="dua-baslik" className="font-display font-black uppercase text-[1.65rem] leading-none mt-1">
              Bir dua daha
            </h2>
            <p id="dua-metin" className="font-body font-medium text-[1.02rem] leading-relaxed mt-4">
              {DUA_TEXT}
            </p>
            <button
              type="button"
              autoFocus
              onClick={() => setDuaOpen(false)}
              className="press brut-sm mt-5 w-full bg-[var(--color-pop)] px-4 py-3 font-display font-black uppercase text-sm"
            >
              Amin
            </button>
          </div>
        </div>
      )}

      {/* ————— MASTHEAD ————— */}
      <header className="rise flex items-start justify-between mb-6">
        <div className="min-w-0">
          <h1 className="font-display font-black uppercase leading-[0.85] text-[clamp(2rem,10.5vw,3.2rem)] tracking-tight">
            Alışkanlık
          </h1>
          <span className="inline-block mt-1 px-2.5 py-0.5 font-display font-black text-xl bg-[var(--color-pop)] text-[var(--color-cream)]">
            TAKİBİ
          </span>
          <p className="label text-[0.62rem] text-[var(--color-muted)] mt-2">
            {gun} // {tarih}
          </p>
        </div>
        <div className="brut-sm bg-[var(--color-ink)] text-[var(--color-cream)] px-3 py-2 text-center shrink-0">
          <div className="font-mono font-bold text-2xl leading-none">
            {state.score.done}
            <span className="text-[var(--color-pop)]">/</span>
            {state.score.total}
          </div>
          <div className="label text-[0.5rem] text-[var(--color-cream)]/60 mt-1">bugün</div>
        </div>
      </header>

      {/* ————— BUGÜN ————— */}
      <section className="rise mb-8" style={{ animationDelay: "60ms" }}>
        <Band>bugün ▸ tıkla ve işaretle</Band>
        {dueHabits.length === 0 ? (
          <p className="brut-sm bg-[var(--color-cream)] px-3 py-3 label text-[0.68rem]">
            bugün planlı alışkanlık yok ✓
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {dueHabits.map((h, i) => (
              <HabitCard
                key={h.id}
                habit={h}
                index={i}
                today={state.today}
                busy={habitBusy === h.id || measurementHabit?.id === h.id}
                onToggle={(on) => toggleHabit(h.id, on)}
              />
            ))}
          </div>
        )}

        {upcomingHabits.length > 0 && (
          <div className="mt-4">
            <p className="label text-[0.58rem] text-[var(--color-muted)] mb-2">
              sırası gelmedi ▸ erken yapacaksan tıkla
            </p>
            <div className="flex flex-col gap-1.5">
              {upcomingHabits.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => toggleHabit(h.id, true)}
                  disabled={habitBusy === h.id || measurementHabit?.id === h.id}
                  aria-label={`${h.name} — ${h.scheduleLabel}, sıradaki ${
                    h.nextDue ? fmtNextDue(h.nextDue, state.today) : "bilinmiyor"
                  }. Erken işaretlemek için dokun.`}
                  className="press flex min-h-11 items-center gap-2.5 border-2 border-dashed border-[var(--color-line)] bg-transparent px-3 py-2 text-left transition-colors hover:bg-[var(--color-cream)] disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-pop-deep)]"
                >
                  <span
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 border-2 border-dashed border-[var(--color-muted)]"
                  />
                  {/* Ad her zaman öncelikli: plan etiketi de kırpılabilir, böylece
                      uzun etiket adı sıfıra indiremiyor. */}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-display font-bold uppercase text-[0.85rem]">
                      {h.name}
                    </span>
                    <span className="label truncate text-[0.55rem] text-[var(--color-muted)]">
                      {h.scheduleLabel}
                    </span>
                  </span>
                  <span className="label shrink-0 text-[0.6rem] font-bold text-[var(--color-pop-deep)]">
                    {h.nextDue ? fmtNextDue(h.nextDue, state.today) : "—"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ————— GENEL GÖREVLER ————— */}
      <section className="rise mb-8" style={{ animationDelay: "120ms" }}>
        <Band
          action={
            tasksConfigured ? (
              <button
                type="button"
                aria-label={adding ? "Görev eklemeyi kapat" : "Yeni görev ekle"}
                aria-expanded={adding}
                onClick={() => {
                  cancelEditingTask();
                  setAdding((v) => !v);
                }}
                className="press -my-2 -mr-3 w-11 h-11 grid place-items-center border-l-2 border-[var(--color-cream)]/30 text-[var(--color-pop)] font-display font-black text-2xl leading-none focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-[var(--color-pop)]"
              >
                <span className={`transition-transform duration-200 ${adding ? "rotate-45" : ""}`}>
                  +
                </span>
              </button>
            ) : null
          }
        >
          google tasks
        </Band>

        {adding && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addTask();
            }}
            className="drop brut-sm bg-[var(--color-cream)] px-3 py-2.5 mb-3 flex items-center gap-2"
          >
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setNewTitle("");
                  setAdding(false);
                }
              }}
              disabled={addBusy}
              placeholder="görev yaz, enter'a bas…"
              className="flex-1 min-w-0 bg-transparent outline-none font-body text-[0.9rem] placeholder:text-[var(--color-muted)]"
            />
            <button
              type="submit"
              disabled={!newTitle.trim() || addBusy}
              className="press label text-[0.6rem] bg-[var(--color-ink)] text-[var(--color-cream)] px-2.5 py-1.5 shrink-0 disabled:opacity-40"
            >
              {addBusy ? "…" : "ekle"}
            </button>
          </form>
        )}

        {tasksLoading ? (
          <p className="label text-[0.65rem] text-[var(--color-muted)] px-1">yükleniyor…</p>
        ) : !tasksConfigured ? (
          <p className="label text-[0.62rem] text-[var(--color-muted)] px-1 leading-relaxed">
            ▸ Google Tasks bağlı değil
          </p>
        ) : tasks.length === 0 ? (
          <p className="brut-sm bg-[var(--color-cream)] px-3 py-3 label text-[0.68rem]">
            tüm görevler tamam ✓
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {tasks.map((task) =>
              editingTaskId === task.id ? (
                <form
                  key={task.id}
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveTaskTitle(task.id);
                  }}
                  className="drop brut-sm bg-[var(--color-cream)] p-2.5"
                >
                  <label
                    htmlFor={`task-title-${task.id}`}
                    className="label block text-[0.58rem] font-bold text-[var(--color-pop-deep)]"
                  >
                    görevi düzenle
                  </label>
                  <input
                    id={`task-title-${task.id}`}
                    autoFocus
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") cancelEditingTask();
                    }}
                    disabled={editBusy}
                    maxLength={500}
                    className="mt-1.5 min-h-11 w-full border-2 border-[var(--color-ink)] bg-[var(--color-cream-2)] px-2.5 font-body text-base outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-pop)] focus-visible:ring-offset-2"
                  />
                  {editError && (
                    <p role="alert" className="mt-2 text-sm font-semibold text-[var(--color-pop-deep)]">
                      {editError}
                    </p>
                  )}
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={cancelEditingTask}
                      disabled={editBusy}
                      className="press min-h-11 border-2 border-[var(--color-ink)] bg-[var(--color-cream)] px-3 label text-[0.62rem] font-bold disabled:opacity-40"
                    >
                      vazgeç
                    </button>
                    <button
                      type="submit"
                      disabled={!editTitle.trim() || editBusy}
                      className="press min-h-11 border-2 border-[var(--color-ink)] bg-[var(--color-pop)] px-3 label text-[0.62rem] font-bold disabled:opacity-40"
                    >
                      {editBusy ? "kaydediliyor…" : "kaydet"}
                    </button>
                  </div>
                </form>
              ) : (
                <div
                  key={task.id}
                  className={`brut-sm bg-[var(--color-cream)] flex items-stretch overflow-hidden ${
                    taskBusy === task.id ? "opacity-50" : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => completeTask(task.id)}
                    disabled={taskBusy !== null || editBusy}
                    aria-label={`${task.title} görevini tamamla`}
                    className="w-12 min-h-12 shrink-0 grid place-items-center transition-colors active:bg-[var(--color-cream-2)] disabled:cursor-wait focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-[var(--color-pop)]"
                  >
                    <span aria-hidden="true" className="w-5 h-5 border-2 border-[var(--color-ink)] shrink-0" />
                  </button>
                  <div className="flex min-w-0 flex-1 items-center py-1.5 pr-2.5">
                    <TaskTitle title={task.title} />
                  </div>
                  <button
                    type="button"
                    onClick={() => startEditingTask(task)}
                    disabled={taskBusy !== null || editBusy}
                    aria-label={`${task.title} görevini düzenle`}
                    className="press w-12 min-h-12 shrink-0 grid place-items-center border-l-2 border-[var(--color-ink)] bg-[var(--color-cream-2)] disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-[var(--color-pop)]"
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.25"
                      strokeLinecap="square"
                      strokeLinejoin="miter"
                      className="h-5 w-5"
                    >
                      <path d="M4 20h4L19 9l-4-4L4 16v4Z" />
                      <path d="m13.5 6.5 4 4" />
                    </svg>
                  </button>
                </div>
              )
            )}
          </div>
        )}
      </section>

      {/* ————— İSTATİSTİK ————— */}
      <section className="rise mb-8" style={{ animationDelay: "180ms" }}>
        <Band>istatistik // bu ay</Band>
        <p className="font-display font-extrabold text-[0.95rem] uppercase mb-2.5">Bu ay tamamlanma</p>
        <MonthBars habits={state.habits} />
        <p className="font-display font-extrabold text-[0.95rem] uppercase mb-2.5 mt-5">
          Günün hangi saatinde
        </p>
        <TimeBars habits={state.habits} />
      </section>

      {/* ————— TUTARLILIK (ısı haritası) ————— */}
      <section className="rise mb-8" style={{ animationDelay: "240ms" }}>
        <Band>tutarlılık // koyu = çok alışkanlık</Band>
        <div className="brut-sm bg-[var(--color-cream)] p-3">
          <HeatMap cells={state.heatmap} total={state.heatMax} />
        </div>
      </section>

      {/* ————— GEÇMİŞ + AYARLAR ————— */}
      <Link
        href="/olcumler"
        className="press brut-sm bg-[var(--color-pop)] flex items-center justify-between px-4 py-3 mb-3"
      >
        <span className="font-display font-extrabold uppercase text-sm">
          Ölçüm geçmişi
        </span>
        <span className="font-mono">→</span>
      </Link>
      <Link
        href="/gecmis"
        className="press brut-sm bg-[var(--color-ink)] text-[var(--color-cream)] flex items-center justify-between px-4 py-3 mb-3"
      >
        <span className="font-display font-extrabold uppercase text-sm">Geçmiş // gör & düzenle</span>
        <span className="font-mono text-[var(--color-pop)]">→</span>
      </Link>
      <Link
        href="/ayarlar"
        className="press brut-sm bg-[var(--color-cream)] flex items-center justify-between px-4 py-3 mb-6"
      >
        <span className="font-display font-extrabold uppercase text-sm">Alışkanlıkları düzenle</span>
        <span className="font-mono">→</span>
      </Link>

      <p className="label text-[0.55rem] text-[var(--color-muted)] text-center">
        alışkanlık takibi — brutalist
      </p>
    </main>
  );
}
