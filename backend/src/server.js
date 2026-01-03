require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const db = require("./db");
const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-do-not-use-in-prod";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

app.use(cors());
app.use(bodyParser.json());

const getUserFromToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const token = authHeader.split(" ")[1];
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
};

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Missing fields" });

  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    const token = jwt.sign(
      { sub: "admin-id", email, role: "admin", name: "Admin" },
      JWT_SECRET,
      { expiresIn: "1d" },
    );
    return res.json({
      token,
      role: "admin",
      userId: "admin-id",
      name: "Admin",
    });
  }

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const hash = crypto.createHash("sha256").update(password).digest("hex");
  if (hash !== user.password_hash) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign(
    { sub: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: "1d" },
  );

  res.json({ token, userId: user.id, role: user.role, name: user.name });
});

app.post("/api/auth/anonymous", (req, res) => {
  const { email, name } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });

  if (email === ADMIN_EMAIL) {
    return res.status(403).json({ error: "Use admin login" });
  }

  let user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);

  if (!user) {
    user = { id: uuidv4(), email, name: name || "Anonymous", role: "student" };
    try {
      db.prepare(
        "INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)",
      ).run(user.id, user.email, user.name, user.role);
    } catch (e) {
      return res.status(500).json({ error: "Creation failed" });
    }
  }

  const token = jwt.sign(
    { sub: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: "365d" },
  );

  res.json({ token, userId: user.id, role: user.role, name: user.name });
});

app.post("/api/submissions", (req, res) => {
  const user = getUserFromToken(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { lessonSlug, taskId, html, css, js } = req.body;

  if (!lessonSlug || !taskId) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO submissions (user_id, lesson_slug, task_id, html, css, js, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      user.sub,
      lessonSlug,
      taskId,
      html || "",
      css || "",
      js || "",
      "pending",
    );

    res.json({ success: true, id: result.lastInsertRowid });
  } catch (error) {
    console.error("Submission error:", error);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/submissions", (req, res) => {
  const user = getUserFromToken(req);
  if (!user || user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const stmt = db.prepare(`
      SELECT 
        s.*, 
        u.name as user_name, 
        u.email as user_email 
      FROM submissions s
      LEFT JOIN users u ON s.user_id = u.id
      ORDER BY s.timestamp DESC
    `);

    const submissions = stmt.all();
    res.json(submissions);
  } catch (error) {
    console.error("Fetch submissions error:", error);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/submissions/:id", (req, res) => {
  const { id } = req.params;
  const user = getUserFromToken(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  try {
    const stmt = db.prepare("SELECT * FROM submissions WHERE id = ?");
    const submission = stmt.get(id);

    if (!submission) return res.status(404).json({ error: "Not found" });

    if (user.role !== "admin" && submission.user_id !== user.sub) {
      return res.status(403).json({ error: "Forbidden" });
    }

    res.json(submission);
  } catch (error) {
    console.error("Fetch error:", error);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/progress/:lessonSlug", (req, res) => {
  const user = getUserFromToken(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { lessonSlug } = req.params;

  try {
    const stmt = db.prepare(
      "SELECT DISTINCT task_id FROM submissions WHERE user_id = ? AND lesson_slug = ?",
    );
    const rows = stmt.all(user.sub, lessonSlug);
    res.json({ completedTaskIds: rows.map((r) => r.task_id) });
  } catch (error) {
    console.error("Progress error:", error);
    res.status(500).json({ error: "Database error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
