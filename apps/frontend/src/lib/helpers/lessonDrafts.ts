import {
  getCustomCourses,
  getCustomTasks,
  isDeletedCourseDraft,
  markCourseDeleted,
  removeCustomCourse,
  removeCustomTasks,
  restoreDeletedCourse,
  saveCustomCourse,
  saveCustomTasks,
} from "./adminStorage";
import { getDefaultLessons, type LessonMeta } from "./getLessons";
import {
  getDefaultLessonTasksSync,
  getLessonTasksSync,
  type TaskCode,
} from "./getTasks";

export type LessonDraftStatus = "added" | "changed" | "deleted" | "unchanged";

export type LessonDraftSummary = {
  lesson: LessonMeta;
  status: LessonDraftStatus;
  changes: string[];
};

const TASK_FIELDS = [
  "html",
  "css",
  "js",
  "solutionHtml",
  "solutionCss",
  "solutionJs",
  "evaluation",
] as const satisfies readonly (keyof TaskCode)[];

function normalizeMeta(meta: LessonMeta): LessonMeta {
  return {
    ...meta,
    hidden: meta.hidden ?? false,
    visualEditor: meta.visualEditor ?? false,
    visualPreview: meta.visualPreview ?? false,
  };
}

function getBuiltLessonMeta(slug: string) {
  return getDefaultLessons().find((lesson) => lesson.slug === slug);
}

function hasCustomCourse(slug: string) {
  return getCustomCourses().some((course) => course.slug === slug);
}

function areMetasEqual(left: LessonMeta, right: LessonMeta) {
  const normalizedLeft = normalizeMeta(left);
  const normalizedRight = normalizeMeta(right);

  return (
    normalizedLeft.title === normalizedRight.title &&
    normalizedLeft.description === normalizedRight.description &&
    normalizedLeft.slug === normalizedRight.slug &&
    normalizedLeft.color === normalizedRight.color &&
    normalizedLeft.order === normalizedRight.order &&
    normalizedLeft.icon === normalizedRight.icon &&
    normalizedLeft.hidden === normalizedRight.hidden &&
    normalizedLeft.visualEditor === normalizedRight.visualEditor &&
    normalizedLeft.visualPreview === normalizedRight.visualPreview
  );
}

function getChangedTaskFiles(
  currentTasks: Partial<TaskCode>[],
  defaultTasks: Partial<TaskCode>[],
) {
  const changedFiles: string[] = [];
  const taskCount = Math.max(currentTasks.length, defaultTasks.length);

  for (let taskIndex = 0; taskIndex < taskCount; taskIndex += 1) {
    const currentTask = currentTasks[taskIndex] ?? {};
    const defaultTask = defaultTasks[taskIndex] ?? {};

    if (currentTask.deleted) {
      changedFiles.push(`task ${taskIndex + 1}/deleted`);
      continue;
    }

    if (!defaultTasks[taskIndex] && currentTasks[taskIndex]) {
      changedFiles.push(`task ${taskIndex + 1}/added`);
      continue;
    }

    TASK_FIELDS.forEach((field) => {
      const currentValue = currentTask[field];
      const defaultValue = defaultTask[field];
      const changed =
        typeof currentValue === "object" || typeof defaultValue === "object"
          ? JSON.stringify(currentValue) !== JSON.stringify(defaultValue)
          : currentValue !== defaultValue;
      if (changed) {
        changedFiles.push(`task ${taskIndex + 1}/${field}`);
      }
    });
  }

  return changedFiles;
}

export function isBuiltLesson(slug: string) {
  return Boolean(getBuiltLessonMeta(slug));
}

export function isAddedLessonDraft(slug: string) {
  return !isBuiltLesson(slug) && hasCustomCourse(slug);
}

export function hasLessonDraft(slug: string) {
  return (
    hasCustomCourse(slug) ||
    getCustomTasks(slug).length > 0 ||
    isDeletedCourseDraft(slug)
  );
}

export function getLessonDraftSummary(lesson: LessonMeta): LessonDraftSummary {
  const builtLesson = getBuiltLessonMeta(lesson.slug);

  if (isDeletedCourseDraft(lesson.slug)) {
    return {
      lesson: {
        ...lesson,
        deleted: true,
      },
      status: "deleted",
      changes: ["Deleted lesson"],
    };
  }

  if (!builtLesson) {
    return {
      lesson,
      status: "added",
      changes: ["New lesson"],
    };
  }

  const changes: string[] = [];

  if (!areMetasEqual(lesson, builtLesson)) {
    changes.push("Metadata");
  }

  const changedTaskFiles = getChangedTaskFiles(
    getLessonTasksSync(lesson.slug),
    getDefaultLessonTasksSync(lesson.slug),
  );

  if (changedTaskFiles.length > 0) {
    changes.push(
      changedTaskFiles.length === 1
        ? "1 task change"
        : `${changedTaskFiles.length} task changes`,
    );
  }

  return {
    lesson,
    status: changes.length > 0 ? "changed" : "unchanged",
    changes,
  };
}

export function getLessonDraftSummaries(lessons: LessonMeta[]) {
  return lessons.map(getLessonDraftSummary);
}

export function hasAnyLessonDraftChanges(lessons: LessonMeta[]) {
  return getLessonDraftSummaries(lessons).some(
    (summary) => summary.status !== "unchanged",
  );
}

export function saveLessonMetadataDraft(lesson: LessonMeta) {
  const builtLesson = getBuiltLessonMeta(lesson.slug);

  if (!builtLesson || !areMetasEqual(lesson, builtLesson)) {
    saveCustomCourse(lesson);
    return;
  }

  removeCustomCourse(lesson.slug);
}

export function deleteLessonDraft(lessonSlug: string) {
  markCourseDeleted(lessonSlug);
}

export function restoreLessonDraft(lessonSlug: string) {
  restoreDeletedCourse(lessonSlug);
}

export function saveLessonTasksDraft(
  lessonSlug: string,
  tasks: Partial<TaskCode>[],
) {
  if (!isBuiltLesson(lessonSlug)) {
    saveCustomTasks(lessonSlug, tasks);
    return;
  }

  const changedTaskFiles = getChangedTaskFiles(
    tasks,
    getDefaultLessonTasksSync(lessonSlug),
  );

  if (changedTaskFiles.length > 0) {
    saveCustomTasks(lessonSlug, tasks);
    return;
  }

  removeCustomTasks(lessonSlug);
}
