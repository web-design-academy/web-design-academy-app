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
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      role TEXT DEFAULT 'student',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,
  ).run();

  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      lesson_slug TEXT NOT NULL,
      task_id TEXT NOT NULL,
      html TEXT DEFAULT '',
      css TEXT DEFAULT '',
      js TEXT DEFAULT '',
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `,
  ).run();

  const submissionColumns = new Set(
    db
      .prepare("PRAGMA table_info(submissions)")
      .all()
      .map((column) => column.name),
  );
  const evaluationColumns = [
    ["evaluation_status", "TEXT"],
    ["evaluation_score", "INTEGER"],
    ["evaluation_passed", "INTEGER"],
    ["evaluation_issues", "TEXT"],
    ["evaluation_version", "INTEGER"],
    ["evaluation_config_hash", "TEXT"],
  ];

  evaluationColumns.forEach(([name, type]) => {
    if (!submissionColumns.has(name)) {
      db.prepare(`ALTER TABLE submissions ADD COLUMN ${name} ${type}`).run();
    }
  });

  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL COLLATE NOCASE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,
  ).run();

  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS user_tags (
      user_id TEXT NOT NULL,
      tag_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, tag_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    )
  `,
  ).run();

  db.prepare(
    "CREATE INDEX IF NOT EXISTS idx_user_tags_tag_id ON user_tags(tag_id)",
  ).run();

  db.prepare(
    "CREATE INDEX IF NOT EXISTS idx_submissions_user_timestamp ON submissions(user_id, timestamp DESC)",
  ).run();

  console.log(`Database initialized successfully at ${dbPath}`);
};

initDb();

module.exports = db;
