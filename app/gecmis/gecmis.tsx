"use client";

import { useState } from "react";
import Link from "next/link";
import type { HistoryState } from "@/lib/logic";

function fmtRow(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return {
    wd: d.toLocaleDateString("tr-TR", { weekday: "short" }),
    dm: d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" }),
  };
}

export default function Gecmis({ initial }: { initial: HistoryState }) {
  const [history, setHistory] = useState<HistoryState>(initial);
  const { habits, days } = history;

  // Sütun şablonu: tarih + her alışkanlık için bir kare. Kareler esnek ama
  // 1.5rem'in altına inmez (dokunulabilirlik sınırı); sığmadıkları noktada
  // sayfa değil, tablo yatay kayar.
  const gridCols = `4.4rem repeat(${habits.length}, minmax(1.5rem, 1fr))`;
  const gridMinWidth = `${4.4 + habits.length * 1.5}rem`;

  async function toggle(date: string, habitId: number, currentlyOn: boolean) {
    // İyimser güncelleme
    setHistory((h) => ({
      ...h,
      days: h.days.map((d) =>
        d.date === date
          ? { ...d, marks: { ...d.marks, [habitId]: currentlyOn ? null : "12:00" } }
          : d
      ),
    }));
    await fetch("/api/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "toggleDate", payload: { habitId, date, on: !currentlyOn } }),
    }).catch(() => {});
  }

  return (
    <main className="min-h-[100dvh] px-4 py-6 max-w-lg mx-auto md:max-w-4xl pb-16">
      <header className="rise flex items-center justify-between mb-5 md:mb-8">
        <h1 className="font-display font-black uppercase text-3xl md:text-4xl leading-none">Geçmiş</h1>
        <Link href="/" className="press brut-sm bg-[var(--color-cream)] px-3 py-2 md:px-4 md:py-2.5 font-mono text-sm md:text-base">
          ← geri
        </Link>
      </header>

      {/* Masaüstünde (md) alışkanlık isimlerini tablonun üstüne alacağız, mobilde liste halinde vereceğiz */}
      <div className="flex flex-col gap-1 mb-4 md:hidden">
        {habits.map((h, i) => (
          <span key={h.id} className="label text-[0.6rem] text-[var(--color-muted)]">
            <span className="text-[var(--color-ink)] font-bold">
              {String(i + 1).padStart(2, "0")}
            </span>{" "}
            <span className="text-[var(--color-ink)]">{h.name}</span>
            {h.scheduleLabel !== "her gün" && <> · {h.scheduleLabel}</>}
          </span>
        ))}
      </div>

      <p className="label text-[0.6rem] md:text-[0.7rem] text-[var(--color-muted)] mb-4 md:mb-6 leading-relaxed">
        eksik kalan bir günü işaretle ya da yanlış işareti kaldır. dokun = değiştir.
        <br />
        kesikli kutu = o gün planlı değildi.
      </p>

      {/* Çok alışkanlıkta ızgara sayfayı değil kendini kaydırır. */}
      <div className="overflow-x-auto pb-4">
        <div style={{ minWidth: gridMinWidth }} className="md:min-w-full">
          {/* Başlık satırı */}
          <div className="grid items-end band px-2 py-2 md:py-3" style={{ gridTemplateColumns: gridCols }}>
            <span className="label text-[0.6rem] md:text-[0.7rem] md:pb-2">tarih</span>
            {habits.map((h, i) => (
              <div key={h.id} className="flex flex-col items-center justify-end h-full md:pb-2 group">
                <span className="label hidden md:block text-[0.55rem] lg:text-[0.65rem] text-center px-1 mb-1 leading-tight [writing-mode:vertical-lr] rotate-180 h-24 truncate w-full opacity-70 group-hover:opacity-100 transition-opacity">
                  {h.name}
                </span>
                <span className="label text-[0.6rem] md:text-[0.7rem] text-center font-bold px-0.5" title={h.name}>
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
            ))}
          </div>

          {/* Satırlar */}
          <div className="border-x-2 border-b-2 border-[var(--color-ink)]">
            {days.map((d) => {
              const { wd, dm } = fmtRow(d.date);
              return (
                <div
                  key={d.date}
                  className={`grid items-center px-2 border-t border-[var(--color-line)] hover:bg-[var(--color-cream-2)] transition-colors ${
                    d.isToday ? "bg-[var(--color-pop-pale)]" : "bg-[var(--color-cream)]"
                  }`}
                  style={{ gridTemplateColumns: gridCols }}
                >
                  <div className="py-1.5 md:py-2">
                    <div className="label text-[0.58rem] md:text-[0.65rem] text-[var(--color-muted)] leading-none">
                      {wd}
                    </div>
                    <div className="font-mono text-[0.72rem] md:text-[0.85rem] leading-tight">{dm}</div>
                  </div>
                  {habits.map((h) => {
                    const on = d.marks[h.id] != null;
                    const planned = d.planned[h.id] !== false;
                    return (
                      <div key={h.id} className="flex justify-center py-1.5 md:py-2 px-0.5 md:px-1 relative group">
                        <button
                          onClick={() => toggle(d.date, h.id, on)}
                          aria-label={`${h.name} ${dm}${planned ? "" : " (planlı değildi)"}`}
                          className={`press w-full max-w-7 md:max-w-10 aspect-square border-2 flex items-center justify-center text-sm md:text-lg font-black transition-transform hover:scale-105 ${
                            planned
                              ? "border-[var(--color-ink)]"
                              : "border-dashed border-[var(--color-muted)]"
                          } ${
                            on
                              ? "bg-[var(--color-green)] text-[var(--color-cream)]"
                              : "bg-transparent text-transparent group-hover:bg-[var(--color-line)]"
                          }`}
                        >
                          {on ? "✓" : ""}
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p className="label text-[0.55rem] md:text-[0.65rem] text-[var(--color-muted)] text-center mt-6">
        son 90 gün · dokunarak düzenle
      </p>
    </main>
  );
}
