import type { LessonMeta } from "./getLessons";
import type { TaskCode } from "./getTasks";

const COURSES_KEY = "admin_custom_courses";
const TASKS_KEY_PREFIX = "admin_custom_tasks_";
const DELETED_COURSES_KEY = "admin_deleted_courses";

function emitLessonDraftsChanged() {
  window.dispatchEvent(new Event("adminLessonDraftsChanged"));
}

export function clearAllCustomData() {
  localStorage.removeItem(COURSES_KEY);
  localStorage.removeItem(DELETED_COURSES_KEY);

  const keysToRemove: string[] = [];

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(TASKS_KEY_PREFIX)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => localStorage.removeItem(key));
  emitLessonDraftsChanged();
}

export function getCustomCourses(): LessonMeta[] {
  const data = localStorage.getItem(COURSES_KEY);
  return data ? JSON.parse(data) : [];
}

export function getDeletedCourseSlugs(): string[] {
  const data = localStorage.getItem(DELETED_COURSES_KEY);
  return data ? JSON.parse(data) : [];
}

export function isDeletedCourseDraft(lessonSlug: string) {
  return getDeletedCourseSlugs().includes(lessonSlug);
}

export function markCourseDeleted(lessonSlug: string) {
  const deletedSlugs = getDeletedCourseSlugs();
  if (deletedSlugs.includes(lessonSlug)) return;

  localStorage.setItem(
    DELETED_COURSES_KEY,
    JSON.stringify([...deletedSlugs, lessonSlug]),
  );
  emitLessonDraftsChanged();
}

export function restoreDeletedCourse(lessonSlug: string) {
  const deletedSlugs = getDeletedCourseSlugs();
  const updatedSlugs = deletedSlugs.filter((slug) => slug !== lessonSlug);

  if (updatedSlugs.length === deletedSlugs.length) return;

  if (updatedSlugs.length === 0) {
    localStorage.removeItem(DELETED_COURSES_KEY);
  } else {
    localStorage.setItem(DELETED_COURSES_KEY, JSON.stringify(updatedSlugs));
  }

  emitLessonDraftsChanged();
}

export function saveCustomCourse(course: LessonMeta) {
  const courses = getCustomCourses();
  const index = courses.findIndex((c) => c.slug === course.slug);
  if (index >= 0) {
    courses[index] = course;
  } else {
    courses.push(course);
  }
  localStorage.setItem(COURSES_KEY, JSON.stringify(courses));
  restoreDeletedCourse(course.slug);
  emitLessonDraftsChanged();
}

export function removeCustomCourse(lessonSlug: string) {
  const courses = getCustomCourses();
  const updatedCourses = courses.filter((course) => course.slug !== lessonSlug);

  if (updatedCourses.length === courses.length) return;

  if (updatedCourses.length === 0) {
    localStorage.removeItem(COURSES_KEY);
  } else {
    localStorage.setItem(COURSES_KEY, JSON.stringify(updatedCourses));
  }

  emitLessonDraftsChanged();
}

export function getCustomTasks(lessonSlug: string): Partial<TaskCode>[] {
  const data = localStorage.getItem(TASKS_KEY_PREFIX + lessonSlug);
  return data ? JSON.parse(data) : [];
}

export function saveCustomTasks(
  lessonSlug: string,
  tasks: Partial<TaskCode>[],
) {
  localStorage.setItem(TASKS_KEY_PREFIX + lessonSlug, JSON.stringify(tasks));
  emitLessonDraftsChanged();
}

export function removeCustomTasks(lessonSlug: string) {
  localStorage.removeItem(TASKS_KEY_PREFIX + lessonSlug);
  emitLessonDraftsChanged();
}

export function addCustomTask(lessonSlug: string, task: Partial<TaskCode>) {
  const tasks = getCustomTasks(lessonSlug);
  tasks.push(task);
  saveCustomTasks(lessonSlug, tasks);
}

export function isCustomCourse(slug: string): boolean {
  return getCustomCourses().some((c) => c.slug === slug);
}

export function clearCustomData(lessonSlug: string) {
  localStorage.removeItem(TASKS_KEY_PREFIX + lessonSlug);
  restoreDeletedCourse(lessonSlug);
  const courses = getCustomCourses();
  const updatedCourses = courses.filter((c) => c.slug !== lessonSlug);
  if (updatedCourses.length !== courses.length) {
    if (updatedCourses.length === 0) {
      localStorage.removeItem(COURSES_KEY);
    } else {
      localStorage.setItem(COURSES_KEY, JSON.stringify(updatedCourses));
    }
  }
  emitLessonDraftsChanged();
}
