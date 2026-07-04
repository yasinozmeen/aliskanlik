import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "aliskanlik.db");

let _db: Database.Database | null = null;

export function db(): Database.Database {
  if (_db) return _db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  migrate(_db);
  return _db;
}

function migrate(d: Database.Database) {
  d.exec(`
    -- Alışkanlıklar: kullanıcının takip ettiği listeler (Sheets 'Ayarlar' karşılığı)
    CREATE TABLE IF NOT EXISTS habits (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      active     INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Kayıtlar: bir alışkanlığın hangi gün, günün hangi saatinde yapıldığı.
    -- Gün başına en fazla bir kayıt (Sheets matrisindeki tek hücre karşılığı).
    -- time = "HH:MM" (yapılma saati); saat dağılımı istatistiği bundan hesaplanır.
    CREATE TABLE IF NOT EXISTS logs (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      habit_id INTEGER NOT NULL,
      date     TEXT NOT NULL,            -- YYYY-MM-DD
      time     TEXT NOT NULL,            -- HH:MM
      UNIQUE (habit_id, date),
      FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_logs_habit_date ON logs (habit_id, date);
    CREATE INDEX IF NOT EXISTS idx_logs_date ON logs (date);

    -- Genel görev sayacı (Sheets 'Gorevler' karşılığı): dashboard'dan kapatılan
    -- Google Tasks görevlerinin günlük adedi. Seri hesabı bundan.
    CREATE TABLE IF NOT EXISTS task_counts (
      date  TEXT PRIMARY KEY,           -- YYYY-MM-DD
      count INTEGER NOT NULL DEFAULT 0
    );

    -- Anahtar/değer durum (esnek genişleme için)
    CREATE TABLE IF NOT EXISTS state (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const c = (d.prepare("SELECT COUNT(*) AS c FROM habits").get() as { c: number }).c;
  if (c === 0) seed(d);
}

function seed(d: Database.Database) {
  // Sheets'te 2026-06-28 itibarıyla aktif olan 4 alışkanlık.
  const defaults = ["Kitap", "Chart İzleme", "Tellkin-Dua", "Kalori takibi"];
  const ins = d.prepare(
    "INSERT INTO habits (name, active, sort_order) VALUES (?, 1, ?)"
  );
  const tx = d.transaction(() => {
    defaults.forEach((name, i) => ins.run(name, i));
  });
  tx();
}
