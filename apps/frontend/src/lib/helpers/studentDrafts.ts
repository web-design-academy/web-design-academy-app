import type { TaskCode } from "./getTasks";

const STUDENT_DRAFT_KEY_PREFIX = "student_lesson_draft_";

type StudentLessonDraft = {
  savedAt: string;
  tasks: Partial<TaskCode>[];
};

const studentDraftKey = (lessonSlug: string, userId?: number | string) =>
  `${STUDENT_DRAFT_KEY_PREFIX}${userId ?? "guest"}_${lessonSlug}`;

export function getStudentLessonDraft(
  lessonSlug: string,
  userId?: number | string,
): StudentLessonDraft | null {
  try {
    const data = localStorage.getItem(studentDraftKey(lessonSlug, userId));
    return data ? (JSON.parse(data) as StudentLessonDraft) : null;
  } catch {
    return null;
  }
}

export function saveStudentLessonDraft(
  lessonSlug: string,
  tasks: Partial<TaskCode>[],
  userId?: number | string,
) {
  const editableTasks = tasks.map((task) => ({
    editableHtml: task.editableHtml,
    editableCss: task.editableCss,
    editableJs: task.editableJs,
  }));

  localStorage.setItem(
    studentDraftKey(lessonSlug, userId),
    JSON.stringify({
      savedAt: new Date().toISOString(),
      tasks: editableTasks,
    } satisfies StudentLessonDraft),
  );
}
