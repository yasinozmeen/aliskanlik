"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { AppState, HabitState, HeatCell } from "@/lib/logic";

type GTask = { id: string; title: string };

/* ————————————————————————— Yardımcılar ————————————————————————— */

function fmtDate(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return {
    gun: d.toLocaleDateString("tr-TR", { weekday: "long" }),
    tarih: d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }),
  };
}

/* ————————————————————————— Alışkanlık kartı ————————————————————————— */

function HabitCard({
  habit,
  index,
  busy,
  onToggle,
}: {
  habit: HabitState;
  index: number;
  busy: boolean;
  onToggle: (on: boolean) => void;
}) {
  const done = habit.doneToday;
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
            gün
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
    setHabitBusy(habitId);
    try {
      const r = await fetch("/api/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "toggle", payload: { habitId, on } }),
      });
      const j = await r.json();
      if (j.ok) setState(j.state);
    } finally {
      setHabitBusy(null);
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

  const { gun, tarih } = fmtDate(state.today);

  return (
    <main className="min-h-[100dvh] px-4 py-6 max-w-lg mx-auto pb-16">
      {/* ————— MASTHEAD ————— */}
      <header className="rise flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display font-black uppercase leading-[0.85] text-[clamp(2.4rem,13vw,3.2rem)] tracking-tight">
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
        <div className="grid grid-cols-2 gap-3">
          {state.habits.map((h, i) => (
            <HabitCard
              key={h.id}
              habit={h}
              index={i}
              busy={habitBusy === h.id}
              onToggle={(on) => toggleHabit(h.id, on)}
            />
          ))}
        </div>
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
                onClick={() => setAdding((v) => !v)}
                className="press -my-1.5 -mr-1.5 w-8 h-8 grid place-items-center text-[var(--color-pop)] font-display font-black text-2xl leading-none"
              >
                <span className={`transition-transform duration-200 ${adding ? "rotate-45" : ""}`}>
                  +
                </span>
              </button>
            ) : null
          }
        >
          genel görevler // google tasks
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
            {tasks.map((task) => (
              <button
                key={task.id}
                onClick={() => !taskBusy && completeTask(task.id)}
                className={`press brut-sm bg-[var(--color-cream)] px-3 py-2.5 flex items-center gap-3 text-left ${
                  taskBusy === task.id ? "opacity-50" : ""
                }`}
              >
                <span className="w-5 h-5 border-2 border-[var(--color-ink)] shrink-0" />
                <span className="font-body text-[0.9rem] leading-snug">{task.title}</span>
              </button>
            ))}
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
          <HeatMap cells={state.heatmap} total={state.score.total} />
        </div>
      </section>

      {/* ————— GEÇMİŞ + AYARLAR ————— */}
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
