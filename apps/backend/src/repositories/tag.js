const { db } = require('../config/db');

const searchableColumns = new Set(['id', 'name']);

function getTags() {
  return db.prepare(`
    SELECT t.id, t.name, COUNT(ut.user_id) as user_count
    FROM tags t
    LEFT JOIN user_tags ut ON t.id = ut.tag_id
    GROUP BY t.id, t.name
    ORDER BY t.name
  `).all();
}

function getTagsByUsers(userIds) {
  return db.prepare(`
    SELECT ut.user_id, t.id, t.name
    FROM user_tags ut
    JOIN tags t ON t.id = ut.tag_id
    WHERE ut.user_id IN (${userIds.map(() => '?').join(',')})
    ORDER BY t.name
  `).all(...userIds);
}

function getTagBy(value, column = 'id') {
  if (!value || !searchableColumns.has(column))
    return undefined;

  return db.prepare(`
      SELECT * FROM tags WHERE ${column} = ?
  `).get(value);
}

function createTag(name) {
  return db.prepare("INSERT OR IGNORE INTO tags (name) VALUES (?) RETURNING *").get(name);
}

function deleteTag(id) {
  const deleteTransaction = db.transaction(() => {
    db.prepare("DELETE FROM user_tags WHERE tag_id = ?").run(id);
    db.prepare("DELETE FROM tags WHERE id = ?").run(id);
  });

  return deleteTransaction();
}

const insertToUserTagsStmt = db.prepare(
  "INSERT OR IGNORE INTO user_tags (user_id, tag_id) VALUES (?, ?) RETURNING *",
);

const deleteFromUserStmt = db.prepare("DELETE FROM user_tags WHERE user_id = ? AND tag_id = ?");

function assignTagToUsers(userIds, tagId) {
  const assignTransaction = db.transaction(() => {
    userIds.forEach((id) => insertToUserTagsStmt.get(id, tagId) ?? { user_id: id, tag_id: tagId });
  });
  return assignTransaction();
}

function assignTagToUser(userId, tagId) {
  return insertToUserTagsStmt.get(userId, tagId) ?? { user_id: userId, tag_id: tagId };
}

function removeTagFromUsers(userIds, tagId) {
  const removeTransaction = db.transaction(() => {
    userIds.forEach((user) => deleteFromUserStmt.run(user.id, tagId));
  });
  return removeTransaction();
}

function removeTagFromUser(userId, tagId) {
  return deleteFromUserStmt.run(userId, tagId);
}

module.exports = {
  getTags,
  getTagBy,
  getTagsByUsers,
  createTag,
  deleteTag,
  assignTagToUsers,
  assignTagToUser,
  removeTagFromUsers,
  removeTagFromUser
};