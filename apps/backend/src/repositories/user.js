const { db } = require("../config/db");

const updatableColumns = new Set([
  "github_id", "github_access_token", "github_refresh_token", "github_expires_at"
]);
const searchColumns = new Set([
  "id", "name", "email", "role", "created_at", "github_id"
]);
const selectableColumns = new Set([
  "id", "email", "name", "role", "created_at", "github_id"
]);

const sortColumns = {
  id: (direction) => `u.id ${direction}`,
  name: (direction) => `LOWER(COALESCE(NULLIF(u.name, ''), u.email)) ${direction}, LOWER(u.email) ${direction}`,
  email: (direction) => sortColumns.name(direction),
  role: (direction) => `u.role ${direction}`,
  created_at: (direction) => `u.created_at ${direction}`,
  github_id: (direction) => `u.github_id ${direction}`,
};

function resolveOrderBy(sortBy, sortDirection) {
  const direction = String(sortDirection).toUpperCase();
  if (direction !== "ASC" && direction !== "DESC")
    return null;

  const column = sortColumns[sortBy];
  return column
    ? column(direction)
    : null;
}

function getUserBy(value, column = "id") {
  if (!searchColumns.has(column))
    return undefined;

  return db.prepare(`
    SELECT
        ${selectableColumns ? [...selectableColumns].map((col) => `u.${col}`).join(", ") : "u.*"}
    FROM users u
    WHERE ${column} = ?
    LIMIT 1
  `).get(value);
}

function getUserTokensBy(value, column = "id") {
  if (!searchColumns.has(column))
    return undefined;

  return db.prepare(`
    SELECT github_id, github_access_token, github_refresh_token, github_expires_at
    FROM users 
    WHERE ${column} = ?
    LIMIT 1
  `).get(value);
}

function getUsersBy({
  values = undefined,
  column = "id",
  tagId = undefined,
  pageSize = 0, page = 0,
  orderBy = undefined, orderDirection = "ASC"
} = {}) {
  const params = [];
  const conditions = []

  if (values) {
    if (column && !searchColumns.has(column))
      return [];

    params.push(...values);
    conditions.push(`u.${column} IN (${values.map(() => "?").join(",")})`);
  }

  if (tagId) {
    conditions.push(`ut.tag_id = ?`);
    params.push(tagId);
  }

  if (pageSize > 0 && page >= 0)
    params.push(pageSize, (page - 1) * pageSize);

  return db.prepare(`
    SELECT DISTINCT 
        ${selectableColumns ? [...selectableColumns].map((col) => `u.${col}`).join(", ") : "u.*"}
    FROM users u
    ${tagId ? `LEFT JOIN user_tags ut ON u.id = ut.user_id` : ""}
    ${conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "" }
    ${orderBy ? `ORDER BY ${resolveOrderBy(orderBy, orderDirection) || "u.id"}` : ""}
    ${pageSize > 0 && page >= 0 ? `LIMIT ? OFFSET ?` : ""}
  `).all(...params);
}

function getUsersCount(tagId = undefined) {
  const params = [];
  if (tagId)
    params.push(tagId);

  return db.prepare(`
    SELECT COUNT(*) as count 
    FROM users u
    ${ tagId ? `
      LEFT JOIN user_tags ut ON u.id = ut.user_id
      WHERE ut.tag_id = ?
    ` : ``}
  `).get(...params).count;
}

function createUser({ id, email, name, role = "student" }) {
  return db.prepare(`
    INSERT INTO users (id, email, name, role)
    VALUES (@id, @email, @name, @role)
    ON CONFLICT(email) DO UPDATE SET
      name = excluded.name,
      role = excluded.role
    RETURNING *
  `).get({
    id,
    email,
    name,
    role,
  });
}

function updateUser(userId, updates) {
  const fields = Object.keys(updates).filter((field) => updatableColumns.has(field));

  if (fields.length !== 0) {
    const set = fields.map((field) => `${field} = ?`).join(", ");
    const values = fields.map((field) => updates[field]);

    return db.prepare(`
      UPDATE users
      SET ${set}
      WHERE id = ?
      RETURNING *
    `).get(...values, userId);
  }

  return undefined;
}

module.exports = {
  getUserBy,
  getUserTokensBy,
  getUsersBy,
  getUsersCount,
  createUser,
  updateUser
};