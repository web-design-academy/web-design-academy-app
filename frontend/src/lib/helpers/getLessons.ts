import { getCustomCourses } from "./adminStorage";

export type LessonMeta = {
  title: string;
  description: string;
  slug: string;
  color: string;
  order: number;
  icon: string;
  hidden?: boolean;
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

export function getAllLessons(): LessonMeta[] {
  const fileLessons = Object.values(modules).map((mod) =>
    normalizeLessonMeta(mod.frontmatter),
  );
  const customLessons = getCustomCourses();
  const allLessons = [...fileLessons];

  customLessons.forEach((custom) => {
    if (!allLessons.find((l) => l.slug === custom.slug)) {
      allLessons.push(normalizeLessonMeta(custom));
    }
  });

  return allLessons.sort((a, b) => a.order - b.order);
}

export function getLessons(): LessonMeta[] {
  return getAllLessons().filter((lesson) => !lesson.hidden);
}

export function getLessonMeta(slug: string): LessonMeta | undefined {
  return getAllLessons().find((lesson) => lesson.slug === slug);
}
