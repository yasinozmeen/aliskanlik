import { db } from "./db";

/* ————————————————— Tarih yardımcıları (Europe/Istanbul sabit) —————————————————
   Container UTC olabilir; "bugün" ve "şu anki saat" her zaman İstanbul'a göre. */

const TZ = "Europe/Istanbul";

export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function nowHM(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

function dayOfMonth(iso: string): number {
  return Number(iso.split("-")[2]);
}

/* ————————————————————————————— Tipler ————————————————————————————— */

export type HabitState = {
  id: number;
  name: string;
  doneToday: boolean;
  doneTime: string | null;
  streak: number;
  record: number;
  monthPct: number;
  timeDist: { gece: number; sabah: number; ogle: number; aksam: number };
};

export type HeatCell = { date: string; count: number };

export type TasksState = { today: number; month: number; streak: number };

export type AppState = {
  today: string;
  habits: HabitState[];
  score: { done: number; total: number };
  heatmap: HeatCell[];
  heatWeeks: number;
  tasks: TasksState;
};

/* ————————————————————————————— Sorgular ————————————————————————————— */

export type Habit = { id: number; name: string; active: number; sort_order: number };

export function getHabits(activeOnly = true): Habit[] {
  const d = db();
  const sql = activeOnly
    ? "SELECT id, name, active, sort_order FROM habits WHERE active = 1 ORDER BY sort_order, id"
    : "SELECT id, name, active, sort_order FROM habits ORDER BY sort_order, id";
  return d.prepare(sql).all() as Habit[];
}

/** Ardışık seri hesabı: verilen gün kümesinden güncel seri + rekor. */
function computeStreaks(dates: Set<string>, today: string): { streak: number; record: number } {
  if (dates.size === 0) return { streak: 0, record: 0 };

  // Rekor: sıralı günlerde en uzun ardışık zincir
  const sorted = [...dates].sort();
  let record = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === addDays(sorted[i - 1], 1)) {
      run++;
      if (run > record) record = run;
    } else {
      run = 1;
    }
  }

  // Güncel seri: bugünden (veya bugün yoksa dünden) geriye ardışık say
  let cursor = dates.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (dates.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }

  return { streak, record };
}

function segment(hm: string): "gece" | "sabah" | "ogle" | "aksam" {
  const h = Number(hm.split(":")[0]);
  if (h < 6) return "gece";
  if (h < 12) return "sabah";
  if (h < 18) return "ogle";
  return "aksam";
}

/** Dashboard'un tüm durumu (yalnız DB — hızlı). Google Tasks listesi ayrı çekilir. */
export function getState(): AppState {
  const d = db();
  const today = todayISO();
  const habits = getHabits(true);

  const monthStart = today.slice(0, 8) + "01";
  const elapsed = dayOfMonth(today); // ay başından bugüne geçen gün sayısı

  const habitStates: HabitState[] = habits.map((h) => {
    const rows = d
      .prepare("SELECT date, time FROM logs WHERE habit_id = ? ORDER BY date")
      .all(h.id) as { date: string; time: string }[];

    const dates = new Set(rows.map((r) => r.date));
    const { streak, record } = computeStreaks(dates, today);

    const todayRow = rows.find((r) => r.date === today);

    let monthDone = 0;
    const timeDist = { gece: 0, sabah: 0, ogle: 0, aksam: 0 };
    for (const r of rows) {
      if (r.date >= monthStart && r.date <= today) monthDone++;
      timeDist[segment(r.time)]++;
    }
    const monthPct = elapsed > 0 ? Math.round((monthDone / elapsed) * 100) : 0;

    return {
      id: h.id,
      name: h.name,
      doneToday: !!todayRow,
      doneTime: todayRow ? todayRow.time : null,
      streak,
      record,
      monthPct,
      timeDist,
    };
  });

  const doneCount = habitStates.filter((h) => h.doneToday).length;

  // Isı haritası: son heatWeeks hafta, gün başına yapılan alışkanlık adedi
  const heatWeeks = 26;
  const heatStart = addDays(today, -(heatWeeks * 7 - 1));
  const perDay = d
    .prepare(
      "SELECT date, COUNT(*) AS c FROM logs WHERE date >= ? AND date <= ? GROUP BY date"
    )
    .all(heatStart, today) as { date: string; c: number }[];
  const countMap = new Map(perDay.map((r) => [r.date, r.c]));
  const heatmap: HeatCell[] = [];
  for (let i = 0; i < heatWeeks * 7; i++) {
    const dt = addDays(heatStart, i);
    heatmap.push({ date: dt, count: countMap.get(dt) || 0 });
  }

  return {
    today,
    habits: habitStates,
    score: { done: doneCount, total: habits.length },
    heatmap,
    heatWeeks,
    tasks: getTaskStats(today),
  };
}

/* ————————————————————————————— Eylemler ————————————————————————————— */

/** Bugünü işaretle/geri al. İşaretlenirse o anki saat kaydedilir. */
export function toggleHabit(habitId: number, on: boolean): void {
  const d = db();
  const today = todayISO();
  if (on) {
    d.prepare(
      `INSERT INTO logs (habit_id, date, time) VALUES (?, ?, ?)
       ON CONFLICT(habit_id, date) DO UPDATE SET time = excluded.time`
    ).run(habitId, today, nowHM());
  } else {
    d.prepare("DELETE FROM logs WHERE habit_id = ? AND date = ?").run(habitId, today);
  }
}

export function addHabit(name: string): void {
  const d = db();
  const max = (d.prepare("SELECT MAX(sort_order) AS m FROM habits").get() as { m: number | null }).m ?? -1;
  d.prepare("INSERT INTO habits (name, active, sort_order) VALUES (?, 1, ?)").run(name.trim(), max + 1);
}

export function setHabitActive(habitId: number, active: boolean): void {
  db().prepare("UPDATE habits SET active = ? WHERE id = ?").run(active ? 1 : 0, habitId);
}

export function renameHabit(habitId: number, name: string): void {
  db().prepare("UPDATE habits SET name = ? WHERE id = ?").run(name.trim(), habitId);
}

export function deleteHabit(habitId: number): void {
  db().prepare("DELETE FROM habits WHERE id = ?").run(habitId);
}

/* ————————————————————————————— Görev sayacı ————————————————————————————— */

export function getTaskStats(today = todayISO()): TasksState {
  const d = db();
  const monthStart = today.slice(0, 8) + "01";

  const todayCount =
    (d.prepare("SELECT count FROM task_counts WHERE date = ?").get(today) as { count: number } | undefined)?.count ?? 0;

  const month =
    (d.prepare("SELECT COALESCE(SUM(count),0) AS s FROM task_counts WHERE date >= ? AND date <= ?").get(monthStart, today) as { s: number }).s;

  // Seri: en az 1 görev tamamlanan ardışık günler (bugün 0 ise dünden say)
  const rows = d
    .prepare("SELECT date FROM task_counts WHERE count >= 1")
    .all() as { date: string }[];
  const dates = new Set(rows.map((r) => r.date));
  const { streak } = computeStreaks(dates, today);

  return { today: todayCount, month, streak };
}

/** Dashboard'dan bir görev tamamlanınca bugünün sayacını +1. */
export function bumpTaskCount(): number {
  const d = db();
  const today = todayISO();
  d.prepare(
    `INSERT INTO task_counts (date, count) VALUES (?, 1)
     ON CONFLICT(date) DO UPDATE SET count = count + 1`
  ).run(today);
  return (d.prepare("SELECT count FROM task_counts WHERE date = ?").get(today) as { count: number }).count;
}
