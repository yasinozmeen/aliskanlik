"use client";

import { useState } from "react";
import Link from "next/link";
import type { Habit } from "@/lib/logic";

export default function Ayarlar({ initial }: { initial: Habit[] }) {
  const [habits, setHabits] = useState<Habit[]>(initial);
  const [yeni, setYeni] = useState("");
  const [busy, setBusy] = useState(false);

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
    </main>
  );
}
