const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const environment = require("./env");

// DB path and storage directory
const dbPath = path.resolve(__dirname, "../../", environment.dbPath);
const storageDir = path.dirname(dbPath);

// Creating storage directory if it doesn't exist
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
  console.log(`Created storage directory at: ${storageDir}`);
}

// Opening database connection
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const initDb = () => {
  const migration = db.transaction(() => {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        role TEXT DEFAULT 'student',
        github_id TEXT UNIQUE,
        github_login TEXT,
        github_name TEXT,
        github_avatar_url TEXT,
        github_scopes TEXT,
        github_access_token TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    db.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_github_id 
      ON users(github_id) 
      WHERE github_id IS NOT NULL
    `).run();

    db.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email 
      ON users(email) 
    `).run();

    db.prepare(`
      CREATE TABLE IF NOT EXISTS repos (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        language TEXT,
        owner_login TEXT NOT NULL,
        html_url TEXT NOT NULL,
        private INTEGER DEFAULT 0,
        default_branch TEXT DEFAULT 'main',
        created_at TEXT,
        pushed_at TEXT,
        updated_at TEXT,
        last_sync_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(id, user_id)
      )
    `).run();

    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_repos_user_id 
      ON repos(user_id)
      WHERE user_id IS NOT NULL
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
        evaluation_status TEXT,
        evaluation_score INTEGER,
        evaluation_passed INTEGER,
        evaluation_issues TEXT,
        evaluation_version INTEGER,
        evaluation_config_hash TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `).run();

    db.prepare(`
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL COLLATE NOCASE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    db.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_name 
      ON tags(name)
    `).run();

    db.prepare(`
      CREATE TABLE IF NOT EXISTS user_tags (
        user_id TEXT NOT NULL,
        tag_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, tag_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      )
    `).run();

    db.prepare("CREATE INDEX IF NOT EXISTS idx_user_tags_tag_id ON user_tags(tag_id)").run();
    db.prepare("CREATE INDEX IF NOT EXISTS idx_submissions_user_timestamp ON submissions(user_id, timestamp DESC)")
        .run();
  });

  migration();
  console.log(`Database initialized successfully at ${dbPath}`);
};

module.exports = {
  db,
  initDb
};
