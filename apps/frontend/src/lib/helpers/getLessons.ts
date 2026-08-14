import { getCustomCourses, getDeletedCourseSlugs } from "./adminStorage";

export type LessonMeta = {
  title: string;
  description: string;
  slug: string;
  sourceFolder?: string;
  color: string;
  order: number;
  icon: string;
  hidden?: boolean;
  deleted?: boolean;
};

const modules = import.meta.glob<{ frontmatter: LessonMeta }>(
  "../../lessons/**/*.mdx",
  {
    eager: true,
  },
);

function normalizeLessonMeta(meta: LessonMeta): LessonMeta {
  return {
    hidden: false,
    ...meta,
  };
}

function getSourceFolderFromPath(path: string) {
  return path.match(/lessons[\\/]([^\\/]+)[\\/]index\.mdx$/)?.[1];
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
  return Object.entries(modules)
    .map(([path, mod]) =>
      normalizeLessonMeta({
        ...mod.frontmatter,
        sourceFolder: getSourceFolderFromPath(path),
      }),
    )
    .sort((a, b) => a.order - b.order);
}

export function getLessons(): LessonMeta[] {
  return getAllLessons().filter((lesson) => !lesson.hidden && !lesson.deleted);
}

export function getLessonMeta(slug: string): LessonMeta | undefined {
  return getAllLessons().find((lesson) => lesson.slug === slug);
}

export function getLessonSourceFolder(slug: string) {
  return getDefaultLessons().find((lesson) => lesson.slug === slug)
    ?.sourceFolder;
}
