import { db } from "./db";
import {
  SCAN_DAYS,
  addDays,
  countCycles,
  daysBetween,
  dueDatesInRange,
  gapStreaks,
  isCalendarSchedule,
  isDueOn,
  isValidISODate,
  maxDate,
  minDate,
  nextDueDate,
  occurrenceStreaks,
  parseSchedule,
  scheduleLabel,
} from "./schedule";
import type {
  AnchorMode,
  Schedule,
  ScheduleKind,
  ScheduleRow,
} from "./schedule";

export * from "./schedule";

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

/* ————————————————————————————— Tipler ————————————————————————————— */

export type HabitState = {
  id: number;
  name: string;
  schedule: Schedule;
  scheduleLabel: string;
  /** Bugün sırası geldi mi (erken işaretlenmişse de true kabul edilir). */
  dueToday: boolean;
  /** Sırası gelmediyse bir sonraki planlı gün. */
  nextDue: string | null;
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
  /** Isı haritası renk skalasının üst ucu (penceredeki en yoğun gün). */
  heatMax: number;
  tasks: TasksState;
};

export type HistoryDay = {
  date: string;
  isToday: boolean;
  marks: Record<number, string | null>;
  /** O gün alışkanlığın sırası gelmiş miydi (plan dışı günler soluk gösterilir). */
  planned: Record<number, boolean>;
};
export type HistoryState = {
  habits: { id: number; name: string; scheduleLabel: string }[];
  days: HistoryDay[];
};

/* ————————————————————————————— Sorgular ————————————————————————————— */

export type Habit = {
  id: number;
  name: string;
  active: number;
  sort_order: number;
  created_at: string;
  schedule: Schedule;
  scheduleLabel: string;
  notify_mode: "standard" | "custom" | "periodic" | "off";
  notify_time: string | null;
  notify_interval: number | null;
  last_notified_at: string | null;
};

/**
 * Kullanıcı girdisi hatası — API bunu 400 ile ve mesajıyla döner.
 * Beklenmedik iç hatalar 500 döner ve mesajı dışarı sızmaz.
 */
export class InputError extends Error {}

export type ScheduleInput = {
  kind: string;
  intervalDays?: number;
  anchorMode?: string;
  anchorDate?: string | null;
  weekdays?: number[];
};






const HABIT_COLUMNS = `id, name, active, sort_order, created_at,
                       schedule_kind, interval_days, anchor_mode, anchor_date, weekdays,
                       notify_mode, notify_time, notify_interval, last_notified_at`;

type HabitRow = Omit<Habit, "schedule" | "scheduleLabel"> & ScheduleRow;

function toHabit(row: HabitRow): Habit {
  const schedule = parseSchedule(row);
  return {
    id: row.id,
    name: row.name,
    active: row.active,
    sort_order: row.sort_order,
    created_at: row.created_at,
    schedule,
    scheduleLabel: scheduleLabel(schedule),
    notify_mode: row.notify_mode,
    notify_time: row.notify_time,
    notify_interval: row.notify_interval,
    last_notified_at: row.last_notified_at,
  };
}

export function getHabits(activeOnly = true): Habit[] {
  const d = db();
  const sql = activeOnly
    ? `SELECT ${HABIT_COLUMNS} FROM habits WHERE active = 1 ORDER BY sort_order, id`
    : `SELECT ${HABIT_COLUMNS} FROM habits ORDER BY sort_order, id`;
  return (d.prepare(sql).all() as HabitRow[]).map(toHabit);
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

/**
 * `habits.created_at` SQLite `datetime('now')` ile UTC yazılır; uygulamanın
 * "bugün"ü ise İstanbul'a göredir. Ham metni kesmek gece yarısı ile 03:00
 * arasında oluşturulan alışkanlığı bir gün geriye atar ve sabit takvimi kaydırır.
 */
function habitCreatedDate(createdAt: string | null, fallback: string): string {
  if (!createdAt) return fallback;
  const utc = new Date(createdAt.replace(" ", "T") + "Z");
  if (Number.isNaN(utc.getTime())) return createdAt.slice(0, 10) || fallback;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(utc);
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

  const habitStates: HabitState[] = habits.map((h) => {
    const rows = d
      .prepare("SELECT date, time FROM logs WHERE habit_id = ? ORDER BY date")
      .all(h.id) as { date: string; time: string }[];

    const sortedDates = rows.map((r) => r.date);
    const dates = new Set(sortedDates);
    const schedule = h.schedule;
    const createdAnchor = habitCreatedDate(h.created_at, today);
    // Alışkanlığın başlangıcı: oluşturulma günü ya da (Sheets'ten aktarılan
    // kayıtlar için) ilk kayıt — hangisi daha eskiyse. Bundan önceki günler
    // hiçbir hesaba katılmaz; yoksa yeni alışkanlık var olmadığı günlerden
    // ceza yer ve aylık yüzdesi yanlış çıkar.
    const habitStart = sortedDates.length
      ? minDate(sortedDates[0], createdAnchor)
      : createdAnchor;

    // "Son yapılıştan say" modunda bugünün durumu, bugünden ÖNCEKİ son kayda bakar.
    let lastDoneBeforeToday: string | null = null;
    for (const date of sortedDates) {
      if (date < today) lastDoneBeforeToday = date;
    }
    const lastDone = sortedDates.length ? sortedDates[sortedDates.length - 1] : null;

    const todayRow = rows.find((r) => r.date === today);
    const doneToday = !!todayRow;
    const dueToday =
      doneToday || isDueOn(schedule, today, lastDoneBeforeToday, createdAnchor);

    const timeDist = { gece: 0, sabah: 0, ogle: 0, aksam: 0 };
    for (const r of rows) timeDist[segment(r.time)]++;

    // Aylık yüzde penceresi: ay başı, ama alışkanlık ay içinde başladıysa o gün.
    const pctStart = maxDate(monthStart, habitStart);

    let streak: number;
    let record: number;
    let expected: number;
    let monthDone: number;

    if (isCalendarSchedule(schedule)) {
      // Takvim tabanlı plan: sırası gelen günler geçmişten bağımsız hesaplanır.
      const scanStart = maxDate(habitStart, addDays(today, -SCAN_DAYS));
      const occurrences = dueDatesInRange(
        schedule,
        scanStart,
        today,
        sortedDates,
        createdAnchor
      );
      ({ streak, record } = occurrenceStreaks(occurrences, dates, today));
      // Yüzde yalnız planlı günlere bakar; plan dışı işaretlemeler oranı şişirmez.
      const monthOccurrences = occurrences.filter((date) => date >= pctStart);
      expected = monthOccurrences.length;
      monthDone = monthOccurrences.filter((date) => dates.has(date)).length;
    } else {
      ({ streak, record } = gapStreaks(sortedDates, today, schedule.intervalDays));
      // Pay da payda da TUR sayar. Ham kayıt sayılsaydı 14 günde bir planlı bir
      // şeyi her gün yapmak %750 üretir, cap de bunu gizlerdi.
      const elapsedInWindow = daysBetween(pctStart, today) + 1;
      expected = Math.max(1, Math.ceil(elapsedInWindow / schedule.intervalDays));
      monthDone = countCycles(sortedDates, schedule.intervalDays, pctStart, today);
    }
    const monthPct =
      expected > 0 ? Math.min(100, Math.round((monthDone / expected) * 100)) : 0;

    return {
      id: h.id,
      name: h.name,
      schedule,
      scheduleLabel: h.scheduleLabel,
      dueToday,
      // Bugün yapılmış olsa bile sıradaki gün gösterilir — periyodik planın
      // asıl faydası "ne zaman tekrar?" bilgisidir.
      nextDue: nextDueDate(schedule, today, lastDone, createdAnchor),
      doneToday,
      doneTime: todayRow ? todayRow.time : null,
      streak,
      record,
      monthPct,
      timeDist,
    };
  });

  // Skor yalnız bugün sırası gelen alışkanlıkları sayar.
  const dueHabits = habitStates.filter((h) => h.dueToday);
  const doneCount = dueHabits.filter((h) => h.doneToday).length;

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
  // Periyodik planlarda günlük hedef sabit değil; skala penceredeki en yoğun güne göre.
  const heatMax = Math.max(1, ...heatmap.map((cell) => cell.count));

  return {
    today,
    habits: habitStates,
    score: { done: doneCount, total: dueHabits.length },
    heatmap,
    heatWeeks,
    heatMax,
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
    d.prepare("DELETE FROM logs WHERE habit_id = ?").run(habitId);
    d.prepare("DELETE FROM habits WHERE id = ?").run(habitId);
  });
  tx();
}

/** Bir alışkanlığın periyodik planını değiştirir. */
export function setHabitSchedule(habitId: number, input: ScheduleInput): void {
  const d = db();
  if (!d.prepare("SELECT 1 FROM habits WHERE id = ?").get(habitId)) {
    throw new InputError("Alışkanlık bulunamadı.");
  }

  // Bozuk gövde sessizce "her gün"e düşmemeli — kullanıcı planını kaybettiğini
  // fark etmez. Nesne olmayan her şey açık hata verir.
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new InputError("Geçersiz plan verisi.");
  }
  if (input.kind !== "daily" && input.kind !== "interval" && input.kind !== "weekly") {
    throw new InputError("Geçersiz plan tipi.");
  }

  const kind: ScheduleKind = input.kind;

  let intervalDays = 1;
  let anchorMode: AnchorMode = "last";
  let anchorDate: string | null = null;
  let weekdays = "";

  if (kind === "interval") {
    intervalDays = Math.trunc(Number(input.intervalDays));
    if (!Number.isFinite(intervalDays) || intervalDays < 1 || intervalDays > 365) {
      throw new InputError("Aralık 1 ile 365 gün arasında olmalı.");
    }
    anchorMode = input.anchorMode === "fixed" ? "fixed" : "last";
    if (anchorMode === "fixed") {
      const given = typeof input.anchorDate === "string" ? input.anchorDate.trim() : "";
      if (given && !isValidISODate(given)) {
        throw new InputError("Başlangıç günü geçerli bir tarih olmalı.");
      }
      anchorDate = given || todayISO();
    }
  }

  if (kind === "weekly") {
    const days = [
      ...new Set(
        (Array.isArray(input.weekdays) ? input.weekdays : [])
          .map((n) => Math.trunc(Number(n)))
          .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7)
      ),
    ].sort((a, b) => a - b);
    if (days.length === 0) throw new InputError("En az bir gün seç.");
    weekdays = days.join(",");
  }

  d.prepare(
    `UPDATE habits
     SET schedule_kind = ?, interval_days = ?, anchor_mode = ?, anchor_date = ?, weekdays = ?
     WHERE id = ?`
  ).run(kind, intervalDays, anchorMode, anchorDate, weekdays, habitId);
}













/** Geçmiş bir günü işaretle/kaldır. Elle eklenen kayda nötr saat (12:00) verilir. */
export function toggleHabitOnDate(habitId: number, date: string, on: boolean, time = "12:00"): void {
  const d = db();
  // Çöp tarih plan hesabını bozar (sıralı kayıt varsayımı çöker), bu yüzden
  // veritabanına hiç girmesin.
  if (!isValidISODate(date)) throw new InputError("Geçersiz tarih.");
  if (on) {
    d.prepare(
      `INSERT INTO logs (habit_id, date, time) VALUES (?, ?, ?)
       ON CONFLICT(habit_id, date) DO UPDATE SET time = excluded.time`
    ).run(habitId, date, time);
  } else {
    const tx = d.transaction(() => {
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

  // Planlı günler: "son yapılıştan say" modu pencere öncesindeki kayıtlara da
  // baktığı için alışkanlığın TÜM geçmişi çekilir, dueness pencerede hesaplanır.
  const plannedByHabit = new Map<number, Set<string>>();
  const allLogs = d.prepare("SELECT date FROM logs WHERE habit_id = ? ORDER BY date");
  for (const h of habits) {
    const sortedDates = (allLogs.all(h.id) as { date: string }[]).map((r) => r.date);
    const createdAnchor = habitCreatedDate(h.created_at, today);
    // Alışkanlık henüz yokken geçen günler "kaçırılmış" sayılmaz.
    const habitStart = sortedDates.length
      ? minDate(sortedDates[0], createdAnchor)
      : createdAnchor;
    const from = maxDate(start, habitStart);
    plannedByHabit.set(
      h.id,
      new Set(dueDatesInRange(h.schedule, from, today, sortedDates, createdAnchor))
    );
  }

  const daysArr: HistoryDay[] = [];
  for (let i = 0; i < days; i++) {
    const dt = addDays(today, -i); // en yeni önce
    const dayMarks = byDate.get(dt) || {};
    const marks: Record<number, string | null> = {};
    const planned: Record<number, boolean> = {};
    for (const h of habits) {
      marks[h.id] = dayMarks[h.id] ?? null;
      planned[h.id] = plannedByHabit.get(h.id)!.has(dt);
    }
    daysArr.push({ date: dt, isToday: dt === today, marks, planned });
  }

  return {
    habits: habits.map((h) => ({
      id: h.id,
      name: h.name,
      scheduleLabel: h.scheduleLabel,
    })),
    days: daysArr,
  };
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


export type NotifyInput = {
  mode: "standard" | "custom" | "periodic" | "off";
  time?: string | null;
  interval?: number | null;
};

export function setHabitNotification(habitId: number, input: NotifyInput): void {
  const d = db();
  if (!d.prepare("SELECT 1 FROM habits WHERE id = ?").get(habitId)) {
    throw new InputError("Alışkanlık bulunamadı.");
  }
  
  const mode = input.mode;
  if (!["standard", "custom", "periodic", "off"].includes(mode)) {
    throw new InputError("Geçersiz bildirim tipi.");
  }
  
  let time = input.time || null;
  if (time && !/^\d{2}:\d{2}$/.test(time)) {
    throw new InputError("Geçersiz saat formatı. Beklenen: HH:MM");
  }
  
  let interval = input.interval || null;
  if (mode === "periodic" && (typeof interval !== "number" || interval < 1)) {
    throw new InputError("Periyodik bildirim için aralık (saat) 1 veya daha büyük olmalıdır.");
  }
  
  if (mode !== "custom") time = null;
  if (mode !== "periodic") interval = null;

  d.prepare(
    `UPDATE habits SET notify_mode = ?, notify_time = ?, notify_interval = ? WHERE id = ?`
  ).run(mode, time, interval, habitId);
}
