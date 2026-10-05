import type {LessonMeta} from "@/lib/helpers/db.ts";
import type {TaskCode} from "@/lib/helpers/tasks.ts";

export interface NewLesson {
  lesson: LessonMeta;
  tasks: Partial<TaskCode>[];
  content: string;
}