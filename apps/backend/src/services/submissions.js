const lessonSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function validateSubmissionPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return "Missing payload";
  }

  const { lessonSlug, taskId, html, css, js, evaluation } = payload;

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

  if (evaluation !== undefined) {
    if (
      !evaluation ||
      typeof evaluation !== "object" ||
      evaluation.version !== 1 ||
      !["error", "success_with_warning", "success_perfect"].includes(
        evaluation.status,
      ) ||
      !Number.isFinite(evaluation.score) ||
      evaluation.score < 0 ||
      evaluation.score > 100 ||
      typeof evaluation.passed !== "boolean" ||
      !Array.isArray(evaluation.issues) ||
      evaluation.issues.length > 500
    ) {
      return "Invalid evaluation";
    }
  }

  return null;
}
module.exports = { validateSubmissionPayload };