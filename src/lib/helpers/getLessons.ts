import type { LessonMeta } from "../types";

const modules = import.meta.glob<{ frontmatter: LessonMeta }>(
  "../../lessons/**/*.mdx",
  {
    eager: true,
  },
);

export function getLessons(): LessonMeta[] {
  return Object.values(modules)
    .map((mod) => mod.frontmatter)
    .sort((a, b) => a.order - b.order);
}
