import { getCustomTasks } from "./adminStorage";
import {
  ensureReadonlyBlockSpacing,
  getReadonlyMarkers,
  type TaskLanguage,
} from "./readonlyBlocks";

export type EvaluationLevel = "error" | "warning" | "recommendation";
export type EvaluationCheckType =
  | "forbidden-property"
  | "required-property"
  | "exists"
  | "exact-match"
  | "regex-match"
  | "min-count"
  | "max-count"
  | "forbidden-value";

export interface EvaluationCheck {
  id: string;
  type: EvaluationCheckType;
  selector: string;
  property: string;
  value?: string | number;
  media?: string;
  level?: EvaluationLevel;
  message?: string;
  studentHint?: string;
}

export interface CssEvaluationConfig {
  version: 1;
  engine: "css";
  targetSelectors: string[];
  checks: EvaluationCheck[];
  hintTimeoutSeconds?: number;
  pass?: {
    minimumScore?: number;
    requireNoErrors?: boolean;
  };
}

export interface TaskCode {
  html: string;
  css: string;
  js: string;
  solutionHtml?: string;
  solutionCss?: string;
  solutionJs?: string;
  evaluation?: CssEvaluationConfig;
  deleted?: boolean;
}

const defaultTasksByLesson = new Map<string, Partial<TaskCode>[]>();

type LegacyTaskCode = Partial<TaskCode> &
  Partial<
    Record<
      | "editableHtml"
      | "editableCss"
      | "editableJs"
      | "readonlyHtml"
      | "readonlyCss"
      | "readonlyJs"
      | "hiddenHtml"
      | "hiddenCss"
      | "hiddenJs",
      string
    >
  >;

const legacyFieldSuffix = {
  html: "Html",
  css: "Css",
  js: "Js",
} as const;

export function mergeLegacyEditableSource(
  defaultSource: string | undefined,
  editableSource: string,
  language: TaskLanguage,
) {
  if (!defaultSource) return editableSource;

  const { start, end } = getReadonlyMarkers(language);
  if (editableSource.includes(start)) return editableSource;

  const lastEndIndex = defaultSource.lastIndexOf(end);
  if (lastEndIndex < 0) return editableSource;

  const protectedPrefix = defaultSource.slice(0, lastEndIndex + end.length);
  const remainingDefault = defaultSource
    .slice(lastEndIndex + end.length)
    .trim();

  const merged = remainingDefault
    ? `${protectedPrefix}\n${editableSource.replace(/^\s+/, "")}`
    : defaultSource;

  return ensureReadonlyBlockSpacing(merged, language);
}

export function normalizeTaskCode(
  task: LegacyTaskCode,
  fallback: Partial<TaskCode> = {},
): Partial<TaskCode> {
  const normalized: Partial<TaskCode> = {};

  if (task.solutionHtml !== undefined)
    normalized.solutionHtml = task.solutionHtml;
  if (task.solutionCss !== undefined) normalized.solutionCss = task.solutionCss;
  if (task.solutionJs !== undefined) normalized.solutionJs = task.solutionJs;
  if (task.evaluation !== undefined) normalized.evaluation = task.evaluation;
  if (task.deleted !== undefined) normalized.deleted = task.deleted;

  (["html", "css", "js"] as const).forEach((language) => {
    if (task[language] !== undefined) {
      normalized[language] = ensureReadonlyBlockSpacing(
        task[language],
        language,
      );
      return;
    }

    const suffix = legacyFieldSuffix[language];
    const hidden = task[`hidden${suffix}`];
    const readonly = task[`readonly${suffix}`];
    const editable = task[`editable${suffix}`];
    const hasLegacySource =
      hidden !== undefined || readonly !== undefined || editable !== undefined;

    if (!hasLegacySource) return;

    const protectedSource = [hidden, readonly]
      .filter((source): source is string => Boolean(source?.trim()))
      .join("\n");

    if (protectedSource) {
      const { start, end } = getReadonlyMarkers(language);
      normalized[language] = ensureReadonlyBlockSpacing(
        [
          `${start}\n${protectedSource.replace(/\s+$/, "")}\n${end}`,
          editable?.replace(/^\s+/, ""),
        ]
          .filter((source): source is string => source !== undefined)
          .join("\n"),
        language,
      );
      return;
    }

    normalized[language] = mergeLegacyEditableSource(
      fallback[language],
      editable ?? "",
      language,
    );
  });

  return normalized;
}

export function setDefaultLessonTasks(
  lessonSlug: string,
  tasks: Partial<TaskCode>[],
) {
  defaultTasksByLesson.set(
    lessonSlug,
    tasks.map((task) => normalizeTaskCode(task) as Partial<TaskCode>),
  );
}

export function getDefaultLessonTasksSync(
  lessonSlug: string,
): Partial<TaskCode>[] {
  return (defaultTasksByLesson.get(lessonSlug) ?? []).map((task) => ({
    ...task,
  }));
}

export function getLessonTasksSync(lessonSlug: string): Partial<TaskCode>[] {
  const fileTasks = getDefaultLessonTasksSync(lessonSlug);

  const customTasks = getCustomTasks(lessonSlug);

  if (customTasks.length > 0) {
    return customTasks.map((customTask, index) => ({
      ...fileTasks[index],
      ...normalizeTaskCode(customTask as LegacyTaskCode, fileTasks[index]),
    }));
  }

  return fileTasks;
}
