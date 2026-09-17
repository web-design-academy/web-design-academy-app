const tagRepository = require("../repositories/tag");
const tagNamePattern = /^[\p{L}\p{N}][\p{L}\p{N}\s._-]*$/u;

function parsePositiveInteger(value, fallback, max) {
  const parsed = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, max);
}

function parseOptionalTagId(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number.parseInt(String(value), 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return undefined;
  }

  return parsed;
}

function parseSortDirection(value) {
  const direction = String(value).toLowerCase();

  if (direction === "asc") return "ASC";
  if (direction === "desc") return "DESC";

  return null;
}

function getOrderBy(sortBy, sortDirection, sortColumns) {
  const column = sortColumns[sortBy];
  const direction = parseSortDirection(sortDirection);

  if (!column || !direction) return null;

  return column(direction);
}

/**
 * Normalizes a tag name by trimming and removing leading and trailing whitespace,
 * @param value
 * @returns {string|null}
 */
function normalizeTagName(value) {
  const name =
    typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";

  if (name.length > 32 || !tagNamePattern.test(name)) {
    return null;
  }

  return name;
}

function hydrateUserTags(users) {
  if (users.length === 0) {
    return users;
  }

  const ids = users.map((user) => user.id);
  const tags = tagRepository.getTagsByUsers(ids);

  const tagsByUser = new Map();
  tags.forEach((tag) => {
    const list = tagsByUser.get(tag.user_id) || [];
    list.push({ id: tag.id, name: tag.name });
    tagsByUser.set(tag.user_id, list);
  });

  return users.map((user) => ({
    ...user,
    tags: tagsByUser.get(user.id) || [],
  }));
}

function hydrateSubmissionUserTags(submissions) {
  const userIds = Array.from(
    new Set(
      submissions.map((submission) => submission.user_id).filter(Boolean),
    ),
  );

  if (userIds.length === 0) {
    return submissions.map((submission) => ({ ...submission, user_tags: [] }));
  }

  const tags = tagRepository.getTagsByUsers(userIds);
  const tagsByUser = new Map();
  tags.forEach((tag) => {
    const list = tagsByUser.get(tag.user_id) || [];
    list.push({ id: tag.id, name: tag.name });
    tagsByUser.set(tag.user_id, list);
  });

  return submissions.map((submission) => ({
    ...submission,
    user_tags: tagsByUser.get(submission.user_id) || [],
  }));
}

function parseUserIdList(value) {
  if (!Array.isArray(value)) return null;

  const ids = [
    ...new Set(value.map((id) => String(id).trim()).filter(Boolean)),
  ];
  return ids.length ? ids : null;
}

function resolveTagFromPayload(payload) {
  let tagId = Number.parseInt(String(payload.tagId ?? ""), 10);

  if (!Number.isFinite(tagId) || tagId < 1) {
    const name = normalizeTagName(payload.name);

    if (!name) {
      return { error: "Invalid tag name" };
    }

    tagRepository.createTag(name);
  }

  const tag = tagRepository.getTagBy(tagId);
  if (!tag) {
    return { error: "Tag not found", status: 404 };
  }

  return { tag };
}

module.exports = {
  parsePositiveInteger,
  parseOptionalTagId,
  getOrderBy,
  normalizeTagName,
  hydrateUserTags,
  hydrateSubmissionUserTags,
  parseUserIdList,
  resolveTagFromPayload
}
