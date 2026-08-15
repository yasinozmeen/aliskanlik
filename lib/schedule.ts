/* ————————————————————————————————————————————————————————————————
   Periyodik plan — saf hesap katmanı.
   Veritabanına DOKUNMAZ; bu yüzden istemci bileşenleri de import edebilir.
   ———————————————————————————————————————————————————————————————— */

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

export function dayOfMonth(iso: string): number {
  return Number(iso.split("-")[2]);
}

export function utcMs(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** b - a, gün cinsinden (negatif olabilir). */
export function daysBetween(a: string, b: string): number {
  return Math.round((utcMs(b) - utcMs(a)) / 86400000);
}

/** 1 = Pazartesi … 7 = Pazar */
export function isoWeekday(iso: string): number {
  return ((new Date(utcMs(iso)).getUTCDay() + 6) % 7) + 1;
}

/**
 * Gerçekten var olan bir takvim günü mü? Yalnız şekil kontrolü YETMEZ:
 * "2026-99-99" desene uyar ama Date.UTC onu 2034'e taşır ve alışkanlık
 * sessizce kaybolur.
 */
export function isValidISODate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
  );
}

/** İki tarihten erken olanı. */
export function minDate(a: string, b: string): string {
  return a < b ? a : b;
}

/** İki tarihten geç olanı. */
export function maxDate(a: string, b: string): string {
  return a > b ? a : b;
}

/* ————————————————————————— Periyodik plan ————————————————————————— */

export const WEEKDAY_NAMES = ["Pzt", "Sal", "Çar", "Prş", "Cum", "Cmt", "Paz"] as const;

/** Seri/rekor için geriye taranan en uzun pencere (gün). */
export const SCAN_DAYS = 1500;

export type ScheduleKind = "daily" | "interval" | "weekly";
export type AnchorMode = "last" | "fixed";

export type Schedule = {
  kind: ScheduleKind;
  /** 'interval' için: kaç günde bir. */
  intervalDays: number;
  /** 'last' = son yapılıştan say · 'fixed' = anchorDate'ten sabit takvim. */
  anchorMode: AnchorMode;
  anchorDate: string | null;
  /** 'weekly' için 1..7 (Pzt=1), artan sırada. */
  weekdays: number[];
};

export type ScheduleRow = {
  schedule_kind: string | null;
  interval_days: number | null;
  anchor_mode: string | null;
  anchor_date: string | null;
  weekdays: string | null;
};

export function parseSchedule(row: ScheduleRow): Schedule {
  const kind: ScheduleKind =
    row.schedule_kind === "interval" || row.schedule_kind === "weekly"
      ? row.schedule_kind
      : "daily";

  const weekdays = [
    ...new Set(
      String(row.weekdays ?? "")
        .split(",")
        .map((part) => Number(part.trim()))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7)
    ),
  ].sort((a, b) => a - b);

  return {
    kind,
    intervalDays: Math.max(1, Math.min(365, Math.trunc(Number(row.interval_days) || 1))),
    anchorMode: row.anchor_mode === "fixed" ? "fixed" : "last",
    anchorDate: row.anchor_date || null,
    // Haftalık planda hiç gün seçilmemişse alışkanlık asla çıkmasın diye değil,
    // kullanılabilir kalsın diye Pazartesi'ye düşürülür.
    weekdays: kind === "weekly" && weekdays.length === 0 ? [1] : weekdays,
  };
}

export function scheduleLabel(s: Schedule): string {
  if (s.kind === "daily") return "her gün";
  if (s.kind === "weekly") {
    if (s.weekdays.length === 7) return "her gün";
    return s.weekdays.map((d) => WEEKDAY_NAMES[d - 1]).join(" · ");
  }
  if (s.intervalDays === 1) return "her gün";
  // Sayma modu (son yapılıştan / sabit takvim) yalnız Ayarlar'da görünür;
  // dashboard etiketi kısa kalsın.
  return `${s.intervalDays} günde bir`;
}

/** Plan tipi geçmiş kaydına bakmadan hesaplanabiliyor mu? */
export function isCalendarSchedule(s: Schedule): boolean {
  return s.kind !== "interval" || s.anchorMode === "fixed";
}

/**
 * `date` günü bu planda sırası gelmiş mi?
 * `lastDoneBefore` yalnız "son yapılıştan say" modunda kullanılır ve o günden
 * KESİNLİKLE ÖNCEKİ en son tamamlanma günü olmalıdır.
 */
export function isDueOn(
  s: Schedule,
  date: string,
  lastDoneBefore: string | null,
  createdAnchor: string
): boolean {
  if (s.kind === "daily") return true;
  if (s.kind === "weekly") return s.weekdays.includes(isoWeekday(date));

  if (s.anchorMode === "fixed") {
    const anchor = s.anchorDate || createdAnchor;
    const diff = daysBetween(anchor, date);
    return diff >= 0 && diff % s.intervalDays === 0;
  }

  // 'last': hiç yapılmadıysa hemen sırası gelmiştir; sonra son yapılıştan +N gün.
  // Geciktirilirse sıra kaymaz — yapılana kadar "sırası geldi" olarak kalır.
  if (!lastDoneBefore) return true;
  return daysBetween(lastDoneBefore, date) >= s.intervalDays;
}

/**
 * [from, to] aralığında sırası gelen günler, artan sırada.
 * Her plan tipinde doğru çalışır: "son yapılıştan say" modunda o güne kadarki
 * kayıtlar imleçle takip edilir, takvim tabanlı planlarda kayıtlar yok sayılır.
 * `sortedLogDates` artan sıralı olmalıdır.
 */
export function dueDatesInRange(
  s: Schedule,
  from: string,
  to: string,
  sortedLogDates: string[],
  createdAnchor: string
): string[] {
  const out: string[] = [];
  if (daysBetween(from, to) < 0) return out;

  let index = 0;
  let lastDoneBefore: string | null = null;
  while (index < sortedLogDates.length && sortedLogDates[index] < from) {
    lastDoneBefore = sortedLogDates[index];
    index++;
  }

  for (let d = from; daysBetween(d, to) >= 0; d = addDays(d, 1)) {
    if (isDueOn(s, d, lastDoneBefore, createdAnchor)) out.push(d);
    // d günündeki kayıt, ancak d+1'den itibaren "önceki yapılış" sayılır.
    while (index < sortedLogDates.length && sortedLogDates[index] <= d) {
      lastDoneBefore = sortedLogDates[index];
      index++;
    }
  }
  return out;
}

/** Takvim tabanlı plan: ardışık "sırası gelen gün"lerin kaçı üst üste yapıldı. */
export function occurrenceStreaks(
  occurrences: string[],
  done: Set<string>,
  today: string
): { streak: number; record: number } {
  let record = 0;
  let run = 0;
  for (const d of occurrences) {
    if (done.has(d)) {
      run++;
      if (run > record) record = run;
    } else {
      run = 0;
    }
  }

  // Bugünün sırası geldi ama henüz yapılmadıysa seriyi kırmaz (gün bitmedi).
  let i = occurrences.length - 1;
  if (i >= 0 && occurrences[i] === today && !done.has(today)) i--;

  let streak = 0;
  while (i >= 0 && done.has(occurrences[i])) {
    streak++;
    i--;
  }
  return { streak, record };
}

/**
 * "Son yapılıştan say" modunda kayıtları TURLARA indirger: bir turu kapattıktan
 * sonra `interval` gün boyunca yapılan ek işaretlemeler aynı tura sayılır.
 * Böylece 7 günde bir planlı bir şeyi 10 gün üst üste yapmak "seri 10" değil,
 * gerçekte olduğu gibi 2 tur olur.
 */
export function collapseCycles(sortedDates: string[], interval: number): string[] {
  const out: string[] = [];
  let cycleEnd: string | null = null;
  for (const d of sortedDates) {
    if (cycleEnd === null || d >= cycleEnd) {
      out.push(d);
      cycleEnd = addDays(d, interval);
    }
  }
  return out;
}

/** [from, to] aralığında başlayan tamamlanmış tur sayısı. */
export function countCycles(
  sortedDates: string[],
  interval: number,
  from: string,
  to: string
): number {
  return collapseCycles(sortedDates, interval).filter((d) => d >= from && d <= to).length;
}

/**
 * "Son yapılıştan say" modu: seri, aralarındaki boşluk `interval` günü aşmayan
 * ardışık TURLARDAN oluşur. Boşluk aşılmışsa bir tur kaçırılmış demektir.
 */
export function gapStreaks(
  sortedLogDates: string[],
  today: string,
  interval: number
): { streak: number; record: number } {
  const cycles = collapseCycles(sortedLogDates, interval);
  if (cycles.length === 0) return { streak: 0, record: 0 };

  let record = 1;
  let run = 1;
  for (let i = 1; i < cycles.length; i++) {
    if (daysBetween(cycles[i - 1], cycles[i]) <= interval) {
      run++;
      if (run > record) record = run;
    } else {
      run = 1;
    }
  }

  const last = cycles[cycles.length - 1];
  // Süre penceresi aşıldıysa (gecikme bir turu geçtiyse) güncel seri kırılmıştır.
  if (daysBetween(last, today) > interval) return { streak: 0, record };

  let streak = 1;
  for (let i = cycles.length - 1; i > 0; i--) {
    if (daysBetween(cycles[i - 1], cycles[i]) <= interval) streak++;
    else break;
  }
  return { streak, record };
}

/** Bugünden sonraki ilk "sırası gelen" gün (yoksa null). */
export function nextDueDate(
  s: Schedule,
  today: string,
  lastDone: string | null,
  createdAnchor: string
): string | null {
  for (let i = 1; i <= 400; i++) {
    const d = addDays(today, i);
    if (isDueOn(s, d, lastDone, createdAnchor)) return d;
  }
  return null;
}

