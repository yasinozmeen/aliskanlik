"use client";

import { useState } from "react";
import Link from "next/link";
import type { Habit, MeasurementSettings, MeasurementType } from "@/lib/logic";

function MeasurementTypeEditor({
  type,
  busy,
  onSave,
  onArchive,
}: {
  type: MeasurementType;
  busy: boolean;
  onSave: (id: number, name: string, unit: string) => Promise<void>;
  onArchive: (id: number, name: string) => Promise<void>;
}) {
  const [name, setName] = useState(type.name);
  const [unit, setUnit] = useState(type.unit);
  const changed = name.trim() !== type.name || unit.trim() !== type.unit;

  return (
    <div className="brut-sm bg-[var(--color-cream)] p-3">
      <div className="grid grid-cols-[1fr_5.5rem] gap-2">
        <label>
          <span className="label block text-[0.56rem] text-[var(--color-muted)] mb-1">
            ölçü adı
          </span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full min-h-11 border-2 border-[var(--color-ink)] bg-[var(--color-cream-2)] px-3 text-base outline-none focus:bg-white"
          />
        </label>
        <label>
          <span className="label block text-[0.56rem] text-[var(--color-muted)] mb-1">
            birim
          </span>
          <input
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
            placeholder="cm"
            className="w-full min-h-11 border-2 border-[var(--color-ink)] bg-[var(--color-cream-2)] px-3 text-base outline-none focus:bg-white"
          />
        </label>
      </div>
      <div className="flex justify-end gap-2 mt-2">
        <button
          type="button"
          onClick={() => onArchive(type.id, type.name)}
          disabled={busy}
          className="press min-h-11 label text-[0.58rem] text-[var(--color-pop-deep)] px-3 border-2 border-[var(--color-pop-deep)] disabled:opacity-50"
        >
          kaldır
        </button>
        <button
          type="button"
          onClick={() => onSave(type.id, name, unit)}
          disabled={busy || !changed || !name.trim()}
          className="press min-h-11 label text-[0.58rem] bg-[var(--color-ink)] text-[var(--color-cream)] px-4 disabled:opacity-35"
        >
          kaydet
        </button>
      </div>
    </div>
  );
}

export default function Ayarlar({
  initial,
  initialMeasurements,
}: {
  initial: Habit[];
  initialMeasurements: MeasurementSettings;
}) {
  const [habits, setHabits] = useState<Habit[]>(initial);
  const [measurements, setMeasurements] =
    useState<MeasurementSettings>(initialMeasurements);
  const [yeni, setYeni] = useState("");
  const [newMeasureName, setNewMeasureName] = useState("");
  const [newMeasureUnit, setNewMeasureUnit] = useState("");
  const [busy, setBusy] = useState(false);
  const [measurementError, setMeasurementError] = useState("");

  async function refresh() {
    const r = await fetch("/api/habits");
    const j = await r.json();
    if (j.ok) setHabits(j.habits);
  }

  async function act(type: string, payload: Record<string, unknown>) {
    setBusy(true);
    try {
      await fetch("/api/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, payload }),
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function measurementAct(action: string, payload: Record<string, unknown>) {
    setBusy(true);
    setMeasurementError("");
    try {
      const response = await fetch("/api/measurements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, payload }),
      });
      const json = await response.json();
      if (!json.ok) {
        setMeasurementError(json.error || "Ölçüm ayarı kaydedilemedi.");
        return false;
      }
      setHabits(json.habits);
      setMeasurements(json.settings);
      return true;
    } catch {
      setMeasurementError("Bağlantı kurulamadı. Tekrar dene.");
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

  async function addMeasurement(e: React.FormEvent) {
    e.preventDefault();
    if (!newMeasureName.trim()) return;
    const saved = await measurementAct("addType", {
      name: newMeasureName,
      unit: newMeasureUnit,
    });
    if (saved) {
      setNewMeasureName("");
      setNewMeasureUnit("");
    }
  }

  async function archiveMeasurement(id: number, name: string) {
    if (!confirm(`"${name}" artık veri girişinde sorulmasın mı? Geçmiş kayıtları korunur.`)) {
      return;
    }
    await measurementAct("archiveType", { id });
  }

  return (
    <main className="min-h-[100dvh] px-4 py-6 max-w-lg mx-auto pb-16">
      <header className="rise flex items-center justify-between mb-6">
        <h1 className="font-display font-black uppercase text-3xl leading-none">Ayarlar</h1>
        <Link
          href="/"
          className="press brut-sm bg-[var(--color-cream)] px-3 py-2 font-mono text-sm"
        >
          ← geri
        </Link>
      </header>

      <p className="label text-[0.62rem] text-[var(--color-muted)] mb-4 leading-relaxed">
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

      {/* Liste */}
      <div className="flex flex-col gap-2.5">
        {habits.map((h) => (
          <div
            key={h.id}
            className={`brut-sm p-3 flex items-center gap-3 ${
              h.active ? "bg-[var(--color-cream)]" : "bg-[var(--color-cream-2)] opacity-70"
            }`}
          >
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
              className="flex-1 bg-transparent font-display font-bold text-lg outline-none border-b-2 border-transparent focus:border-[var(--color-ink)]"
            />

            <button
              onClick={() => sil(h.id, h.name)}
              disabled={busy}
              className="press label text-[0.62rem] text-[var(--color-pop-deep)] px-2 py-1 border-2 border-[var(--color-pop-deep)] shrink-0"
            >
              sil
            </button>
          </div>
        ))}
      </div>

      <section className="mt-10">
        <div className="band px-3 py-2 mb-3 label text-[0.68rem] font-bold">
          ölçüm ayarları // alanlar
        </div>
        <p className="label text-[0.6rem] text-[var(--color-muted)] mb-4 leading-relaxed">
          seçtiğin alışkanlık tamamlanırken aşağıdaki değerler sorulur. kaldırılan alanların
          eski kayıtları geçmişte kalır.
        </p>

        <label className="block mb-5">
          <span className="label block text-[0.58rem] text-[var(--color-muted)] mb-1.5">
            ölçüm isteyen alışkanlık
          </span>
          <select
            value={measurements.habitId ?? ""}
            onChange={(event) =>
              measurementAct("setHabit", {
                habitId: event.target.value ? Number(event.target.value) : null,
              })
            }
            disabled={busy}
            className="w-full min-h-12 brut-sm bg-[var(--color-cream)] px-3 text-base outline-none disabled:opacity-50"
          >
            <option value="">Seçilmedi</option>
            {habits.map((habit) => (
              <option key={habit.id} value={habit.id}>
                {habit.name}
              </option>
            ))}
          </select>
        </label>

        <form
          onSubmit={addMeasurement}
          className="brut-sm bg-[var(--color-pop-pale)] p-3 mb-4"
        >
          <p className="font-display font-black uppercase text-lg leading-none mb-3">
            Yeni ölçü ekle
          </p>
          <div className="grid grid-cols-[1fr_5.5rem] gap-2">
            <label>
              <span className="label block text-[0.56rem] text-[var(--color-muted)] mb-1">
                ölçü adı
              </span>
              <input
                value={newMeasureName}
                onChange={(event) => setNewMeasureName(event.target.value)}
                placeholder="Örn. Kalça"
                className="w-full min-h-11 border-2 border-[var(--color-ink)] bg-[var(--color-cream)] px-3 text-base outline-none focus:bg-white"
              />
            </label>
            <label>
              <span className="label block text-[0.56rem] text-[var(--color-muted)] mb-1">
                birim
              </span>
              <input
                value={newMeasureUnit}
                onChange={(event) => setNewMeasureUnit(event.target.value)}
                placeholder="cm"
                className="w-full min-h-11 border-2 border-[var(--color-ink)] bg-[var(--color-cream)] px-3 text-base outline-none focus:bg-white"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={busy || !newMeasureName.trim()}
            className="press mt-3 min-h-11 w-full band px-4 font-display font-black text-sm disabled:opacity-50"
          >
            ölçü alanını ekle
          </button>
        </form>

        {measurementError && (
          <p
            role="alert"
            className="brut-sm bg-[var(--color-pop-pale)] px-3 py-2.5 mb-3 text-sm font-semibold"
          >
            {measurementError}
          </p>
        )}

        <div className="flex flex-col gap-2.5">
          {measurements.types.length === 0 ? (
            <p className="brut-sm bg-[var(--color-cream)] p-3 text-sm">
              Henüz ölçü alanı yok. Yukarıdan ilk alanı ekle.
            </p>
          ) : (
            measurements.types.map((type) => (
              <MeasurementTypeEditor
                key={type.id}
                type={type}
                busy={busy}
                onSave={(id, name, unit) =>
                  measurementAct("updateType", { id, name, unit }).then(() => undefined)
                }
                onArchive={archiveMeasurement}
              />
            ))
          )}
        </div>

        <Link
          href="/olcumler"
          className="press brut-sm bg-[var(--color-ink)] text-[var(--color-cream)] flex items-center justify-between px-4 py-3 mt-5"
        >
          <span className="font-display font-extrabold uppercase text-sm">
            Ölçüm geçmişini gör
          </span>
          <span className="font-mono text-[var(--color-pop)]">→</span>
        </Link>
      </section>
    </main>
  );
}
