const fs = require("fs/promises");
const path = require("path");

const lessonSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_LESSON_FILE_BYTES = 2 * 1024 * 1024;

const taskFiles = {
  "index.html": "html",
  "styles.css": "css",
  "script.js": "js",
  "solution.html": "solutionHtml",
  "solution.css": "solutionCss",
  "solution.js": "solutionJs",
};
const EVALUATION_FILE_NAME = "evaluation.json";
const allowedTaskFileNames = new Set([
  ...Object.keys(taskFiles),
  EVALUATION_FILE_NAME,
]);
const activeTaskFileNames = new Set(["index.html", "styles.css", "script.js"]);

const readonlyMarkers = {
  html: ["<!-- readonly:start -->", "<!-- readonly:end -->"],
  css: ["/* readonly:start */", "/* readonly:end */"],
  js: ["/* readonly:start */", "/* readonly:end */"],
};

const evaluationCheckTypes = new Set([
  "forbidden-property",
  "required-property",
  "exists",
  "exact-match",
  "regex-match",
  "min-count",
  "max-count",
  "forbidden-value",
]);
const evaluationLevels = new Set(["error", "warning", "recommendation"]);

function validateEvaluationConfig(value, filePath) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid evaluation configuration in ${filePath}`);
  }

  if (value.version !== 1 || value.engine !== "css") {
    throw new Error(`Unsupported evaluation configuration in ${filePath}`);
  }

  if (
    !Array.isArray(value.targetSelectors) ||
    value.targetSelectors.some(
      (selector) =>
        typeof selector !== "string" ||
        selector.trim().length === 0 ||
        selector.length > 200,
    )
  ) {
    throw new Error(`Invalid targetSelectors in ${filePath}`);
  }

  if (!Array.isArray(value.checks)) {
    throw new Error(`Invalid checks in ${filePath}`);
  }

  const checkIds = new Set();
  value.checks.forEach((check) => {
    const isCountCheck =
      check?.type === "min-count" || check?.type === "max-count";
    const needsValue = [
      "exact-match",
      "regex-match",
      "min-count",
      "max-count",
      "forbidden-value",
    ].includes(check?.type);

    if (
      !check ||
      typeof check !== "object" ||
      Array.isArray(check) ||
      typeof check.id !== "string" ||
      check.id.length === 0 ||
      check.id.length > 100 ||
      checkIds.has(check.id) ||
      !evaluationCheckTypes.has(check.type) ||
      typeof check.selector !== "string" ||
      check.selector.length === 0 ||
      check.selector.length > 200 ||
      typeof check.property !== "string" ||
      check.property.length === 0 ||
      check.property.length > 100 ||
      (check.level !== undefined && !evaluationLevels.has(check.level)) ||
      (needsValue &&
        (isCountCheck
          ? !Number.isFinite(check.value) || check.value < 0
          : typeof check.value !== "string")) ||
      (check.media !== undefined && typeof check.media !== "string") ||
      (check.message !== undefined && typeof check.message !== "string") ||
      (check.studentHint !== undefined && typeof check.studentHint !== "string")
    ) {
      throw new Error(`Invalid evaluation check in ${filePath}`);
    }

    if (check.type === "regex-match") {
      try {
        new RegExp(check.value);
      } catch {
        throw new Error(`Invalid regular expression in ${filePath}`);
      }
    }

    checkIds.add(check.id);
  });

  if (
    value.hintTimeoutSeconds !== undefined &&
    (!Number.isFinite(value.hintTimeoutSeconds) ||
      value.hintTimeoutSeconds < 0 ||
      value.hintTimeoutSeconds > 3600)
  ) {
    throw new Error(`Invalid hintTimeoutSeconds in ${filePath}`);
  }

  if (value.pass !== undefined) {
    if (
      !value.pass ||
      typeof value.pass !== "object" ||
      Array.isArray(value.pass) ||
      (value.pass.minimumScore !== undefined &&
        (!Number.isFinite(value.pass.minimumScore) ||
          value.pass.minimumScore < 0 ||
          value.pass.minimumScore > 100)) ||
      (value.pass.requireNoErrors !== undefined &&
        typeof value.pass.requireNoErrors !== "boolean")
    ) {
      throw new Error(`Invalid pass requirements in ${filePath}`);
    }
  }

  return {
    version: 1,
    engine: "css",
    targetSelectors: value.targetSelectors.map((selector) => selector.trim()),
    checks: value.checks,
    hintTimeoutSeconds: value.hintTimeoutSeconds ?? 60,
    pass: {
      minimumScore: value.pass?.minimumScore ?? 80,
      requireNoErrors: value.pass?.requireNoErrors ?? true,
    },
  };
}

function validateReadonlyBlocks(source, language, filePath) {
  const [startMarker, endMarker] = readonlyMarkers[language];
  let isInsideReadonlyBlock = false;
  const sourceLines = source.replace(/\r\n/g, "\n").split("\n");

  sourceLines.forEach((line, index) => {
    const trimmed = line.trim();

    if (trimmed === startMarker) {
      if (isInsideReadonlyBlock) {
        throw new Error(`Nested readonly block in ${filePath}:${index + 1}`);
      }
      if (index === 0 || sourceLines[index - 1].trim() !== "") {
        throw new Error(
          `Readonly block needs an empty line before it in ${filePath}:${index + 1}`,
        );
      }
      isInsideReadonlyBlock = true;
    } else if (trimmed === endMarker) {
      if (!isInsideReadonlyBlock) {
        throw new Error(
          `Readonly block ends without a start in ${filePath}:${index + 1}`,
        );
      }
      if (
        index === sourceLines.length - 1 ||
        sourceLines[index + 1].trim() !== ""
      ) {
        throw new Error(
          `Readonly block needs an empty line after it in ${filePath}:${index + 1}`,
        );
      }
      isInsideReadonlyBlock = false;
    }
  });

  if (isInsideReadonlyBlock) {
    throw new Error(`Unclosed readonly block in ${filePath}`);
  }
}

function resolveLessonsPath() {
  const localBackendSourceSuffix = ["apps", "backend", "src"].join(path.sep);
  const isLocalMonorepo = __dirname.endsWith(localBackendSourceSuffix);

  return isLocalMonorepo
    ? path.resolve(__dirname, "../../../lessons")
    : path.resolve(__dirname, "../lessons");
}

function parseScalar(value) {
  const trimmed = value.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    if (trimmed.startsWith('"')) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return trimmed.slice(1, -1);
      }
    }

    return trimmed.slice(1, -1).replace(/''/g, "'");
  }

  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);

  return trimmed;
}

function parseLessonMdx(source, filePath) {
  const normalized = source.replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);

  if (!match) {
    throw new Error(`Lesson metadata is missing in ${filePath}`);
  }

  const frontmatter = {};

  match[1].split("\n").forEach((line) => {
    if (!line.trim() || line.trimStart().startsWith("#")) return;

    const separator = line.indexOf(":");
    if (separator < 1) {
      throw new Error(`Invalid lesson metadata line in ${filePath}`);
    }

    const key = line.slice(0, separator).trim();
    frontmatter[key] = parseScalar(line.slice(separator + 1));
  });

  const meta = {
    title: frontmatter.title,
    description: frontmatter.description,
    slug: frontmatter.slug,
    color: frontmatter.color,
    order: frontmatter.order,
    icon: frontmatter.icon,
    hidden: frontmatter.hidden ?? false,
    visualEditor: frontmatter.visualEditor ?? false,
    visualPreview: frontmatter.visualPreview ?? false,
  };

  if (
    typeof meta.title !== "string" ||
    typeof meta.description !== "string" ||
    typeof meta.slug !== "string" ||
    !lessonSlugPattern.test(meta.slug) ||
    typeof meta.color !== "string" ||
    !Number.isFinite(meta.order) ||
    typeof meta.icon !== "string" ||
    typeof meta.hidden !== "boolean" ||
    typeof meta.visualEditor !== "boolean" ||
    typeof meta.visualPreview !== "boolean"
  ) {
    throw new Error(`Invalid lesson metadata in ${filePath}`);
  }

  return {
    meta,
    content: normalized.slice(match[0].length).trim(),
  };
}

async function readRegularFile(filePath) {
  const fileStat = await fs.lstat(filePath);

  if (!fileStat.isFile() || fileStat.isSymbolicLink()) {
    throw new Error(`Lesson asset must be a regular file: ${filePath}`);
  }

  if (fileStat.size > MAX_LESSON_FILE_BYTES) {
    throw new Error(`Lesson asset is too large: ${filePath}`);
  }

  return fs.readFile(filePath, "utf8");
}

async function readTaskDirectories(lessonDirectory) {
  const tasksDirectory = path.join(lessonDirectory, "tasks");
  let entries;

  try {
    entries = await fs.readdir(tasksDirectory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }

  return entries
    .filter(
      (entry) =>
        entry.isDirectory() &&
        !entry.isSymbolicLink() &&
        /^\d{1,4}$/.test(entry.name),
    )
    .sort((left, right) => Number(left.name) - Number(right.name));
}

async function readTasks(lessonDirectory) {
  const tasksDirectory = path.join(lessonDirectory, "tasks");
  const taskDirectories = await readTaskDirectories(lessonDirectory);

  return Promise.all(
    taskDirectories.map(async (taskDirectory) => {
      const task = {};
      const taskPath = path.join(tasksDirectory, taskDirectory.name);
      const entries = await fs.readdir(taskPath, { withFileTypes: true });

      entries.forEach((entry) => {
        if (
          !entry.isFile() ||
          entry.isSymbolicLink() ||
          !allowedTaskFileNames.has(entry.name)
        ) {
          throw new Error(
            `Unsupported lesson task asset: ${path.join(taskPath, entry.name)}`,
          );
        }
      });

      if (!entries.some((entry) => activeTaskFileNames.has(entry.name))) {
        throw new Error(
          `Task has no active HTML, CSS, or JavaScript file: ${taskPath}`,
        );
      }

      await Promise.all(
        Object.entries(taskFiles).map(async ([fileName, fieldName]) => {
          const filePath = path.join(
            tasksDirectory,
            taskDirectory.name,
            fileName,
          );

          try {
            task[fieldName] = await readRegularFile(filePath);
            if (["html", "css", "js"].includes(fieldName)) {
              validateReadonlyBlocks(task[fieldName], fieldName, filePath);
            }
          } catch (error) {
            if (error.code !== "ENOENT") throw error;
          }
        }),
      );

      const evaluationPath = path.join(taskPath, EVALUATION_FILE_NAME);
      try {
        const evaluationSource = await readRegularFile(evaluationPath);
        let evaluation;

        try {
          evaluation = JSON.parse(evaluationSource);
        } catch {
          throw new Error(`Invalid JSON in ${evaluationPath}`);
        }

        task.evaluation = validateEvaluationConfig(evaluation, evaluationPath);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }

      return task;
    }),
  );
}

function createLessonStore(lessonsPath = resolveLessonsPath()) {
  async function readLessonDirectories() {
    const entries = await fs.readdir(lessonsPath, { withFileTypes: true });

    return entries.filter(
      (entry) =>
        entry.isDirectory() &&
        !entry.isSymbolicLink() &&
        lessonSlugPattern.test(entry.name),
    );
  }

  async function readLessonEntry(entry) {
    const lessonDirectory = path.join(lessonsPath, entry.name);
    const indexPath = path.join(lessonDirectory, "index.mdx");
    const source = await readRegularFile(indexPath);
    const { meta, content } = parseLessonMdx(source, indexPath);
    const taskDirectories = await readTaskDirectories(lessonDirectory);

    return {
      lessonDirectory,
      meta: { ...meta, taskCount: taskDirectories.length },
      content,
    };
  }

  async function listLessons() {
    const entries = await readLessonDirectories();
    const lessonEntries = await Promise.all(entries.map(readLessonEntry));
    const lessons = lessonEntries.map((entry) => entry.meta);
    const slugs = new Set();

    lessons.forEach((lesson) => {
      if (slugs.has(lesson.slug)) {
        throw new Error(`Duplicate lesson slug: ${lesson.slug}`);
      }
      slugs.add(lesson.slug);
    });

    return lessons.sort((left, right) => left.order - right.order);
  }

  async function getLesson(slug) {
    if (!lessonSlugPattern.test(slug)) return null;

    const entries = await readLessonDirectories();

    for (const entry of entries) {
      const lessonEntry = await readLessonEntry(entry);

      if (lessonEntry.meta.slug === slug) {
        return {
          lesson: lessonEntry.meta,
          content: lessonEntry.content,
          tasks: await readTasks(lessonEntry.lessonDirectory),
        };
      }
    }

    return null;
  }

  return { lessonsPath, listLessons, getLesson };
}

module.exports = {
  createLessonStore,
  parseLessonMdx,
  resolveLessonsPath,
  validateReadonlyBlocks,
  validateEvaluationConfig,
};
