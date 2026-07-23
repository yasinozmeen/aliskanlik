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
  measurementRequired: boolean;
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
  measurementTypes: MeasurementType[];
  score: { done: number; total: number };
  heatmap: HeatCell[];
  heatWeeks: number;
  tasks: TasksState;
};

export type HistoryDay = { date: string; isToday: boolean; marks: Record<number, string | null> };
export type HistoryState = {
  habits: { id: number; name: string }[];
  days: HistoryDay[];
};

/* ————————————————————————————— Sorgular ————————————————————————————— */

export type Habit = {
  id: number;
  name: string;
  active: number;
  sort_order: number;
  measurement_required: number;
};

export type MeasurementType = {
  id: number;
  name: string;
  unit: string;
  active: number;
  sort_order: number;
};

export type MeasurementInput = { typeId: number; value: number };

export type MeasurementHistoryValue = {
  typeId: number;
  name: string;
  unit: string;
  value: number;
};

export type MeasurementHistoryEntry = {
  habitId: number;
  habitName: string;
  date: string;
  time: string;
  values: MeasurementHistoryValue[];
};

export type MeasurementSettings = {
  habitId: number | null;
  types: MeasurementType[];
};

export function getHabits(activeOnly = true): Habit[] {
  const d = db();
  const sql = activeOnly
    ? `SELECT id, name, active, sort_order, measurement_required
       FROM habits WHERE active = 1 ORDER BY sort_order, id`
    : `SELECT id, name, active, sort_order, measurement_required
       FROM habits ORDER BY sort_order, id`;
  return d.prepare(sql).all() as Habit[];
}

export function getMeasurementTypes(activeOnly = true): MeasurementType[] {
  const sql = activeOnly
    ? `SELECT id, name, unit, active, sort_order FROM measurement_types
       WHERE active = 1 ORDER BY sort_order, id`
    : `SELECT id, name, unit, active, sort_order FROM measurement_types
       ORDER BY sort_order, id`;
  return db().prepare(sql).all() as MeasurementType[];
}

export function getMeasurementSettings(): MeasurementSettings {
  const selected = db()
    .prepare(
      `SELECT id FROM habits WHERE measurement_required = 1
       ORDER BY sort_order, id LIMIT 1`
    )
    .get() as { id: number } | undefined;
  return {
    habitId: selected?.id ?? null,
    types: getMeasurementTypes(true),
  };
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
      measurementRequired: h.measurement_required === 1,
      doneToday: !!todayRow,
      doneTime: todayRow ? todayRow.time : null,
      streak,
      record,
      monthPct,
      timeDist,
    };
  });

  const doneCount = habitStates.filter((h) => h.doneToday).length;

  // Isı haritası: son heatWeeks hafta, gün başına yapılan alışkanlık adedi.
  // Sabit sayı (kaydırmasız mobilde sığar); en yeni gün en solda gösterilir.
  const heatWeeks = 18;
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
    measurementTypes: getMeasurementTypes(true),
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
    const tx = d.transaction(() => {
      d.prepare("DELETE FROM measurement_values WHERE habit_id = ? AND date = ?").run(
        habitId,
        today
      );
      d.prepare("DELETE FROM logs WHERE habit_id = ? AND date = ?").run(habitId, today);
    });
    tx();
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
  const d = db();
  const tx = d.transaction(() => {
    d.prepare("DELETE FROM measurement_values WHERE habit_id = ?").run(habitId);
    d.prepare("DELETE FROM logs WHERE habit_id = ?").run(habitId);
    d.prepare("DELETE FROM habits WHERE id = ?").run(habitId);
  });
  tx();
}

export function setMeasurementHabit(habitId: number | null): void {
  const d = db();
  if (
    habitId !== null &&
    !d.prepare("SELECT 1 FROM habits WHERE id = ?").get(habitId)
  ) {
    throw new Error("Alışkanlık bulunamadı.");
  }
  const tx = d.transaction(() => {
    d.prepare("UPDATE habits SET measurement_required = 0").run();
    if (habitId !== null) {
      d.prepare("UPDATE habits SET measurement_required = 1 WHERE id = ?").run(habitId);
    }
  });
  tx();
}

export function addMeasurementType(name: string, unit: string): void {
  const cleanName = name.trim();
  const cleanUnit = unit.trim();
  if (!cleanName) throw new Error("Ölçü adı boş bırakılamaz.");
  const d = db();
  const max = (
    d.prepare("SELECT MAX(sort_order) AS m FROM measurement_types").get() as {
      m: number | null;
    }
  ).m ?? -1;
  d.prepare(
    `INSERT INTO measurement_types (name, unit, active, sort_order)
     VALUES (?, ?, 1, ?)`
  ).run(cleanName, cleanUnit, max + 1);
}

export function updateMeasurementType(id: number, name: string, unit: string): void {
  const cleanName = name.trim();
  if (!cleanName) throw new Error("Ölçü adı boş bırakılamaz.");
  const result = db()
    .prepare("UPDATE measurement_types SET name = ?, unit = ? WHERE id = ? AND active = 1")
    .run(cleanName, unit.trim(), id);
  if (result.changes === 0) throw new Error("Ölçü alanı bulunamadı.");
}

export function archiveMeasurementType(id: number): void {
  db().prepare("UPDATE measurement_types SET active = 0 WHERE id = ?").run(id);
}

export function recordMeasurements(habitId: number, values: MeasurementInput[]): void {
  const d = db();
  const habit = d
    .prepare("SELECT measurement_required FROM habits WHERE id = ? AND active = 1")
    .get(habitId) as { measurement_required: number } | undefined;
  if (!habit || habit.measurement_required !== 1) {
    throw new Error("Bu alışkanlık ölçüm kaydı için ayarlanmamış.");
  }

  const types = getMeasurementTypes(true);
  if (types.length === 0) throw new Error("Önce en az bir ölçü alanı ekleyin.");
  if (values.length !== types.length) throw new Error("Tüm ölçü alanlarını doldurun.");

  const valueMap = new Map<number, number>();
  for (const item of values) {
    if (valueMap.has(item.typeId)) throw new Error("Aynı ölçü birden fazla gönderildi.");
    if (!Number.isFinite(item.value) || item.value < 0) {
      throw new Error("Ölçüm değerleri sıfır veya daha büyük bir sayı olmalı.");
    }
    valueMap.set(item.typeId, item.value);
  }
  if (types.some((type) => !valueMap.has(type.id))) {
    throw new Error("Tüm ölçü alanlarını doldurun.");
  }

  const today = todayISO();
  const time = nowHM();
  const save = d.transaction(() => {
    d.prepare(
      `INSERT INTO logs (habit_id, date, time) VALUES (?, ?, ?)
       ON CONFLICT(habit_id, date) DO UPDATE SET time = excluded.time`
    ).run(habitId, today, time);

    const upsert = d.prepare(
      `INSERT INTO measurement_values
         (habit_id, measurement_type_id, date, value)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(habit_id, measurement_type_id, date)
       DO UPDATE SET value = excluded.value, created_at = datetime('now')`
    );
    for (const type of types) {
      upsert.run(habitId, type.id, today, valueMap.get(type.id));
    }
  });
  save();
}

export function getMeasurementHistory(limit = 365): MeasurementHistoryEntry[] {
  const safeLimit = Math.max(1, Math.min(2000, Math.trunc(limit)));
  const rows = db()
    .prepare(
      `SELECT mv.habit_id, h.name AS habit_name, mv.date, l.time,
              mt.id AS type_id, mt.name, mt.unit, mv.value
       FROM measurement_values mv
       JOIN measurement_types mt ON mt.id = mv.measurement_type_id
       JOIN habits h ON h.id = mv.habit_id
       JOIN logs l ON l.habit_id = mv.habit_id AND l.date = mv.date
       ORDER BY mv.date DESC, mv.habit_id, mt.sort_order, mt.id
       LIMIT ?`
    )
    .all(safeLimit * Math.max(1, getMeasurementTypes(false).length)) as {
    habit_id: number;
    habit_name: string;
    date: string;
    time: string;
    type_id: number;
    name: string;
    unit: string;
    value: number;
  }[];

  const entries = new Map<string, MeasurementHistoryEntry>();
  for (const row of rows) {
    const key = `${row.date}:${row.habit_id}`;
    if (!entries.has(key)) {
      entries.set(key, {
        habitId: row.habit_id,
        habitName: row.habit_name,
        date: row.date,
        time: row.time,
        values: [],
      });
    }
    entries.get(key)!.values.push({
      typeId: row.type_id,
      name: row.name,
      unit: row.unit,
      value: row.value,
    });
  }
  return [...entries.values()].slice(0, safeLimit);
}

/** Geçmiş bir günü işaretle/kaldır. Elle eklenen kayda nötr saat (12:00) verilir. */
export function toggleHabitOnDate(habitId: number, date: string, on: boolean, time = "12:00"): void {
  const d = db();
  if (on) {
    d.prepare(
      `INSERT INTO logs (habit_id, date, time) VALUES (?, ?, ?)
       ON CONFLICT(habit_id, date) DO UPDATE SET time = excluded.time`
    ).run(habitId, date, time);
  } else {
    const tx = d.transaction(() => {
      d.prepare("DELETE FROM measurement_values WHERE habit_id = ? AND date = ?").run(
        habitId,
        date
      );
      d.prepare("DELETE FROM logs WHERE habit_id = ? AND date = ?").run(habitId, date);
    });
    tx();
  }
}

/** Son `days` günün alışkanlık matrisi (bugünden geriye), düzenleme sayfası için. */
export function getHistory(days = 90): HistoryState {
  const d = db();
  const today = todayISO();
  const habits = getHabits(true);
  const start = addDays(today, -(days - 1));
  const rows = d
    .prepare("SELECT habit_id, date, time FROM logs WHERE date >= ? AND date <= ?")
    .all(start, today) as { habit_id: number; date: string; time: string }[];

  const byDate = new Map<string, Record<number, string>>();
  for (const r of rows) {
    if (!byDate.has(r.date)) byDate.set(r.date, {});
    byDate.get(r.date)![r.habit_id] = r.time;
  }

  const daysArr: HistoryDay[] = [];
  for (let i = 0; i < days; i++) {
    const dt = addDays(today, -i); // en yeni önce
    const dayMarks = byDate.get(dt) || {};
    const marks: Record<number, string | null> = {};
    for (const h of habits) marks[h.id] = dayMarks[h.id] ?? null;
    daysArr.push({ date: dt, isToday: dt === today, marks });
  }

  return { habits: habits.map((h) => ({ id: h.id, name: h.name })), days: daysArr };
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
