require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const db = require("./db");

const app = express();

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PRODUCTION = NODE_ENV === "production";
const JWT_SECRET = process.env.JWT_SECRET;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const COOKIE_NAME = "wa_session";

function parseEmailList(value) {
  return (value || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

const ADMIN_EMAILS = parseEmailList(process.env.ADMIN_EMAILS);
const ADMIN_EMAIL_SET = new Set(ADMIN_EMAILS);

const DEFAULT_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://webdesignacademy.org",
];

const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || DEFAULT_ORIGINS.join(","))
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be set and at least 32 characters long");
}

if (IS_PRODUCTION) {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error("GOOGLE_CLIENT_ID must be set in production");
  }
  if (ADMIN_EMAIL_SET.size === 0) {
    throw new Error("ADMIN_EMAILS must be set in production");
  }
}

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

if (IS_PRODUCTION) {
  app.set("trust proxy", 1);
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin not allowed by CORS"));
    },
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    credentials: true,
  }),
);

app.use(express.json({ limit: "512kb" }));
app.use(cookieParser());

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          "blob:",
          "https://cdn.jsdelivr.net",
          "https://accounts.google.com/gsi/client",
        ],
        "script-src-elem": [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          "blob:",
          "https://cdn.jsdelivr.net",
          "https://accounts.google.com/gsi/client",
        ],
        "style-src": [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.jsdelivr.net",
          "https://accounts.google.com/gsi/style",
          "https://fonts.googleapis.com",
        ],
        "style-src-elem": [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.jsdelivr.net",
          "https://accounts.google.com/gsi/style",
          "https://fonts.googleapis.com",
        ],
        "img-src": ["'self'", "https:", "data:", "blob:"],
        "font-src": ["'self'", "data:", "https://fonts.gstatic.com"],
        "connect-src": [
          "'self'",
          "https://cdn.jsdelivr.net",
          "https://accounts.google.com/gsi/",
          "https://accounts.google.com/gsi/client",
        ],
        "frame-src": ["'self'", "https://accounts.google.com/gsi/"],
        "worker-src": ["'self'", "blob:"],
      },
    },
    crossOriginOpenerPolicy: false,
  }),
);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication attempts, try again later" },
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, try again later" },
});

const writeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const verifyOrigin = (req, res, next) => {
  if (!writeMethods.has(req.method)) {
    next();
    return;
  }

  const origin = req.headers.origin;

  if (!origin) {
    next();
    return;
  }

  if (!ALLOWED_ORIGINS.includes(origin)) {
    res.status(403).json({ error: "Untrusted origin" });
    return;
  }

  next();
};

app.use("/api", verifyOrigin, apiLimiter);
app.use("/api/auth/google", authLimiter);

if (IS_PRODUCTION) {
  const staticPath = path.join(__dirname, "../frontend/dist");
  app.use(express.static(staticPath));
}

const sessionCookieOptions = {
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
};

function isAllowedUniversityEmail(email) {
  return (
    /@(?:[a-z0-9-]+\.)*vutbr\.cz$/i.test(email) ||
    /@(?:[a-z0-9-]+\.)*vut\.cz$/i.test(email)
  );
}

const lessonSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const tagNamePattern = /^[\p{L}\p{N}][\p{L}\p{N}\s._-]*$/u;

function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }

  next();
}

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
  const placeholders = ids.map(() => "?").join(",");
  const tags = db
    .prepare(
      `
      SELECT ut.user_id, t.id, t.name
      FROM user_tags ut
      JOIN tags t ON t.id = ut.tag_id
      WHERE ut.user_id IN (${placeholders})
      ORDER BY t.name ASC
    `,
    )
    .all(...ids);

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

  const placeholders = userIds.map(() => "?").join(",");
  const tags = db
    .prepare(
      `
      SELECT ut.user_id, t.id, t.name
      FROM user_tags ut
      JOIN tags t ON t.id = ut.tag_id
      WHERE ut.user_id IN (${placeholders})
      ORDER BY t.name ASC
    `,
    )
    .all(...userIds);

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

function validateSubmissionPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return "Missing payload";
  }

  const { lessonSlug, taskId, html, css, js } = payload;

  if (
    !lessonSlug ||
    typeof lessonSlug !== "string" ||
    !lessonSlugPattern.test(lessonSlug)
  ) {
    return "Invalid lessonSlug";
  }

  if (!taskId || (typeof taskId !== "string" && typeof taskId !== "number")) {
    return "Invalid taskId";
  }

  const normalizedTaskId = String(taskId);
  if (!/^\d{1,4}$/.test(normalizedTaskId)) {
    return "Invalid taskId";
  }

  for (const [fieldName, value] of Object.entries({ html, css, js })) {
    if (value !== undefined && typeof value !== "string") {
      return `Invalid ${fieldName}`;
    }

    if (typeof value === "string" && value.length > 200000) {
      return `${fieldName} is too large`;
    }
  }

  return null;
}

const authenticateToken = (req, res, next) => {
  const token = req.cookies[COOKIE_NAME];

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.status(403).json({ error: "Invalid or expired token" });
  }
};

async function getGoogleUserFromAccessToken(accessToken) {
  const tokenInfo = await client.getTokenInfo(accessToken);

  if (tokenInfo.aud !== GOOGLE_CLIENT_ID) {
    throw new Error("Invalid token audience");
  }

  const userInfoResponse = await fetch(
    "https://www.googleapis.com/oauth2/v3/userinfo",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!userInfoResponse.ok) {
    throw new Error("Failed to fetch Google profile");
  }

  const profile = await userInfoResponse.json();

  if (!profile.email || profile.email_verified === false) {
    throw new Error("Invalid Google profile");
  }

  return {
    email: profile.email,
    name: profile.name || profile.email,
  };
}

async function getGoogleUser({ idToken, accessToken }) {
  if (idToken) {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    return {
      email: payload.email,
      name: payload.name || payload.email,
    };
  }

  return getGoogleUserFromAccessToken(accessToken);
}

app.post("/api/auth/google", async (req, res) => {
  const { idToken, accessToken } = req.body;
  if (!idToken && !accessToken) {
    return res.status(400).json({ error: "No Google token" });
  }

  if (!GOOGLE_CLIENT_ID || ADMIN_EMAIL_SET.size === 0) {
    return res.status(503).json({ error: "Authentication is not configured" });
  }

  try {
    const { email, name } = await getGoogleUser({ idToken, accessToken });
    if (!email) {
      return res.status(401).json({ error: "Invalid Google Token" });
    }

    const normalizedEmail = email.toLowerCase();

    const isVutEmail = isAllowedUniversityEmail(normalizedEmail);
    const isAdmin = ADMIN_EMAIL_SET.has(normalizedEmail);

    if (!isVutEmail && !isAdmin) {
      return res.status(403).json({
        error: "Access denied. Please use your VUT account.",
      });
    }

    const role = isAdmin ? "admin" : "student";

    let user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);

    if (!user) {
      user = { id: uuidv4(), email, name, role };
      db.prepare(
        "INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)",
      ).run(user.id, user.email, user.name, user.role);
    } else if (user.role !== role) {
      db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, user.id);
      user.role = role;
    }

    const token = jwt.sign(
      { sub: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.cookie(COOKIE_NAME, token, sessionCookieOptions);
    res.json({
      userId: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
    });
  } catch (err) {
    res.status(401).json({ error: "Invalid Google Token" });
  }
});

app.get("/api/auth/me", authenticateToken, (req, res) => {
  res.json({
    userId: req.user.sub,
    role: req.user.role,
    name: req.user.name,
    email: req.user.email,
  });
});

app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "lax",
    path: "/",
  });
  res.json({ success: true });
});

app.get("/api/admin/tags", authenticateToken, requireAdmin, (_req, res) => {
  const tags = db
    .prepare(
      `
      SELECT t.id, t.name, COUNT(ut.user_id) as user_count
      FROM tags t
      LEFT JOIN user_tags ut ON ut.tag_id = t.id
      GROUP BY t.id
      ORDER BY t.name ASC
    `,
    )
    .all();

  res.json(tags);
});

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

    db.prepare("INSERT OR IGNORE INTO tags (name) VALUES (?)").run(name);
    tagId = db.prepare("SELECT id FROM tags WHERE name = ?").get(name).id;
  }

  const tag = db.prepare("SELECT id, name FROM tags WHERE id = ?").get(tagId);

  if (!tag) {
    return { error: "Tag not found", status: 404 };
  }

  return { tag };
}

app.delete(
  "/api/admin/tags/:tagId",
  authenticateToken,
  requireAdmin,
  (req, res) => {
    const tagId = Number.parseInt(req.params.tagId, 10);

    if (!Number.isFinite(tagId) || tagId < 1) {
      return res.status(400).json({ error: "Invalid tagId" });
    }

    const deleteTagRecord = db.transaction(() => {
      db.prepare("DELETE FROM user_tags WHERE tag_id = ?").run(tagId);
      db.prepare("DELETE FROM tags WHERE id = ?").run(tagId);
    });

    deleteTagRecord();
    res.json({ success: true });
  },
);

app.post(
  "/api/admin/users/tags",
  authenticateToken,
  requireAdmin,
  (req, res) => {
    const userIds = parseUserIdList(req.body.userIds);

    if (!userIds) {
      return res.status(400).json({ error: "No users selected" });
    }

    const resolved = resolveTagFromPayload(req.body);
    if (resolved.error) {
      return res.status(resolved.status || 400).json({ error: resolved.error });
    }

    const existingUsers = db
      .prepare(
        `SELECT id FROM users WHERE id IN (${userIds.map(() => "?").join(",")})`,
      )
      .all(...userIds);

    if (!existingUsers.length) {
      return res.status(404).json({ error: "Users not found" });
    }

    const insert = db.prepare(
      "INSERT OR IGNORE INTO user_tags (user_id, tag_id) VALUES (?, ?)",
    );

    const assignTags = db.transaction((users) => {
      users.forEach((user) => insert.run(user.id, resolved.tag.id));
    });

    assignTags(existingUsers);
    res.json({ success: true, tag: resolved.tag });
  },
);

app.delete(
  "/api/admin/users/tags/:tagId",
  authenticateToken,
  requireAdmin,
  (req, res) => {
    const userIds = parseUserIdList(req.body.userIds);
    const tagId = Number.parseInt(req.params.tagId, 10);

    if (!userIds) {
      return res.status(400).json({ error: "No users selected" });
    }

    if (!Number.isFinite(tagId) || tagId < 1) {
      return res.status(400).json({ error: "Invalid tagId" });
    }

    db.prepare(
      `DELETE FROM user_tags WHERE tag_id = ? AND user_id IN (${userIds
        .map(() => "?")
        .join(",")})`,
    ).run(tagId, ...userIds);

    res.json({ success: true });
  },
);

app.get("/api/admin/users", authenticateToken, requireAdmin, (req, res) => {
  const page = parsePositiveInteger(req.query.page, 1, 100000);
  const pageSize = parsePositiveInteger(req.query.pageSize, 20, 100);
  const offset = (page - 1) * pageSize;
  const tagId = parseOptionalTagId(req.query.tagId);
  const orderBy = getOrderBy(req.query.sortBy, req.query.sortDirection, {
    id: (direction) => `u.id ${direction}`,
    user: (direction) =>
      `LOWER(COALESCE(NULLIF(u.name, ''), u.email)) ${direction}, LOWER(u.email) ${direction}`,
    role: (direction) => `u.role ${direction}`,
    joined: (direction) => `u.created_at ${direction}`,
  });

  if (tagId === undefined) {
    return res.status(400).json({ error: "Invalid tagId" });
  }

  const where = tagId
    ? "WHERE EXISTS (SELECT 1 FROM user_tags ut WHERE ut.user_id = u.id AND ut.tag_id = ?)"
    : "";
  const params = tagId ? [tagId] : [];

  const total = db
    .prepare(`SELECT COUNT(*) as count FROM users u ${where}`)
    .get(...params).count;

  const users = db
    .prepare(
      `
      SELECT u.id, u.email, u.name, u.role, u.created_at
      FROM users u
      ${where}
      ORDER BY ${orderBy ? `${orderBy}, ` : ""}u.id ASC
      LIMIT ? OFFSET ?
    `,
    )
    .all(...params, pageSize, offset);

  res.json({
    items: hydrateUserTags(users),
    total,
    page,
    pageSize,
  });
});

app.post(
  "/api/admin/users/:userId/tags",
  authenticateToken,
  requireAdmin,
  (req, res) => {
    const user = db
      .prepare("SELECT id FROM users WHERE id = ?")
      .get(req.params.userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    let tagId = Number.parseInt(String(req.body.tagId ?? ""), 10);

    if (!Number.isFinite(tagId) || tagId < 1) {
      const name = normalizeTagName(req.body.name);

      if (!name) {
        return res.status(400).json({ error: "Invalid tag name" });
      }

      db.prepare("INSERT OR IGNORE INTO tags (name) VALUES (?)").run(name);
      tagId = db.prepare("SELECT id FROM tags WHERE name = ?").get(name).id;
    }

    const tag = db.prepare("SELECT id, name FROM tags WHERE id = ?").get(tagId);

    if (!tag) {
      return res.status(404).json({ error: "Tag not found" });
    }

    db.prepare(
      "INSERT OR IGNORE INTO user_tags (user_id, tag_id) VALUES (?, ?)",
    ).run(req.params.userId, tag.id);

    res.json({ success: true, tag });
  },
);

app.delete(
  "/api/admin/users/:userId/tags/:tagId",
  authenticateToken,
  requireAdmin,
  (req, res) => {
    const tagId = Number.parseInt(req.params.tagId, 10);

    if (!Number.isFinite(tagId) || tagId < 1) {
      return res.status(400).json({ error: "Invalid tagId" });
    }

    db.prepare("DELETE FROM user_tags WHERE user_id = ? AND tag_id = ?").run(
      req.params.userId,
      tagId,
    );

    res.json({ success: true });
  },
);

app.post("/api/submissions", authenticateToken, (req, res) => {
  const validationError = validateSubmissionPayload(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const { lessonSlug, taskId, html, css, js } = req.body;

  try {
    const result = db
      .prepare(
        `
      INSERT INTO submissions (user_id, lesson_slug, task_id, html, css, js)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        req.user.sub,
        lessonSlug,
        String(taskId),
        html || "",
        css || "",
        js || "",
      );

    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/submissions", authenticateToken, requireAdmin, (req, res) => {
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
    return res.status(400).json({ error: "Invalid tagId" });
  }

  const where = tagId
    ? "WHERE EXISTS (SELECT 1 FROM user_tags ut WHERE ut.user_id = s.user_id AND ut.tag_id = ?)"
    : "";
  const params = tagId ? [tagId] : [];

  const submissions = db
    .prepare(
      `
    SELECT s.*, u.name as user_name, u.email as user_email
    FROM submissions s
    LEFT JOIN users u ON s.user_id = u.id
    ${where}
    ORDER BY ${orderBy ? `${orderBy}, ` : ""}s.id ASC
    ${hasPagination ? "LIMIT ? OFFSET ?" : ""}
  `,
    )
    .all(...params, ...(hasPagination ? [pageSize, offset] : []));

  const hydratedSubmissions = hydrateSubmissionUserTags(submissions);

  if (!hasPagination) {
    res.json(hydratedSubmissions);
    return;
  }

  const total = db
    .prepare(
      `
      SELECT COUNT(*) as count
      FROM submissions s
      ${where}
    `,
    )
    .get(...params).count;

  res.json({
    items: hydratedSubmissions,
    total,
    page,
    pageSize,
  });
});

app.get(
  "/api/submissions/latest/:lessonSlug",
  authenticateToken,
  (req, res) => {
    if (!lessonSlugPattern.test(req.params.lessonSlug)) {
      return res.status(400).json({ error: "Invalid lesson slug" });
    }

    const rows = db
      .prepare(
        `
      SELECT *
      FROM submissions
      WHERE user_id = ? AND lesson_slug = ?
      ORDER BY timestamp DESC, id DESC
    `,
      )
      .all(req.user.sub, req.params.lessonSlug);

    const latestByTaskId = new Map();

    rows.forEach((row) => {
      if (!latestByTaskId.has(row.task_id)) {
        latestByTaskId.set(row.task_id, row);
      }
    });

    res.json({ items: Array.from(latestByTaskId.values()) });
  },
);

app.get("/api/submissions/:id", authenticateToken, (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(400).json({ error: "Invalid submission id" });
  }

  const submission = db
    .prepare("SELECT * FROM submissions WHERE id = ?")
    .get(req.params.id);

  if (!submission) return res.status(404).json({ error: "Not found" });

  if (req.user.role !== "admin" && submission.user_id !== req.user.sub) {
    return res.status(403).json({ error: "Forbidden" });
  }

  res.json(submission);
});

app.get("/api/progress/:lessonSlug", authenticateToken, (req, res) => {
  if (!lessonSlugPattern.test(req.params.lessonSlug)) {
    return res.status(400).json({ error: "Invalid lesson slug" });
  }

  const rows = db
    .prepare(
      "SELECT DISTINCT task_id FROM submissions WHERE user_id = ? AND lesson_slug = ?",
    )
    .all(req.user.sub, req.params.lessonSlug);

  res.json({ completedTaskIds: rows.map((row) => row.task_id) });
});

app.use((err, _req, res, next) => {
  if (err && err.message === "Origin not allowed by CORS") {
    res.status(403).json({ error: "Untrusted origin" });
    return;
  }

  next(err);
});

if (IS_PRODUCTION) {
  app.get(/^.*$/, (_req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
