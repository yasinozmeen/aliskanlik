/**
 * Sheets geçmişini SQLite'a aktarır (bir kereye mahsus, idempotent).
 * Kaynak: data/history.json  { habits:[...], logs:[{date,habit,frac}], taskCounts:[{date,count}] }
 *   - frac (0-1 gün kesri, Sheets formatı) → "HH:MM"
 *   - Kayıt zaten varsa ATLAR (tekrar çalıştırmak güvenli).
 * Çalıştırma: DATA_DIR=/home/yasin/aliskanlik-data npm run db:import
 */
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(path.join(DATA_DIR, "aliskanlik.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS habits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    habit_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    UNIQUE (habit_id, date),
    FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_logs_habit_date ON logs (habit_id, date);
  CREATE INDEX IF NOT EXISTS idx_logs_date ON logs (date);
  CREATE TABLE IF NOT EXISTS task_counts (
    date TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`);

const HISTORY = process.env.HISTORY_JSON || path.join(DATA_DIR, "history.json");
if (!fs.existsSync(HISTORY)) {
  console.error("history.json bulunamadı:", HISTORY);
  process.exit(1);
}
const raw = JSON.parse(fs.readFileSync(HISTORY, "utf8"));

function fracToHM(frac) {
  let mins = Math.round(Number(frac) * 1440);
  mins = Math.max(0, Math.min(1439, mins));
  const hh = String(Math.floor(mins / 60)).padStart(2, "0");
  const mm = String(mins % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

const tx = db.transaction(() => {
  // 1) Alışkanlıkları isimle eşle; yoksa ekle. id haritası çıkar.
  const idByName = new Map();
  for (const row of db.prepare("SELECT id, name FROM habits").all()) {
    idByName.set(row.name, row.id);
  }
  const habitNames = raw.habits || [];
  habitNames.forEach((name, i) => {
    if (!idByName.has(name)) {
      const info = db
        .prepare("INSERT INTO habits (name, active, sort_order) VALUES (?, 1, ?)")
        .run(name, i);
      idByName.set(name, info.lastInsertRowid);
    }
  });

  // 2) Loglar (idempotent — çakışmada atla)
  const insLog = db.prepare(
    "INSERT OR IGNORE INTO logs (habit_id, date, time) VALUES (?, ?, ?)"
  );
  let logN = 0;
  for (const l of raw.logs || []) {
    const hid = idByName.get(l.habit);
    if (!hid) continue;
    const info = insLog.run(hid, l.date, fracToHM(l.frac));
    logN += info.changes;
  }

  // 3) Görev sayacı (idempotent)
  const insTc = db.prepare("INSERT OR IGNORE INTO task_counts (date, count) VALUES (?, ?)");
  let tcN = 0;
  for (const t of raw.taskCounts || []) {
    const info = insTc.run(t.date, Number(t.count) || 0);
    tcN += info.changes;
  }

  console.log(`İçe aktarıldı: ${logN} log, ${tcN} görev-sayaç günü.`);
});

tx();
db.close();
