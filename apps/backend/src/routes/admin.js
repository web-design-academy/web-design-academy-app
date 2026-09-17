const router = require('express').Router();
const { authenticateToken, requireAdmin } = require("../middleware/auth");
const {
  parseUserIdList,
  resolveTagFromPayload,
  normalizeTagName,
  getOrderBy,
  parseOptionalTagId,
  parsePositiveInteger,
  hydrateUserTags,
} = require("../services/admin");
const tagRepository = require("../repositories/tag");
const userRepository = require("../repositories/user");
const ServerError = require("../errors/ServerError");

router.use(authenticateToken, requireAdmin);

router.get("/tags", (_req, res) => {
  const tags = tagRepository.getTags();
  res.json(tags);
});

router.delete("/tags/:tagId", (req, res) => {
    const tagId = Number.parseInt(req.params.tagId, 10);

    if (!Number.isFinite(tagId) || tagId < 1) {
      throw new ServerError("Invalid tagId", 400);
    }

    tagRepository.deleteTag(tagId);
    res.json({ success: true });
  },
);

router.post("/users/tags", (req, res) => {
    const userIds = parseUserIdList(req.body.userIds);

    if (!userIds) {
      throw new ServerError("No users selected", 400);
    }

    const resolved = resolveTagFromPayload(req.body);
    if (resolved.error) {
      throw new ServerError(resolved.error, resolved.status || 400);
    }

    const existingUsers = userRepository.getUsersBy(userIds);

    if (!existingUsers.length) {
      throw new ServerError("Users not found", 404);
    }

    tagRepository.assignTagToUsers(userIds, resolved.tag.id);

    res.json({ success: true, tag: resolved.tag });
  },
);

router.delete("/users/tags/:tagId", (req, res) => {
    const userIds = parseUserIdList(req.body.userIds);
    const tagId = Number.parseInt(req.params.tagId, 10);

    if (!userIds) {
      throw new ServerError("No users selected", 400);
    }

    if (!Number.isFinite(tagId) || tagId < 1) {
      throw new ServerError("Invalid tagId", 400);
    }

    tagRepository.removeTagFromUsers(userIds, tagId);
    res.json({ success: true });
  },
);


router.post("/users/:userId/tags", (req, res) => {
    const user = userRepository.getUserBy(req.params.userId)

    if (!user)
      throw new ServerError("User not found", 404);

    let tagId = Number.parseInt(String(req.body.tagId ?? ""), 10);
    let tag = null;

    if (Number.isFinite(tagId) && tagId > 0) {
      tag = tagRepository.getTagBy(tagId);
      if (!tag)
        throw new ServerError("Tag not found", 404);
    } else {
      const name = normalizeTagName(req.body.name);
      if (!name)
        throw new ServerError("Invalid tag name", 400);

      tag = tagRepository.createTag(name);
      if (!tag)
        throw new ServerError("Failed to create tag", 500);
    }

    tagRepository.assignTagToUser(user.id, tag.id);
    res.json({ success: true, tag });
  },
);

router.delete("/users/:userId/tags/:tagId", (req, res) => {
    const tagId = Number.parseInt(req.params.tagId, 10);

    if (!Number.isFinite(tagId) || tagId < 1) {
      throw new ServerError("Invalid tagId", 400);
    }

    tagRepository.removeTagFromUser(req.params.userId, tagId);
    res.json({ success: true });
  },
);


router.get("/users", (req, res) => {
  const page = parsePositiveInteger(req.query.page, 1, 100000);
  const pageSize = parsePositiveInteger(req.query.pageSize, 20, 100);
  const tagId = parseOptionalTagId(req.query.tagId);

  if (tagId === undefined) {
    throw new ServerError("Invalid tagId", 400);
  }

  const count = userRepository.getUsersCount(tagId);
  const users = userRepository.getUsersBy({
    tagId: tagId,
    pageSize: pageSize,
    page: page
  });

  res.json({
    items: hydrateUserTags(users),
    count,
    page,
    pageSize,
  });
});

router.get("/submissions", (req, res) => {
  const hasPagination =
    req.query.page !== undefined || req.query.pageSize !== undefined;
  const page = parsePositiveInteger(req.query.page, 1, 100000);
  const pageSize = parsePositiveInteger(req.query.pageSize, 20, 100);
  const offset = (page - 1) * pageSize;
  const tagId = parseOptionalTagId(req.query.tagId);
  const orderBy = getOrderBy(req.query.sortBy, req.query.sortDirection, {
    id: (direction) => `s.id ${direction}`,
    user: (direction) =>
      `LOWER(COALESCE(NULLIF(u.name, ''), u.email, '')) ${direction}`,
    lesson: (direction) =>
      `LOWER(s.lesson_slug) ${direction}, s.task_id ${direction}`,
    submitted: (direction) => `s.timestamp ${direction}`,
  });

  if (tagId === undefined) {
    throw new ServerError("Invalid tagId", 400);
  }

  if (!hasPagination) {
    res.json([]);
    return;
  }

  res.json({
    items: [],
    count: 0,
    page,
    pageSize,
  });
});

module.exports = router;
