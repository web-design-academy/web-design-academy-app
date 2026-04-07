require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

app.use(cors());
app.use(bodyParser.json());

if (process.env.NODE_ENV === "production") {
  const staticPath = path.join(__dirname, "../frontend/dist");
  app.use(express.static(staticPath));
}
app.use((_, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com/gsi/client https://cdn.jsdelivr.net; " +
      "worker-src 'self' blob:; " +
      "frame-src 'self' https://accounts.google.com/gsi/; " +
      "connect-src 'self' https://accounts.google.com/gsi/; " +
      "font-src 'self' data: https://fonts.gstatic.com; " +
      "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style https://fonts.googleapis.com;",
  );
  next();
});

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(401).json({ error: "No token provided" });

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

  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { email, name } = payload;

    const isVutbr = email.endsWith("@vutbr.cz");
    const isAdmin = email === ADMIN_EMAIL;

    if (!isVutbr && !isAdmin) {
      return res.status(403).json({
        error: "Access denied. Please use your @vutbr.cz account.",
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

    res.json({ token, userId: user.id, role: user.role, name: user.name });
  } catch (err) {
    res.status(401).json({ error: "Invalid Google Token" });
  }
});

app.post("/api/submissions", authenticateToken, (req, res) => {
  const { lessonSlug, taskId, html, css, js } = req.body;
  if (!lessonSlug || !taskId)
    return res.status(400).json({ error: "Missing fields" });

  try {
    const result = db
      .prepare(
        `
      INSERT INTO submissions (user_id, lesson_slug, task_id, html, css, js, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        req.user.sub,
        lessonSlug,
        taskId,
        html || "",
        css || "",
        js || "",
        "pending",
      );

    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/submissions", authenticateToken, (req, res) => {
  if (req.user.role !== "admin")
    return res.status(403).json({ error: "Forbidden" });

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
  const rows = db
    .prepare(
      "SELECT DISTINCT task_id FROM submissions WHERE user_id = ? AND lesson_slug = ?",
    )
    .all(req.user.sub, req.params.lessonSlug);

  res.json({ completedTaskIds: rows.map((r) => r.task_id) });
});

if (process.env.NODE_ENV === "production") {
  app.get(/^.*$/, (_, res) => {
    res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
