"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { WEEKDAY_NAMES } from "@/lib/schedule";
import type { AnchorMode, ScheduleKind } from "@/lib/schedule";
import type { Habit } from "@/lib/logic";

const KIND_OPTIONS: { value: ScheduleKind; label: string }[] = [
  { value: "daily", label: "her gün" },
  { value: "interval", label: "n günde bir" },
  { value: "weekly", label: "haftanın günleri" },
];

// Kısaltmalar ekran okuyucuda anlaşılmıyor ("Prş"), tam ad aria-label'a gider.
const WEEKDAY_FULL = [
  "Pazartesi",
  "Salı",
  "Çarşamba",
  "Perşembe",
  "Cuma",
  "Cumartesi",
  "Pazar",
];

function ScheduleEditor({
  habit,
  busy,
  onCancel,
  onSave,
}: {
  habit: Habit;
  busy: boolean;
  onCancel: () => void;
  onSave: (schedule: Record<string, unknown>) => Promise<void>;
}) {
  const [kind, setKind] = useState<ScheduleKind>(habit.schedule.kind);
  const [intervalDays, setIntervalDays] = useState(String(habit.schedule.intervalDays));
  const [anchorMode, setAnchorMode] = useState<AnchorMode>(habit.schedule.anchorMode);
  const [anchorDate, setAnchorDate] = useState(habit.schedule.anchorDate ?? "");
  const [weekdays, setWeekdays] = useState<number[]>(habit.schedule.weekdays);

  const intervalValid = /^\d+$/.test(intervalDays) && Number(intervalDays) >= 1;
  const valid =
    kind === "daily" ||
    (kind === "interval" && intervalValid) ||
    (kind === "weekly" && weekdays.length > 0);

  function toggleDay(day: number) {
    setWeekdays((current) =>
      current.includes(day)
        ? current.filter((d) => d !== day)
        : [...current, day].sort((a, b) => a - b)
    );
  }

  return (
    <div className="border-t-2 border-[var(--color-ink)] bg-[var(--color-cream-2)] p-3">
      <p className="label text-[0.56rem] text-[var(--color-muted)] mb-2">ne sıklıkta</p>
      <div className="grid grid-cols-3 gap-1.5">
        {KIND_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={kind === option.value}
            onClick={() => setKind(option.value)}
            className={`press min-h-11 border-2 border-[var(--color-ink)] px-1 label text-[0.55rem] leading-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-pop-deep)] ${
              kind === option.value
                ? "bg-[var(--color-ink)] text-[var(--color-cream)]"
                : "bg-[var(--color-cream)]"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {kind === "interval" && (
        <div className="mt-3">
          <label className="flex items-center gap-2">
            <input
              value={intervalDays}
              onChange={(event) => setIntervalDays(event.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              aria-label="Kaç günde bir"
              className="w-16 min-h-11 border-2 border-[var(--color-ink)] bg-[var(--color-cream)] px-2 text-center font-mono text-lg font-bold outline-none focus:bg-white"
            />
            <span className="label text-[0.6rem]">günde bir</span>
          </label>

          <p className="label text-[0.56rem] text-[var(--color-muted)] mt-3 mb-1.5">
            sıra nasıl sayılsın
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {/* Seçili kartta yazı SİYAH kalır: krem-üstü-turuncu 2,98:1 ile
                okunmuyordu, siyah-üstü-turuncu 5,89:1 ile AA'yı geçiyor. */}
            <button
              type="button"
              aria-pressed={anchorMode === "last"}
              onClick={() => setAnchorMode("last")}
              className={`press min-h-14 border-2 border-[var(--color-ink)] px-2 py-1.5 text-left text-[var(--color-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-pop-deep)] ${
                anchorMode === "last" ? "bg-[var(--color-pop)]" : "bg-[var(--color-cream)]"
              }`}
            >
              <span className="label block text-[0.58rem] leading-tight">
                son yapılıştan
              </span>
              <span className="label block text-[0.54rem] leading-tight mt-1">
                kaçırınca sıra kayar
              </span>
            </button>
            <button
              type="button"
              aria-pressed={anchorMode === "fixed"}
              onClick={() => setAnchorMode("fixed")}
              className={`press min-h-14 border-2 border-[var(--color-ink)] px-2 py-1.5 text-left text-[var(--color-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-pop-deep)] ${
                anchorMode === "fixed" ? "bg-[var(--color-pop)]" : "bg-[var(--color-cream)]"
              }`}
            >
              <span className="label block text-[0.58rem] leading-tight">sabit takvim</span>
              <span className="label block text-[0.54rem] leading-tight mt-1">
                sıra hiç kaymaz
              </span>
            </button>
          </div>

          {anchorMode === "fixed" && (
            <label className="mt-2.5 block">
              <span className="label block text-[0.56rem] text-[var(--color-muted)] mb-1">
                başlangıç günü (boşsa bugün)
              </span>
              <input
                type="date"
                value={anchorDate}
                onChange={(event) => setAnchorDate(event.target.value)}
                className="w-full min-h-11 border-2 border-[var(--color-ink)] bg-[var(--color-cream)] px-2 font-mono text-sm outline-none focus:bg-white"
              />
            </label>
          )}
        </div>
      )}

      {kind === "weekly" && (
        <div className="mt-3">
          <p className="label text-[0.56rem] text-[var(--color-muted)] mb-1.5">hangi günler</p>
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAY_NAMES.map((name, index) => {
              const day = index + 1;
              const on = weekdays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={on}
                  aria-label={WEEKDAY_FULL[index]}
                  onClick={() => toggleDay(day)}
                  className={`press min-h-11 border-2 border-[var(--color-ink)] label text-[0.56rem] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-pop-deep)] ${
                    on
                      ? "bg-[var(--color-green)] text-[var(--color-cream)]"
                      : "bg-[var(--color-cream)]"
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <p className="label text-[0.52rem] text-[var(--color-muted)] leading-relaxed mt-3">
        not: plan değişince seri ve aylık yüzde yeni plana göre baştan hesaplanır.
        kayıtlar silinmez.
      </p>

      <div className="grid grid-cols-2 gap-2 mt-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="press min-h-11 border-2 border-[var(--color-ink)] bg-[var(--color-cream)] label text-[0.6rem] disabled:opacity-40"
        >
          vazgeç
        </button>
        <button
          type="button"
          disabled={busy || !valid}
          onClick={() =>
            onSave({
              kind,
              intervalDays: Number(intervalDays) || 1,
              anchorMode,
              anchorDate: anchorDate || null,
              weekdays,
            })
          }
          className="press min-h-11 border-2 border-[var(--color-ink)] bg-[var(--color-pop)] label text-[0.6rem] font-bold disabled:opacity-40"
        >
          {busy ? "…" : "planı kaydet"}
        </button>
      </div>
    </div>
  );
}

export default function Ayarlar({
  initial,
}: {
  initial: Habit[];
}) {
  const [habits, setHabits] = useState<Habit[]>(initial);
  const [yeni, setYeni] = useState("");
  const [busy, setBusy] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState<number | null>(null);
  const [habitError, setHabitError] = useState("");
  const planButtonRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  // Panel kapanınca odak kaybolmasın; klavye kullanıcısı sayfanın başına savrulur.
  function closeSchedule(habitId: number) {
    setScheduleOpen(null);
    requestAnimationFrame(() => planButtonRefs.current[habitId]?.focus());
  }

  async function refresh() {
    const r = await fetch("/api/habits");
    const j = await r.json();
    if (j.ok) setHabits(j.habits);
  }

  async function act(type: string, payload: Record<string, unknown>) {
    setBusy(true);
    setHabitError("");
    try {
      const response = await fetch("/api/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, payload }),
      });
      const json = await response.json();
      if (!json.ok) {
        setHabitError(json.error || "İşlem tamamlanamadı.");
        return false;
      }
      await refresh();
      return true;
    } catch {
      setHabitError("Bağlantı kurulamadı. Tekrar dene.");
      return false;
    } finally {
      setBusy(false);
    }
  }


  async function ekle(e: React.FormEvent) {
    e.preventDefault();
    if (!yeni.trim()) return;
    await act("addHabit", { name: yeni });
    setYeni("");
  }

  async function sil(id: number, name: string) {
    if (!confirm(`"${name}" alışkanlığını ve tüm kayıtlarını sil?`)) return;
    await act("delete", { habitId: id });
  }



  return (
    <main className="min-h-[100dvh] px-4 py-6 max-w-lg mx-auto md:max-w-4xl pb-16">
      <header className="rise flex items-center justify-between mb-6 md:mb-8">
        <h1 className="font-display font-black uppercase text-3xl md:text-4xl leading-none">Ayarlar</h1>
        <Link
          href="/"
          className="press brut-sm bg-[var(--color-cream)] px-3 py-2 md:px-4 md:py-2.5 font-mono text-sm md:text-base"
        >
          ← geri
        </Link>
      </header>

      <p className="label text-[0.62rem] md:text-[0.7rem] text-[var(--color-muted)] mb-4 md:mb-6 leading-relaxed md:max-w-xl">
        alışkanlık ekle, adını değiştir veya pasif yap. pasif alışkanlıklar
        dashboard&apos;da görünmez ama kayıtları saklanır.
      </p>

      {/* Yeni ekle */}
      <form onSubmit={ekle} className="brut-sm bg-[var(--color-cream)] p-3 mb-5 flex gap-2">
        <input
          value={yeni}
          onChange={(e) => setYeni(e.target.value)}
          placeholder="Yeni alışkanlık…"
          className="flex-1 border-2 border-[var(--color-ink)] bg-[var(--color-cream-2)] px-3 py-2 text-base outline-none focus:bg-white"
        />
        <button
          type="submit"
          disabled={busy || !yeni.trim()}
          className="press band bg-[var(--color-pop)] text-[var(--color-cream)] px-4 font-display font-black text-lg disabled:opacity-50"
        >
          +
        </button>
      </form>

      {habitError && (
        <p
          role="alert"
          className="brut-sm bg-[var(--color-pop-pale)] px-3 py-2.5 mb-3 text-sm font-semibold"
        >
          {habitError}
        </p>
      )}

      {/* Liste */}
      <div className="flex flex-col md:grid md:grid-cols-2 lg:grid-cols-3 gap-2.5 md:gap-4">
        {habits.map((h) => (
          <div
            key={h.id}
            className={`brut-sm ${
              h.active ? "bg-[var(--color-cream)]" : "bg-[var(--color-cream-2)] opacity-70"
            }`}
          >
            <div className="p-3 flex items-center gap-3">
              <button
                onClick={() => act("setActive", { habitId: h.id, active: !h.active })}
                disabled={busy}
                className={`press w-7 h-7 border-2 border-[var(--color-ink)] shrink-0 flex items-center justify-center font-black ${
                  h.active ? "bg-[var(--color-green)] text-[var(--color-cream)]" : "bg-transparent"
                }`}
                aria-label={h.active ? "pasif yap" : "aktif yap"}
              >
                {h.active ? "✓" : ""}
              </button>

              <input
                defaultValue={h.name}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== h.name) act("rename", { habitId: h.id, name: v });
                }}
                className="flex-1 min-w-0 bg-transparent font-display font-bold text-lg outline-none border-b-2 border-transparent focus:border-[var(--color-ink)]"
              />

              <button
                onClick={() => sil(h.id, h.name)}
                disabled={busy}
                className="press label text-[0.62rem] text-[var(--color-pop-deep)] px-2 py-1 border-2 border-[var(--color-pop-deep)] shrink-0"
              >
                sil
              </button>
            </div>

            <button
              type="button"
              ref={(node) => {
                planButtonRefs.current[h.id] = node;
              }}
              onClick={() => setScheduleOpen((current) => (current === h.id ? null : h.id))}
              aria-expanded={scheduleOpen === h.id}
              aria-label={`${h.name} planı: ${h.scheduleLabel}. Değiştirmek için aç.`}
              className="press flex w-full min-h-11 items-center justify-between border-t-2 border-dashed border-[var(--color-line)] px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-[var(--color-pop-deep)]"
            >
              <span className="label text-[0.56rem] text-[var(--color-muted)]">plan</span>
              <span className="label flex items-center gap-1.5 text-[0.6rem] font-bold">
                {h.scheduleLabel}
                <span className="font-mono text-[var(--color-pop-deep)]">
                  {scheduleOpen === h.id ? "▴" : "▾"}
                </span>
              </span>
            </button>

            {scheduleOpen === h.id && (
              <ScheduleEditor
                habit={h}
                busy={busy}
                onCancel={() => closeSchedule(h.id)}
                onSave={async (schedule) => {
                  const saved = await act("setSchedule", { habitId: h.id, schedule });
                  if (saved) closeSchedule(h.id);
                }}
              />
            )}
          </div>
        ))}
      </div>


    </main>
  );
}
