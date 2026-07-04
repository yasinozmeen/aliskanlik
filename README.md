# Alışkanlık Takibi — PWA

Günlük alışkanlık takip sistemi. **Next.js 15 + SQLite + PWA**, Raspberry Pi'de Docker ile
canlıda. Google Sheets + Apps Script tabanlı önceki sürümün (`legacy-sheets/`) portu.

## Ne yapıyor

Telefon için tasarlanmış tek sayfalık brutalist dashboard:

- **Bugünkü alışkanlıklar** — tıkla-işaretle, o anki saat kaydedilir
- **Seri + rekor** — kaç gün üst üste, en uzun seri
- **Bu ay tamamlanma %** — alışkanlık başına yatay çubuk
- **Günün hangi saatinde** — sabah/öğle/akşam/gece dağılımı
- **Tutarlılık ısı haritası** — GitHub tarzı gün-gün kareler
- **Genel görevler** — Google Tasks entegrasyonu (tıkla → Tasks'ta kapat, sayaç)

## Stack

| Katman | Teknoloji |
|--------|-----------|
| Framework | Next.js 15 (standalone çıktı), React 19 |
| Veri | better-sqlite3 (WAL) |
| Stil | Tailwind v4 · Archivo + Hanken Grotesk + Space Mono |
| Auth | Tek şifre (HMAC cookie) |
| PWA | manifest + service worker (offline) |
| Dağıtım | Docker · Cloudflare Tunnel · GitHub Actions (self-hosted runner) |

## Mimari

```
app/            Next.js App Router (dashboard, login, ayarlar, api/*)
lib/db.ts       SQLite şema + migrate + seed
lib/logic.ts    Seri / aylık % / saat dağılımı / ısı haritası hesabı
lib/gtasks.ts   Google Tasks (refresh token → list/complete)
lib/auth.ts     Tek şifreli giriş
scripts/import.mjs   Sheets geçmişini SQLite'a aktarma (bir kereye mahsus)
```

Veri modeli: `habits` (alışkanlıklar) · `logs` (gün + saat kaydı) · `task_counts` (görev sayacı) · `state`.

## Geliştirme

```bash
npm install
APP_PASSWORD=... AUTH_SECRET=... npm run dev
```

## Ortam değişkenleri

| Değişken | Açıklama |
|----------|----------|
| `APP_PASSWORD` | Giriş şifresi |
| `AUTH_SECRET` | Cookie imzalama anahtarı (değiştirilirse oturumlar düşer) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REFRESH_TOKEN` | Google Tasks (opsiyonel) |
| `DATA_DIR` | SQLite konumu (prod: `/data`) |

> Kişisel veri (SQLite, `data/`, `history.json`) repoda tutulmaz.
