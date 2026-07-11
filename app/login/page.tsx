"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [skipLogin, setSkipLogin] = useState(false);

  useEffect(() => {
    const localHost = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);
    if (process.env.NODE_ENV === "development" || localHost) {
      setSkipLogin(true);
      router.replace("/");
    }
  }, [router]);

  if (skipLogin) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(false);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (res.ok) {
      router.replace("/");
      router.refresh();
    } else {
      setError(true);
      setPassword("");
    }
  }

  return (
    <main className="min-h-[100dvh] flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm rise">
        <div className="mb-8">
          <h1 className="font-display font-black uppercase leading-[0.9] text-[clamp(2.6rem,14vw,3.4rem)] tracking-tight">
            Alışkanlık
          </h1>
          <span className="inline-block mt-1 px-3 py-1 band font-display font-black text-2xl bg-[var(--color-pop)] text-[var(--color-cream)]">
            TAKİBİ
          </span>
        </div>

        <form onSubmit={submit} className="brut p-5">
          <label className="label text-[0.7rem] text-[var(--color-muted)] block mb-2">
            Giriş şifresi
          </label>
          <input
            type="password"
            inputMode="text"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border-2 border-[var(--color-ink)] bg-[var(--color-cream-2)] px-3 py-3 text-lg font-mono outline-none focus:bg-white"
            placeholder="••••••••"
          />
          {error && (
            <p className="mt-3 label text-[0.7rem] text-[var(--color-pop-deep)]">
              ▸ Yanlış şifre
            </p>
          )}
          <button
            type="submit"
            disabled={loading || !password}
            className="press brut-sm w-full mt-4 py-3 band bg-[var(--color-ink)] text-[var(--color-cream)] font-display font-black text-lg tracking-wide disabled:opacity-50"
          >
            {loading ? "..." : "GİR"}
          </button>
        </form>
      </div>
    </main>
  );
}
