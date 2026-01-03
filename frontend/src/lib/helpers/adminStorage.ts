import type { LessonMeta } from "./getLessons";
import type { TaskCode } from "./getTasks";

const COURSES_KEY = "admin_custom_courses";
const TASKS_KEY_PREFIX = "admin_custom_tasks_";

export function getCustomCourses(): LessonMeta[] {
  const data = localStorage.getItem(COURSES_KEY);
  return data ? JSON.parse(data) : [];
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
  const courses = getCustomCourses();
  const updatedCourses = courses.filter((c) => c.slug !== lessonSlug);
  if (updatedCourses.length !== courses.length) {
    localStorage.setItem(COURSES_KEY, JSON.stringify(updatedCourses));
  }
}
