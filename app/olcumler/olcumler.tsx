"use client";

import Link from "next/link";
import type { MeasurementHistoryEntry } from "@/lib/logic";

function fmtDate(iso: string) {
  const date = new Date(`${iso}T12:00:00`);
  return {
    weekday: date.toLocaleDateString("tr-TR", { weekday: "long" }),
    full: date.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  };
}

function fmtValue(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 3,
  }).format(value);
}

export default function Olcumler({
  initial,
}: {
  initial: MeasurementHistoryEntry[];
}) {
  return (
    <main className="min-h-[100dvh] px-4 py-6 max-w-lg mx-auto pb-16">
      <header className="rise flex items-start justify-between gap-3 mb-6">
        <div>
          <p className="label text-[0.6rem] text-[var(--color-pop-deep)] mb-1">
            kayıt defteri
          </p>
          <h1 className="font-display font-black uppercase text-3xl leading-none">
            Ölçüm geçmişi
          </h1>
        </div>
        <Link
          href="/"
          className="press brut-sm bg-[var(--color-cream)] min-h-11 px-3 grid place-items-center font-mono text-sm shrink-0"
        >
          ← geri
        </Link>
      </header>

      {initial.length === 0 ? (
        <section className="brut bg-[var(--color-cream)] p-4 rise">
          <p className="label text-[0.62rem] text-[var(--color-muted)]">henüz kayıt yok</p>
          <h2 className="font-display font-black uppercase text-2xl leading-none mt-1">
            İlk ölçümünü tamamla
          </h2>
          <p className="text-sm leading-relaxed mt-3">
            Dashboard&apos;da ölçüm alışkanlığına dokunup değerlerini kaydettiğinde burada
            görünür.
          </p>
          <Link
            href="/ayarlar"
            className="press band min-h-12 mt-4 px-4 flex items-center justify-center font-display font-black text-sm"
          >
            ölçüm ayarlarını aç
          </Link>
        </section>
      ) : (
        <>
          <div className="band px-3 py-2 mb-3 flex items-center justify-between">
            <span className="label text-[0.65rem] font-bold">tarih // değerler</span>
            <span className="font-mono text-[0.68rem] text-[var(--color-pop)]">
              {initial.length} kayıt
            </span>
          </div>
          <div className="flex flex-col gap-4">
            {initial.map((entry, index) => {
              const date = fmtDate(entry.date);
              return (
                <article
                  key={`${entry.date}-${entry.habitId}`}
                  className="brut bg-[var(--color-cream)] p-4 rise"
                  style={{ animationDelay: `${Math.min(index, 6) * 45}ms` }}
                >
                  <div className="flex items-start justify-between gap-3 pb-3 border-b-2 border-[var(--color-ink)]">
                    <div>
                      <p className="label text-[0.58rem] text-[var(--color-pop-deep)]">
                        {date.weekday}
                      </p>
                      <h2 className="font-display font-black uppercase text-xl leading-none mt-0.5">
                        {date.full}
                      </h2>
                    </div>
                    <span className="band px-2 py-1 font-mono text-[0.65rem] shrink-0">
                      {entry.time}
                    </span>
                  </div>

                  <dl className="grid grid-cols-2 gap-2 mt-3">
                    {entry.values.map((value) => (
                      <div
                        key={value.typeId}
                        className="border-2 border-[var(--color-ink)] bg-[var(--color-cream-2)] px-3 py-2.5"
                      >
                        <dt className="label text-[0.55rem] text-[var(--color-muted)] truncate">
                          {value.name}
                        </dt>
                        <dd className="font-mono font-bold text-[1.35rem] leading-none mt-1 tabular-nums">
                          {fmtValue(value.value)}
                          {value.unit ? (
                            <span className="text-[0.65rem] text-[var(--color-muted)] ml-1">
                              {value.unit}
                            </span>
                          ) : null}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </article>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
