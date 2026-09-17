const { db } = require('../config/db');

const updatableColumns = new Set([
  'name', 'url', 'is_private', 'default_branch', 'pushed_at'
]);

function getReposByUser(userId) {
  if (!userId)
    return [];

  return db.prepare(`
    SELECT * 
    FROM repos 
    WHERE user_id = ?
  `).all(userId);
}

function getRepo(id) {
  if (!id)
    return undefined;

  return db.prepare(`
    SELECT * 
    FROM repos
    WHERE id = ?
  `).get(id);
}

function createRepo(userId, repo) {
  console.log(userId, repo.id);
  return db.prepare(`
    INSERT INTO repos (
                       id, 
                       user_id, 
                       name, 
                       description,
                       language,
                       owner_login,
                       html_url,
                       private, 
                       default_branch,
                       created_at,
                       pushed_at,
                       updated_at
    )
    VALUES (
            @id,
            @user_id,
            @name,
            @description,
            @language,
            @owner_login,
            @html_url,
            @private,
            @default_branch,
            @created_at,
            @pushed_at,
            CURRENT_TIMESTAMP
           )
    ON CONFLICT (id) DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       owner_login = excluded.owner_login,
       language = excluded.language,
       html_url = excluded.html_url,
       private = excluded.private,
       default_branch = excluded.default_branch,
       created_at = excluded.created_at,
       pushed_at = excluded.pushed_at
    RETURNING *
  `).get({
    id: Math.floor(repo.id),
    user_id: userId,
    name: repo.name,
    description: repo.description,
    language: repo.language,
    owner_login: repo.owner_login,
    html_url: repo.html_url,
    private: repo.private ? 1 : 0,
    default_branch: repo.default_branch,
    created_at: repo.created_at,
    pushed_at: repo.pushed_at,
  });
}

function updateRepo(userId, repoId, updates) {
  const fields = Object.keys(updates).filter((field) => updatableColumns.has(field));

  if (fields.length !== 0) {
    const set = fields.map((field) => `${field} = ?`).join(", ");
    const values = fields.map((field) => updates[field]);

    return db.prepare(`
      UPDATE repos
      SET ${set}, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND id = ?
      RETURNING *
    `).get(...values, userId, repoId);
  }

  return undefined;
}

function deleteRepo(userId, repoId) {
  return db.prepare(`
    DELETE FROM repos
    WHERE user_id = ? AND id = ?
  `).run(userId, repoId);
}

module.exports = {
  getReposByUser,
  getRepo,
  createRepo,
  updateRepo,
  deleteRepo
};
