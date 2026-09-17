import {
  type LessonMeta,
  } from "@/lib/helpers/db.ts";

/**
 * Represents the possible statuses of a lesson draft.
 *
 * This type is used to denote changes made to a lesson draft in comparison
 * to its original state. The statuses are defined as follows:
 */
export type LessonDraftStatus = "added" | "changed" | "deleted" | "unchanged";

/**
 * A type representing a summary of a lesson draft, containing information about its metadata, current status, and any associated changes.
 */
export type LessonDraftSummary = {
  // The metadata associated with the lesson draft.
  lesson: LessonMeta;

  // The current status of the lesson draft.
  status: LessonDraftStatus;

  // A list of changes associated with the lesson draft.
  changes: string[];
};
