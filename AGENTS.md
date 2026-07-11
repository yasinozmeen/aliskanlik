# Alışkanlık Takibi — Next.js + SQLite + PWA

Günlük alışkanlık takip uygulaması. **Canlı sürüm bu repodaki web sitesidir** —
Raspberry Pi'de Docker ile çalışır, telefondan PWA olarak kullanılır.

> ⚠️ **Google Sheets sürümü ARŞİVDİR, artık kullanılmıyor.**
> Eskiden uygulama Google Sheets + Apps Script makrolarıydı. 2026'da Next.js'e port edildi.
> Eski kod `legacy-sheets/` altında sadece referans olarak duruyor (kök `Kod.gs` onun kopyası).
> **Apps Script'e veya Sheets'e kod yazma, makro çalıştırma.** Bir istek geldiğinde
> değişiklik daima bu repodaki Next.js koduna yapılır.

**Sahibi:** Yasin (developer değil, ürün sahibi). Açıklamaları sade dille yap, jargonu çevir;
ama mühendislik kalitesini düşürme.

---

## Bağlantılar

| Ne | Nerede |
|----|--------|
| Canlı site | https://aliskanlik.yasinozmeen.me |
| GitHub | https://github.com/yasinozmeen/aliskanlik (public — kişisel veri repoda TUTULMAZ) |
| Sunucu | Raspberry Pi · Docker container `aliskanlik` · `127.0.0.1:3005` · Cloudflare Tunnel |
| Deploy | GitHub Actions (self-hosted runner) — `main`'e push edilince otomatik |
| Port reçetesi | `PORT-PLAYBOOK.md` (Sheets→PWA taşımanın tam adımları, altyapı notları) |
| Arşiv (eski Sheets sürümü) | `legacy-sheets/` |

---

## Ne yapıyor

Telefon için tasarlanmış tek sayfalık **brutalist** dashboard (cream zemin, kalın siyah çerçeve,
turuncu vurgu, iri tipografi):

- **Bugünkü alışkanlıklar** — tıkla-işaretle, o anki saat kaydedilir
- **Genel görevler** — Google Tasks entegrasyonu: listeyi çeker, tıklayınca Tasks'ta kapatır,
  başlık barındaki `+` ile yeni görev ekler
- **Seri + rekor**, **bu ay tamamlanma %**, **saat dağılımı** (sabah/öğle/akşam/gece)
- **Tutarlılık ısı haritası** — GitHub tarzı kareler, sabit pencere + ters sıra
- **Geçmiş düzenleme** sayfası (`/gecmis`), **Ayarlar** (`/ayarlar`)

---

## Mimari

```
app/                Next.js 15 App Router (React 19)
  dashboard.tsx     Ana ekran (client component) — alışkanlıklar, görevler, istatistik, ısı haritası
  page.tsx          Sunucuda ilk state'i çekip Dashboard'a verir
  gecmis/           Geçmiş gün düzenleme
  ayarlar/          Alışkanlık ekle/çıkar
  login/            Tek şifreli giriş
  api/state         Tüm dashboard state'i
  api/action        Alışkanlık toggle
  api/tasks         GET: açık görevler + sayaç · POST {taskId}: tamamla · POST {title}: yeni görev
  api/habits        Alışkanlık CRUD
  api/history       Geçmiş düzenleme
  globals.css       Tailwind v4 + brutalist yardımcı sınıflar (.brut-sm .press .band .label .rise .drop)

lib/db.ts           SQLite şema + migrate + seed (better-sqlite3, WAL)
lib/logic.ts        Seri / aylık % / saat dağılımı / ısı haritası / görev sayacı hesabı
lib/gtasks.ts       Google Tasks: refresh token → list / create / complete
lib/auth.ts         Tek şifre (HMAC cookie)
lib/require-auth.ts API route guard

scripts/import.mjs  Sheets geçmişini SQLite'a aktarma (bir kereye mahsus, tamamlandı)
```

**Veri modeli (SQLite):** `habits` (alışkanlıklar) · `logs` (gün + saat kaydı) ·
`task_counts` (tamamlanan görev sayacı) · `state`.

**Stil:** Tailwind v4 · Archivo (display) + Hanken Grotesk (body) + Space Mono (mono).

---

## Geliştirme

```bash
npm install
APP_PASSWORD=... AUTH_SECRET=... npm run dev
npx tsc --noEmit     # tip kontrolü
npm run build        # prod derleme (deploy öncesi doğrula)
```

### Ortam değişkenleri

| Değişken | Açıklama |
|----------|----------|
| `APP_PASSWORD` | Giriş şifresi |
| `AUTH_SECRET` | Cookie imzalama anahtarı (değişirse oturumlar düşer) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REFRESH_TOKEN` | Google Tasks (opsiyonel) |
| `GOOGLE_TASKLIST` | Tasks listesi (varsayılan `@default`) |
| `DATA_DIR` | SQLite konumu (prod: `/data`) |

Kişisel veri (SQLite, `data/`, `history.json`) repoda tutulmaz. `.gitignore`: `Kod.gs`,
`AGENTS.md`, `PORT-PLAYBOOK.md`, `legacy-sheets/` de public repoya girmez.

---

## Kritik teknik notlar

1. **Google Tasks sayacı bizim sayacımız.** Google, tamamlanan görevleri bir süre sonra siler;
   geriye dönük güvenilmez. Bu yüzden `task_counts` tablosu **siteden kapatılan** görevleri sayar.
   Telefondan/başka yerden kapatılanlar yansımaz — kullanıcı bunu biliyor.
2. **Görev ekleme sayacı artırmaz.** `POST /api/tasks` gövdesinde `title` varsa görev *oluşturulur*
   (`bumpTaskCount` çağrılmaz); `taskId` varsa *tamamlanır* (sayaç +1).
3. **Google Tasks bağlı değilse UI bozulmaz.** `gtasksConfigured()` false ise görev bölümü
   "bağlı değil" der ve `+` butonu gizlenir.
4. **Access token bellekte cache'lenir** (`lib/gtasks.ts`), refresh token'dan yenilenir.
5. **Isı haritası sabit pencere + ters sıra.** Kayan pencere değil; en yeni gün sağda.
6. **PWA:** `app/manifest.ts` + `app/sw-register.tsx` (offline). İkon `app/icon.svg` +
   `app/favicon.ico` (Momentum — yükselen çubuklar).
7. **Deploy:** `main`'e push → GitHub Actions self-hosted runner → Docker imaj → Pi'de container
   yeniden başlar. Detay: `PORT-PLAYBOOK.md` Bölüm 9–11.

---

## Durum

Sistem canlıda ve çalışıyor. Sheets sürümü emekliye ayrıldı.

**Son iş (2026-07-10):** Görev bölümüne `+` ile yeni görev ekleme (başlık barında, aşağı açılan
animasyonlu giriş, autofocus, Enter ile ekler) + `BUGÜN / BU AY / SERİ` istatistik şeridi kaldırıldı.
Sayaç arka planda çalışmaya devam ediyor (`task_counts`), sadece dashboard'da gösterilmiyor.
