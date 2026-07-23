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
  _db.pragma("foreign_keys = ON");
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

    -- Ölçüm alanları: kullanıcının Ayarlar'dan belirlediği kilo, bel, boyun vb.
    -- active=0 olan alan yeni kayıtlarda sorulmaz; eski ölçüm geçmişi korunur.
    CREATE TABLE IF NOT EXISTS measurement_types (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      unit       TEXT NOT NULL DEFAULT '',
      active     INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Bir ölçüm alışkanlığı tamamlanırken girilen sayısal değerler.
    CREATE TABLE IF NOT EXISTS measurement_values (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      habit_id            INTEGER NOT NULL,
      measurement_type_id INTEGER NOT NULL,
      date                TEXT NOT NULL,
      value               REAL NOT NULL,
      created_at          TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (habit_id, measurement_type_id, date),
      FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE,
      FOREIGN KEY (measurement_type_id) REFERENCES measurement_types(id)
    );
    CREATE INDEX IF NOT EXISTS idx_measurement_values_habit_date
      ON measurement_values (habit_id, date);
  `);

  const habitColumns = d.pragma("table_info(habits)") as { name: string }[];
  if (!habitColumns.some((column) => column.name === "measurement_required")) {
    d.exec(
      "ALTER TABLE habits ADD COLUMN measurement_required INTEGER NOT NULL DEFAULT 0"
    );
  }

  const c = (d.prepare("SELECT COUNT(*) AS c FROM habits").get() as { c: number }).c;
  if (c === 0) seed(d);

  seedMeasurementTypes(d);
  autoDetectMeasurementHabit(d);
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

function seedMeasurementTypes(d: Database.Database) {
  const count = (
    d.prepare("SELECT COUNT(*) AS c FROM measurement_types").get() as { c: number }
  ).c;
  if (count > 0) return;

  const insert = d.prepare(
    "INSERT INTO measurement_types (name, unit, active, sort_order) VALUES (?, ?, 1, ?)"
  );
  const defaults = [
    ["Kilo", "kg"],
    ["Bel", "cm"],
    ["Boyun", "cm"],
  ] as const;
  const tx = d.transaction(() => {
    defaults.forEach(([name, unit], index) => insert.run(name, unit, index));
  });
  tx();
}

function autoDetectMeasurementHabit(d: Database.Database) {
  const migrationKey = "measurement_habit_autodetected_v1";
  const alreadyRan = d.prepare("SELECT 1 FROM state WHERE key = ?").get(migrationKey);
  if (alreadyRan) return;

  const habits = d.prepare("SELECT id, name FROM habits").all() as {
    id: number;
    name: string;
  }[];
  const match = habits.find(
    (habit) =>
      habit.name
        .toLocaleLowerCase("tr-TR")
        .replace(/[^a-zçğıöşü]/g, "") === "ölçüm"
  );
  if (match) {
    d.prepare("UPDATE habits SET measurement_required = 1 WHERE id = ?").run(match.id);
  }
  d.prepare("INSERT INTO state (key, value) VALUES (?, '1')").run(migrationKey);
}
