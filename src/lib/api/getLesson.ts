import { supabase } from "@/lib/api/supabase";
import type { TaskCode } from "@/lib/helpers/getTasks";

export interface LessonBackend {
  mdxContent: string;
  tasks: Partial<TaskCode>[];
}

export async function getLessonBackend(slug: string): Promise<LessonBackend> {
  const { data: lessonData, error: lessonError } = await supabase
    .from("lessons")
    .select("mdx_content")
    .eq("slug", slug)
    .single();

  if (lessonError) throw lessonError;

  const { data: tasksData, error: tasksError } = await supabase
    .from("tasks")
    .select("task_code")
    .eq("lesson_slug", slug)
    .order("order", { ascending: true });

  if (tasksError) throw tasksError;

  const tasks = tasksData?.map((t) => t.task_code) || [];
  return { mdxContent: lessonData.mdx_content, tasks };
}
