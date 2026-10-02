const { db } = require('../config/db');

const searchableColumns = new Set(['id', 'name']);

function getBy(value, column = 'id') {
  if (!value || !searchableColumns.has(column))
    return undefined;

  return db.prepare(`
      SELECT *
      FROM tags
      WHERE ${column} = ?
  `).get(value);
}

function list() {
  return db.prepare(`
    SELECT t.id, t.name, COUNT(ut.user_id) as user_count
    FROM tags t
    LEFT JOIN user_tags ut ON t.id = ut.tag_id
    GROUP BY t.id, t.name
    ORDER BY t.name
  `).all();
}

function listByUsers(userIds) {
  return db.prepare(`
    SELECT ut.user_id, t.id, t.name
    FROM user_tags ut
    JOIN tags t ON t.id = ut.tag_id
    WHERE ut.user_id IN (${userIds.map(() => '?').join(',')})
    ORDER BY t.name
  `).all(...userIds);
}

function create(name) {
  return db.prepare("INSERT OR IGNORE INTO tags (name) VALUES (?) RETURNING *").get(name);
}

function remove(id) {
  const deleteTransaction = db.transaction(() => {
    db.prepare("DELETE FROM user_tags WHERE tag_id = ?").run(id);
    db.prepare("DELETE FROM tags WHERE id = ?").run(id);
  });

  return deleteTransaction();
}

function assignToUser(userId, tagId) {
  return db.prepare(
    "INSERT OR IGNORE INTO user_tags (user_id, tag_id) VALUES (?, ?) RETURNING *",
  ).get(userId, tagId) ?? {user_id: userId, tag_id: tagId};
}

function assignToUsers(userIds, tagId) {
  const assignTransaction = db.transaction(() => {
    userIds.forEach((id) => assignToUser(id, tagId));
  });

  return assignTransaction();
}

function removeFromUser(userId, tagId) {
  return db.prepare(
    "DELETE FROM user_tags WHERE user_id = ? AND tag_id = ?"
  ).run(userId, tagId);
}

function removeFromUsers(userIds, tagId) {
  const removeTransaction = db.transaction(() => {
    userIds.forEach((id) => removeFromUser(id, tagId));
  });

  return removeTransaction();
}

module.exports = {
  getBy,
  list,
  listByUsers,
  create,
  remove,
  assignToUser,
  assignToUsers,
  removeFromUser,
  removeFromUsers,
};