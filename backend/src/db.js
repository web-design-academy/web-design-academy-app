const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const storageDir = path.join(__dirname, "../storage");

if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
  console.log(`Created storage directory at: ${storageDir}`);
}

const dbPath = path.join(storageDir, "db.sqlite");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

const initDb = () => {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      role TEXT DEFAULT 'student',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      lesson_slug TEXT NOT NULL,
      task_id TEXT NOT NULL,
      html TEXT DEFAULT '',
      css TEXT DEFAULT '',
      js TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `).run();

  console.log(`Database initialized successfully at ${dbPath}`);
};

initDb();

module.exports = db;
