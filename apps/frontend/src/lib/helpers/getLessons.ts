import { getCustomCourses, getDeletedCourseSlugs } from "./adminStorage";
import { fetchLessons } from "@/lib/api/lessons";

export type LessonMeta = {
  title: string;
  description: string;
  slug: string;
  sourceFolder?: string;
  color: string;
  order: number;
  icon: string;
  hidden?: boolean;
  visualEditor?: boolean;
  visualPreview?: boolean;
  deleted?: boolean;
  taskCount?: number;
};

let defaultLessons: LessonMeta[] = [];
const defaultLessonContent = new Map<string, string>();

function normalizeLessonMeta(meta: LessonMeta): LessonMeta {
  return {
    hidden: false,
    visualEditor: false,
    visualPreview: false,
    ...meta,
  };
}

export function setDefaultLessons(lessons: LessonMeta[]) {
  defaultLessons = lessons.map(normalizeLessonMeta);
}

export async function loadLessons() {
  setDefaultLessons(await fetchLessons());
  return getAllLessons();
}

export function setDefaultLessonContent(slug: string, content: string) {
  defaultLessonContent.set(slug, content);
}

export function getLessonContent(slug: string) {
  return defaultLessonContent.get(slug);
}

export function getAllLessons(): LessonMeta[] {
  const fileLessons = getDefaultLessons();
  const customLessons = getCustomCourses();
  const deletedSlugs = new Set(getDeletedCourseSlugs());
  const customLessonsBySlug = new Map(
    customLessons.map((lesson) => [lesson.slug, normalizeLessonMeta(lesson)]),
  );
  const allLessons = fileLessons.map((lesson) => ({
    ...lesson,
    ...customLessonsBySlug.get(lesson.slug),
    deleted: deletedSlugs.has(lesson.slug),
  }));

  customLessons.forEach((custom) => {
    if (!allLessons.find((l) => l.slug === custom.slug)) {
      allLessons.push({
        ...normalizeLessonMeta(custom),
        deleted: deletedSlugs.has(custom.slug),
      });
    }
  });

  return allLessons.sort((a, b) => a.order - b.order);
}

export function getDefaultLessons(): LessonMeta[] {
  return defaultLessons.map((lesson) => ({ ...lesson }));
}

export function getLessons(): LessonMeta[] {
  return getAllLessons().filter((lesson) => !lesson.hidden && !lesson.deleted);
}

export function getLessonMeta(slug: string): LessonMeta | undefined {
  return getAllLessons().find((lesson) => lesson.slug === slug);
}
