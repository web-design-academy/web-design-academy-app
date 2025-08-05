import type { LessonMeta } from "../types";

interface LessonModule {
  frontmatter?: Partial<Omit<LessonMeta, "slug">>;
}

const modules = import.meta.glob<LessonModule>("../../lessons/*.mdx", {
  eager: true,
});

export function getLessons(): LessonMeta[] {
  return Object.entries(modules).map(([path, mod]) => {
    const slug = path.split("/").pop()?.replace(".mdx", "") ?? "";

    return {
      slug,
      title: mod.frontmatter?.title ?? slug,
      description: mod.frontmatter?.description ?? "",
    };
  });
}
