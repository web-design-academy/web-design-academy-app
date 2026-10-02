const {db} = require("../config/db");

const searchableColumns = new Set(['id', 'user_id']);
const updatableColumns = new Set([
  "github_id", "github_login", "github_type", "selection"
]);

function getBy(value, column = "id") {
  if (!searchableColumns.has(column))
    return undefined;

  return db.prepare(`
      SELECT *
      FROM installations
      WHERE ${column} = ?
      LIMIT 1
  `).get(value);
}

function listBy({
                  values = undefined,
                  column = "user_id",
                } = {}) {
  const params = [];
  const conditions = []

  if (values) {
    if (column && !searchableColumns.has(column))
      return [];

    params.push(...values);
    conditions.push(`${column} IN (${values.map(() => "?").join(",")})`);
  }

  return db.prepare(`
      SELECT DISTINCT *
      FROM installations ${conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""}
  `).all(...params);
}

function count() {
  return db.prepare(`
      SELECT COUNT(*) as count
      FROM installations
  `).get().count;
}

function upsert({
                  id,
                  userId,
                  githubId,
                  githubLogin,
                  githubType,
                  selection,
                  createdAt
                }) {
  return db.prepare(`
      INSERT INTO installations (id, user_id, github_id, github_login, github_type, selection, created_at)
      VALUES (@id, @user_id, @github_id, @github_login, @github_type, @selection, @created_at)
      ON CONFLICT(id) DO UPDATE SET github_id    = excluded.github_id,
                                    github_login = excluded.github_login,
                                    github_type  = excluded.github_type,
                                    selection    = excluded.selection
      RETURNING *
  `).get({
    id,
    user_id: userId,
    github_id: githubId,
    github_login: githubLogin,
    github_type: githubType,
    selection,
    created_at: createdAt
  });
}

function update(userId, updates) {
  const fields = Object.keys(updates).filter((field) => updatableColumns.has(field));

  if (fields.length !== 0) {
    const set = fields.map((field) => `${field} = ?`).join(", ");
    const values = fields.map((field) => updates[field]);

    return db.prepare(`
        UPDATE installations
        SET ${set}
        WHERE id = ?
        RETURNING *
    `).get(...values, userId);
  }

  return undefined;
}

function remove(id) {
  return db.prepare(`
      DELETE
      FROM installations
      WHERE id = ?
  `).run(id);
}

module.exports = {
  getBy,
  listBy,
  count,
  upsert,
  update,
  remove
};