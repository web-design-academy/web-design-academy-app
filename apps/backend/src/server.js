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
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const COOKIE_NAME = "wa_session";

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
  if (!ADMIN_EMAIL) {
    throw new Error("ADMIN_EMAIL must be set in production");
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
    methods: ["GET", "POST", "OPTIONS"],
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

app.post("/api/auth/google", async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ error: "No ID Token" });

  if (!GOOGLE_CLIENT_ID || !ADMIN_EMAIL) {
    return res.status(503).json({ error: "Authentication is not configured" });
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name } = payload;

    const isVutEmail = isAllowedUniversityEmail(email);
    const isAdmin = email === ADMIN_EMAIL;

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

app.get("/api/submissions", authenticateToken, (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const submissions = db
    .prepare(
      `
    SELECT s.*, u.name as user_name, u.email as user_email
    FROM submissions s
    LEFT JOIN users u ON s.user_id = u.id
    ORDER BY s.timestamp DESC
  `,
    )
    .all();

  res.json(submissions);
});

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
