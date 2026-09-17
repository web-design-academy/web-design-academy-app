const router = require('express').Router();
const { authenticateToken } = require("../middleware/auth");
const crypto = require("crypto");
const { lessonSlugPattern } = require("../services/submissions");
const { validateSubmissionPayload } = require("../services/submissions");

router.use(authenticateToken);

router.post("/", async (req, res) => {
  const validationError = validateSubmissionPayload(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const { lessonSlug, taskId, html, css, js, evaluation } = req.body;

  try {
    const lesson = await lessonStore.getLesson(lessonSlug);
    const task = lesson?.tasks[Number(taskId) - 1];
    if (!task) {
      return res.status(404).json({ error: "Lesson task not found" });
    }

    const evaluationConfigHash = task.evaluation
      ? crypto
        .createHash("sha256")
        .update(JSON.stringify(task.evaluation))
        .digest("hex")
      : null;
    const result = db
      .prepare(
        `
      INSERT INTO submissions (
        user_id, lesson_slug, task_id, html, css, js,
        evaluation_status, evaluation_score, evaluation_passed,
        evaluation_issues, evaluation_version, evaluation_config_hash
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        req.user.sub,
        lessonSlug,
        String(taskId),
        html || "",
        css || "",
        js || "",
        evaluation?.status ?? null,
        evaluation?.score ?? null,
        evaluation ? Number(evaluation.passed) : null,
        evaluation ? JSON.stringify(evaluation.issues) : null,
        evaluation?.version ?? null,
        evaluationConfigHash,
      );

    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    console.error("Failed to save submission:", err);
    res.status(500).json({ error: "Database error" });
  }
});

router.get("/:id", (req, res) => {
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

router.get("/latest/:lessonSlug", (req, res) => {
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

module.exports = router;
