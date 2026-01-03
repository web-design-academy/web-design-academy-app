import { getCustomCourses } from "./adminStorage";

export type LessonMeta = {
  title: string;
  description: string;
  slug: string;
  color: string;
  order: number;
  icon: string;
};

const modules = import.meta.glob<{ frontmatter: LessonMeta }>(
  "../../lessons/**/*.mdx",
  {
    eager: true,
  },
);

export function getLessons(): LessonMeta[] {
  const fileLessons = Object.values(modules).map((mod) => mod.frontmatter);
  const customLessons = getCustomCourses();
  const allLessons = [...fileLessons];

  customLessons.forEach((custom) => {
    if (!allLessons.find((l) => l.slug === custom.slug)) {
      allLessons.push(custom);
    }
  });

  return allLessons.sort((a, b) => a.order - b.order);
}
