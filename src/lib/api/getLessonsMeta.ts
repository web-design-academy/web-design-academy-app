import { supabase } from "@/lib/api/supabase";

export interface LessonMeta {
  slug: string;
  title: string;
  description: string;
  color?: string;
}

export async function getLessonsMeta(): Promise<LessonMeta[]> {
  const { data, error } = await supabase
    .from("lessons")
    .select("slug, title, description, color")
    .order("order", { ascending: true });

  if (error) throw error;

  return (data as LessonMeta[]) || [];
}
