import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as LucideIcons from "lucide-react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BookOpen,
  Download,
  Edit3,
  ExternalLink,
  GripVertical,
  Plus,
  RotateCcw,
  Search,
  Send,
  Tags,
  Trash2,
  Undo2,
  Users,
  X,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HexColorPicker } from "react-colorful";
import { converter, formatHex, parse } from "culori";
import { Link, useNavigate } from "react-router";
import LoadingSpinner from "@/components/LoadingSpinner";
import LessonIcon from "@/components/LessonIcon";
import Modal from "@/components/Modal";
import Pagination from "@/components/Pagination";
import { useAuth } from "@/lib/ctx/useAuth";
import {
  addTagToUsers,
  addUserTag,
  deleteTag,
  type AdminTag,
  fetchAdminTags,
  fetchAdminUsers,
  removeTagFromUsers,
  removeUserTag,
  type AdminUser,
} from "@/lib/api/admin";
import {
  fetchSubmissions,
  type PaginatedResponse,
  type SubmissionRecord,
} from "@/lib/api/submissions";
import { addCustomTask, clearAllCustomData } from "@/lib/helpers/adminStorage";
import {
  deleteLessonDraft,
  getLessonDraftSummaries,
  hasAnyLessonDraftChanges,
  restoreLessonDraft,
  saveLessonMetadataDraft,
  type LessonDraftSummary,
} from "@/lib/helpers/lessonDrafts";
import { getAllLessons, type LessonMeta } from "@/lib/helpers/getLessons";
import { getLessonTasksSync } from "@/lib/helpers/getTasks";
import { generateCoursesZip } from "@/lib/helpers/zipGenerator";
import { isOnlineMode } from "@/lib/config/appMode";
import "@/styles/admin.css";

const PAGE_SIZE = 12;
const LESSON_COLOR_OPTIONS = [
  "oklch(64.6% 0.222 41.116)",
  "oklch(54.6% 0.245 262.881)",
  "oklch(79.5% 0.184 86.047)",
  "oklch(58.6% 0.253 17.585)",
  "oklch(55.8% 0.288 302.321)",
  "oklch(60% 0.18 170)",
  "oklch(62% 0.16 230)",
  "oklch(68% 0.2 130)",
];

const DEFAULT_ICON = "Code";
const DEFAULT_OKLCH = { lightness: 64.6, chroma: 0.222, hue: 41.116 };
const toOklch = converter("oklch");

type AdminSection = "lessons" | "users" | "submissions";
type LessonForm = Omit<LessonMeta, "slug" | "order">;
type TagDraft = Record<string, { tagId: string; name: string }>;
type UserTag = AdminUser["tags"][number];
type SortDirection = "asc" | "desc";
type UserSortKey = "id" | "user" | "role" | "joined";
type SubmissionSortKey = "id" | "user" | "lesson" | "submitted";
type SortState<T extends string> = {
  key: T | null;
  direction: SortDirection | null;
};
const POPOVER_BOUNDARY_SELECTOR = ".admin-popover-boundary";

const ALL_LUCIDE_ICON_NAMES = Object.entries(LucideIcons)
  .filter(([name, value]) => {
    if (!/^[A-Z]/.test(name)) return false;
    if (name === "Icon" || name.startsWith("Lucide") || name.endsWith("Icon")) {
      return false;
    }

    return value !== null && ["function", "object"].includes(typeof value);
  })
  .map(([name]) => name)
  .sort((left, right) => left.localeCompare(right));

function formatNumber(value: number, maxFractionDigits: number) {
  return Number(value.toFixed(maxFractionDigits)).toString();
}

function formatOklchColor({
  lightness,
  chroma,
  hue,
}: {
  lightness: number;
  chroma: number;
  hue: number;
}) {
  return `oklch(${formatNumber(lightness, 1)}% ${formatNumber(
    chroma,
    3,
  )} ${formatNumber(hue, 3)})`;
}

function hexFromOklch(value: string) {
  const parsedColor = parse(value);
  return parsedColor ? formatHex(parsedColor) : "#f54900";
}

function oklchFromHex(value: string) {
  const oklchColor = toOklch(value);

  if (!oklchColor) {
    return formatOklchColor(DEFAULT_OKLCH);
  }

  return formatOklchColor({
    lightness: oklchColor.l * 100,
    chroma: oklchColor.c,
    hue: oklchColor.h ?? 0,
  });
}

function parseOklchColor(value: string) {
  const match = value.match(
    /oklch\(\s*([\d.]+)%?\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*\)/i,
  );

  if (!match) return DEFAULT_OKLCH;

  return {
    lightness: Number(match[1]),
    chroma: Number(match[2]),
    hue: Number(match[3]),
  };
}

function slugifyTitle(title: string) {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function emptyForm(): LessonForm {
  return {
    title: "",
    description: "",
    color: LESSON_COLOR_OPTIONS[0],
    icon: DEFAULT_ICON,
    hidden: false,
  };
}

function SortableHeader<T extends string>({
  label,
  column,
  sort,
  onSortChange,
}: {
  label: string;
  column: T;
  sort: SortState<T>;
  onSortChange: (sort: SortState<T>) => void;
}) {
  const isActive = sort.key === column;
  const Icon = isActive
    ? sort.direction === "asc"
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;
  const nextSort: SortState<T> =
    !isActive || sort.direction === null
      ? { key: column, direction: "asc" }
      : sort.direction === "asc"
        ? { key: column, direction: "desc" }
        : { key: null, direction: null };

  return (
    <button
      type="button"
      className={`admin-sort-header ${isActive ? "is-active" : ""}`}
      onClick={() => onSortChange(nextSort)}
      aria-label={`Sort by ${label} ${
        isActive && sort.direction === "asc"
          ? "descending"
          : isActive && sort.direction === "desc"
            ? "without sorting"
            : "ascending"
      }`}
    >
      <span>{label}</span>
      <Icon size={14} aria-hidden="true" />
    </button>
  );
}

function SortableLessonCard({
  lesson,
  summary,
  onEdit,
  onDelete,
  onRestore,
}: {
  lesson: LessonMeta;
  summary: LessonDraftSummary;
  onEdit: (lesson: LessonMeta) => void;
  onDelete: (lesson: LessonMeta) => void;
  onRestore: (lesson: LessonMeta) => void;
}) {
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lesson.slug });

  return (
    <article
      ref={setNodeRef}
      className={`admin-lesson-card ${isDragging ? "is-dragging" : ""}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        className="admin-lesson-drag-handle"
        aria-label={`Reorder ${lesson.title}`}
        {...attributes}
        {...listeners}
      >
        <span className="admin-lesson-order-number">{lesson.order}</span>
        <GripVertical
          className="admin-lesson-order-drag-icon"
          size={24}
          aria-hidden="true"
        />
      </button>
      <div
        className="admin-lesson-icon"
        style={{ backgroundColor: lesson.color }}
      >
        <LessonIcon name={lesson.icon} size={24} />
      </div>
      <div className="admin-lesson-main">
        <div className="admin-lesson-title-row">
          <h2>{lesson.title}</h2>
          {lesson.hidden && <span className="admin-tag">Hidden</span>}
          {summary.status !== "unchanged" && (
            <span className={`admin-change-tag is-${summary.status}`}>
              {summary.status === "added"
                ? "Added"
                : summary.status === "deleted"
                  ? "Deleted"
                  : "Changed"}
            </span>
          )}
        </div>
        <p className="admin-lesson-description">{lesson.description}</p>
        {summary.changes.length > 0 && (
          <p className="admin-lesson-change-line">
            {summary.changes.join(", ")}
          </p>
        )}
      </div>
      <div className="admin-lesson-card-actions">
        <button
          type="button"
          className="admin-icon-button"
          onClick={() => onEdit(lesson)}
          aria-label={`Edit metadata for ${lesson.title}`}
          title="Edit metadata"
        >
          <Edit3 size={16} />
        </button>
        {summary.status === "deleted" ? (
          <button
            type="button"
            className="admin-icon-button"
            onClick={() => onRestore(lesson)}
            aria-label={`Restore ${lesson.title}`}
            title="Restore"
          >
            <Undo2 size={16} />
          </button>
        ) : (
          <button
            type="button"
            className="admin-icon-button"
            onClick={() => onDelete(lesson)}
            aria-label={`Delete ${lesson.title}`}
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        )}
        <Link
          to={`/lessons/${lesson.slug}`}
          className="admin-icon-button"
          aria-label={`Open ${lesson.title}`}
          title="Open lesson"
        >
          <ExternalLink size={16} />
        </Link>
      </div>
    </article>
  );
}

function LessonDragOverlayCard({
  lesson,
  width,
}: {
  lesson: LessonMeta;
  width: number | null;
}) {
  return (
    <article
      className="admin-lesson-card admin-lesson-card-overlay"
      style={width ? { width } : undefined}
    >
      <div className="admin-lesson-drag-handle" aria-hidden="true">
        <GripVertical
          className="admin-lesson-order-drag-icon"
          size={24}
          aria-hidden="true"
        />
      </div>
      <div
        className="admin-lesson-icon"
        style={{ backgroundColor: lesson.color }}
      >
        <LessonIcon name={lesson.icon} size={24} />
      </div>
      <div className="admin-lesson-main">
        <div className="admin-lesson-title-row">
          <h2>{lesson.title}</h2>
          {lesson.hidden && <span className="admin-tag">Hidden</span>}
        </div>
        <p className="admin-lesson-description">{lesson.description}</p>
      </div>
      <div className="admin-lesson-card-actions" aria-hidden="true">
        <span className="admin-icon-button">
          <Edit3 size={16} />
        </span>
        <span className="admin-icon-button">
          <Trash2 size={16} />
        </span>
        <span className="admin-icon-button">
          <ExternalLink size={16} />
        </span>
      </div>
    </article>
  );
}

function TagFilter({
  value,
  onChange,
  tags,
}: {
  value: number | "";
  onChange: (value: number | "") => void;
  tags: { id: number; name: string; user_count?: number }[];
}) {
  return (
    <label className="admin-filter">
      <select
        className="form-select-control"
        value={value}
        onChange={(event) =>
          onChange(event.target.value ? Number(event.target.value) : "")
        }
      >
        <option value="">All tags</option>
        {tags.map((tag) => (
          <option key={tag.id} value={tag.id}>
            {tag.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function SelectAllCheckbox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: (checked: boolean) => void;
}) {
  const checkboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      ref={checkboxRef}
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      aria-label="Select all visible users"
    />
  );
}

function UserTagPopover({
  tags,
  assignedTagIds,
  draftName,
  isPending,
  availableLabel = "Available tags",
  onSelectExisting,
  onDeleteTag,
  onDraftNameChange,
  onCreateTag,
}: {
  tags: AdminTag[];
  assignedTagIds: Set<number>;
  draftName: string;
  isPending: boolean;
  availableLabel?: string;
  onSelectExisting: (tagId: number) => void;
  onDeleteTag: (tagId: number) => void;
  onDraftNameChange: (value: string) => void;
  onCreateTag: () => void;
}) {
  const availableTags = tags.filter((tag) => !assignedTagIds.has(tag.id));

  return (
    <div className="lesson-picker-popover admin-tag-popover" role="dialog">
      <div className="admin-tag-popover-section">
        <div className="admin-tag-popover-heading">{availableLabel}</div>
        <div className="admin-tag-popover-list">
          {availableTags.length ? (
            availableTags.map((tag) => (
              <span key={tag.id} className="admin-tag-choice-wrap">
                <button
                  type="button"
                  className="admin-tag-choice"
                  disabled={isPending}
                  onClick={() => onSelectExisting(tag.id)}
                >
                  {tag.name}
                </button>
                <button
                  type="button"
                  className="admin-tag-delete-button"
                  onClick={() => onDeleteTag(tag.id)}
                  disabled={isPending}
                  aria-label={`Delete ${tag.name} tag from database`}
                >
                  <X size={12} />
                </button>
              </span>
            ))
          ) : tags.length ? (
            <span className="admin-muted">All saved tags are added</span>
          ) : (
            <span className="admin-muted">No saved tags</span>
          )}
        </div>
      </div>
      <div className="admin-new-tag-row">
        <input
          value={draftName}
          onChange={(event) => onDraftNameChange(event.target.value)}
          placeholder="New tag"
        />
        <button
          type="button"
          className="admin-row-button"
          onClick={onCreateTag}
          disabled={isPending || !draftName.trim()}
        >
          Add
        </button>
      </div>
    </div>
  );
}

function CompactTags({
  tags,
  canRemove = false,
  showAll = false,
  expanded,
  onToggleExpanded,
  onRemove,
  children,
}: {
  tags: UserTag[];
  canRemove?: boolean;
  showAll?: boolean;
  expanded?: boolean;
  onToggleExpanded?: () => void;
  onRemove?: (tagId: number) => void;
  children?: ReactNode;
}) {
  if (!tags.length) {
    return (
      <div className="admin-tags">
        <span className="admin-muted">No tags</span>
        {children}
      </div>
    );
  }

  const visibleTags = showAll ? tags : tags.slice(0, 1);
  const hiddenTags = showAll ? [] : tags.slice(1);

  const renderTag = (tag: UserTag) =>
    canRemove && onRemove ? (
      <span key={tag.id} className="admin-tag-choice-wrap">
        <span className="admin-tag-choice admin-tag-choice-label">
          {tag.name}
        </span>
        <button
          type="button"
          className="admin-tag-delete-button"
          onClick={() => onRemove(tag.id)}
          aria-label={`Remove ${tag.name}`}
        >
          <X size={12} />
        </button>
      </span>
    ) : (
      <span key={tag.id} className="admin-tag">
        {tag.name}
      </span>
    );

  return (
    <div className="admin-tags">
      {children}
      {visibleTags.map((tag) => renderTag(tag))}
      {hiddenTags.length > 0 && (
        <span className="admin-more-tags-anchor admin-popover-boundary">
          <button
            type="button"
            className="admin-more-tags-button"
            onClick={onToggleExpanded}
            aria-expanded={expanded}
          >
            {hiddenTags.length} more
          </button>
          {expanded && (
            <div className="lesson-picker-popover admin-hidden-tags-popover">
              <div className="admin-hidden-tags-list">
                {hiddenTags.map((tag) => renderTag(tag))}
              </div>
            </div>
          )}
        </span>
      )}
    </div>
  );
}

export default function AdminPage() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeSection, setActiveSection] = useState<AdminSection>("lessons");
  const [lessons, setLessons] = useState<LessonMeta[]>(() => getAllLessons());
  const [lessonModalMode, setLessonModalMode] = useState<"create" | "edit">(
    "create",
  );
  const [editingLesson, setEditingLesson] = useState<LessonMeta | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  const [hasTouchedTitle, setHasTouchedTitle] = useState(false);
  const [iconSearch, setIconSearch] = useState("");
  const [formData, setFormData] = useState<LessonForm>(emptyForm);
  const [userPage, setUserPage] = useState(1);
  const [submissionPage, setSubmissionPage] = useState(1);
  const [userSort, setUserSort] = useState<SortState<UserSortKey>>({
    key: null,
    direction: null,
  });
  const [submissionSort, setSubmissionSort] = useState<
    SortState<SubmissionSortKey>
  >({
    key: null,
    direction: null,
  });
  const [userTagFilter, setUserTagFilter] = useState<number | "">("");
  const [submissionTagFilter, setSubmissionTagFilter] = useState<number | "">(
    "",
  );
  const [tagDrafts, setTagDrafts] = useState<TagDraft>({});
  const [bulkTagDraft, setBulkTagDraft] = useState({ tagId: "", name: "" });
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [isBulkTagPopoverOpen, setIsBulkTagPopoverOpen] = useState(false);
  const [openTagPopoverUserId, setOpenTagPopoverUserId] = useState<
    string | null
  >(null);
  const [openMoreTagsKey, setOpenMoreTagsKey] = useState<string | null>(null);
  const [orderedLessons, setOrderedLessons] = useState<LessonMeta[]>(() =>
    getAllLessons(),
  );
  const [activeLessonSlug, setActiveLessonSlug] = useState<string | null>(null);
  const [activeLessonWidth, setActiveLessonWidth] = useState<number | null>(
    null,
  );
  const [isDownloadingLessonChanges, setIsDownloadingLessonChanges] =
    useState(false);

  const closePopovers = useCallback(() => {
    setIsColorPickerOpen(false);
    setIsIconPickerOpen(false);
    setIsBulkTagPopoverOpen(false);
    setOpenTagPopoverUserId(null);
    setOpenMoreTagsKey(null);
  }, []);

  useEffect(() => {
    if (!authLoading && user?.role !== "admin") {
      navigate("/");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const refreshLessonDrafts = () => setLessons(getAllLessons());

    window.addEventListener("adminLessonDraftsChanged", refreshLessonDrafts);
    window.addEventListener("storage", refreshLessonDrafts);

    return () => {
      window.removeEventListener(
        "adminLessonDraftsChanged",
        refreshLessonDrafts,
      );
      window.removeEventListener("storage", refreshLessonDrafts);
    };
  }, []);

  useEffect(() => setUserPage(1), [userTagFilter]);
  useEffect(() => setSubmissionPage(1), [submissionTagFilter]);

  const updateUserSort = useCallback((sort: SortState<UserSortKey>) => {
    setUserSort(sort);
    setUserPage(1);
  }, []);

  const updateSubmissionSort = useCallback(
    (sort: SortState<SubmissionSortKey>) => {
      setSubmissionSort(sort);
      setSubmissionPage(1);
    },
    [],
  );

  useEffect(() => {
    const hasOpenPopover =
      isColorPickerOpen ||
      isIconPickerOpen ||
      isBulkTagPopoverOpen ||
      openTagPopoverUserId !== null ||
      openMoreTagsKey !== null;

    if (!hasOpenPopover) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (
        target instanceof Element &&
        target.closest(POPOVER_BOUNDARY_SELECTOR)
      ) {
        return;
      }

      closePopovers();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePopovers();
      }
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [
    closePopovers,
    isBulkTagPopoverOpen,
    isColorPickerOpen,
    isIconPickerOpen,
    openMoreTagsKey,
    openTagPopoverUserId,
  ]);

  useEffect(() => {
    setOrderedLessons(lessons);
  }, [lessons]);

  const displayedLessons = orderedLessons;
  const lessonIds = useMemo(
    () => displayedLessons.map((lesson) => lesson.slug),
    [displayedLessons],
  );
  const lessonDragSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const activeDraggedLesson = useMemo(
    () =>
      displayedLessons.find((lesson) => lesson.slug === activeLessonSlug) ??
      null,
    [activeLessonSlug, displayedLessons],
  );
  const lessonDraftSummaries = useMemo(
    () => getLessonDraftSummaries(displayedLessons),
    [displayedLessons],
  );
  const lessonDraftSummariesBySlug = useMemo(
    () =>
      new Map(
        lessonDraftSummaries.map((summary) => [summary.lesson.slug, summary]),
      ),
    [lessonDraftSummaries],
  );
  const changedLessonSummaries = useMemo(
    () =>
      lessonDraftSummaries.filter((summary) => summary.status !== "unchanged"),
    [lessonDraftSummaries],
  );
  const hasLessonChanges = useMemo(
    () => hasAnyLessonDraftChanges(displayedLessons),
    [displayedLessons],
  );
  const generatedSlug = useMemo(
    () => slugifyTitle(formData.title),
    [formData.title],
  );

  const titleValidationError = useMemo(() => {
    if (!formData.title.trim()) return "Title is required.";

    if (lessonModalMode === "edit") return "";

    if (!generatedSlug)
      return "Title must contain at least one letter or number.";

    const slugExists = lessons.some(
      (lesson) =>
        lesson.slug === generatedSlug && lesson.slug !== editingLesson?.slug,
    );
    return slugExists ? "A lesson with this title already exists." : "";
  }, [
    editingLesson?.slug,
    formData.title,
    generatedSlug,
    lessonModalMode,
    lessons,
  ]);

  const currentOklchColor = useMemo(
    () => parseOklchColor(formData.color),
    [formData.color],
  );
  const currentHexColor = useMemo(
    () => hexFromOklch(formData.color),
    [formData.color],
  );
  const filteredIconNames = useMemo(() => {
    const normalizedSearch = iconSearch.trim().toLowerCase();
    if (!normalizedSearch) return ALL_LUCIDE_ICON_NAMES;

    return ALL_LUCIDE_ICON_NAMES.filter((name) =>
      name.toLowerCase().includes(normalizedSearch),
    );
  }, [iconSearch]);

  const { data: tags = [], error: tagsError } = useQuery({
    queryKey: ["admin-tags"],
    queryFn: fetchAdminTags,
    enabled: isOnlineMode && user?.role === "admin",
  });

  const {
    data: usersData,
    isLoading: usersLoading,
    error: usersError,
  } = useQuery({
    queryKey: ["admin-users", userPage, userTagFilter, userSort],
    queryFn: () =>
      fetchAdminUsers({
        page: userPage,
        pageSize: PAGE_SIZE,
        tagId: userTagFilter,
        sortBy: userSort.key ?? undefined,
        sortDirection: userSort.direction ?? undefined,
      }),
    enabled: isOnlineMode && user?.role === "admin",
  });

  const {
    data: submissionsData,
    isLoading: submissionsLoading,
    error: submissionsError,
  } = useQuery({
    queryKey: [
      "submissions",
      submissionPage,
      submissionTagFilter,
      submissionSort,
    ],
    queryFn: async () =>
      (await fetchSubmissions({
        page: submissionPage,
        pageSize: PAGE_SIZE,
        tagId: submissionTagFilter,
        sortBy: submissionSort.key ?? undefined,
        sortDirection: submissionSort.direction ?? undefined,
      })) as PaginatedResponse<SubmissionRecord>,
    enabled: isOnlineMode && user?.role === "admin",
  });

  const visibleUsers = useMemo(
    () => usersData?.items ?? [],
    [usersData?.items],
  );
  const visibleUserIds = useMemo(
    () => visibleUsers.map((visibleUser) => visibleUser.id),
    [visibleUsers],
  );
  const selectedVisibleUsers = useMemo(
    () =>
      visibleUsers.filter((visibleUser) => selectedUserIds.has(visibleUser.id)),
    [selectedUserIds, visibleUsers],
  );
  const selectedVisibleUserIds = useMemo(
    () => selectedVisibleUsers.map((selectedUser) => selectedUser.id),
    [selectedVisibleUsers],
  );
  const selectedVisibleCount = selectedVisibleUserIds.length;
  const isAllVisibleUsersSelected =
    visibleUserIds.length > 0 &&
    visibleUserIds.every((visibleUserId) => selectedUserIds.has(visibleUserId));
  const isSomeVisibleUsersSelected =
    selectedVisibleCount > 0 && !isAllVisibleUsersSelected;
  const commonSelectedTags = useMemo(() => {
    if (!selectedVisibleUsers.length) return [];

    const commonTagIds = selectedVisibleUsers.reduce<Set<number> | null>(
      (commonIds, selectedUser) => {
        const userTagIds = new Set(selectedUser.tags.map((tag) => tag.id));

        if (!commonIds) return userTagIds;

        return new Set([...commonIds].filter((tagId) => userTagIds.has(tagId)));
      },
      null,
    );

    if (!commonTagIds) return [];

    return tags.filter((tag) => commonTagIds.has(tag.id));
  }, [selectedVisibleUsers, tags]);
  const commonSelectedTagIds = useMemo(
    () => new Set(commonSelectedTags.map((tag) => tag.id)),
    [commonSelectedTags],
  );

  const addTagMutation = useMutation({
    mutationFn: ({
      userId,
      tagId,
      name,
    }: {
      userId: string;
      tagId?: number | "";
      name?: string;
    }) => addUserTag(userId, { tagId, name }),
    onSuccess: (_data, variables) => {
      setTagDrafts((prev) => ({
        ...prev,
        [variables.userId]: { tagId: "", name: "" },
      }));
      setOpenTagPopoverUserId(null);
      queryClient.invalidateQueries({ queryKey: ["admin-tags"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
    },
  });

  const removeTagMutation = useMutation({
    mutationFn: ({ userId, tagId }: { userId: string; tagId: number }) =>
      removeUserTag(userId, tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tags"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
    },
  });

  const bulkAddTagMutation = useMutation({
    mutationFn: ({
      userIds,
      tagId,
      name,
    }: {
      userIds: string[];
      tagId?: number | "";
      name?: string;
    }) => addTagToUsers(userIds, { tagId, name }),
    onSuccess: () => {
      setBulkTagDraft({ tagId: "", name: "" });
      queryClient.invalidateQueries({ queryKey: ["admin-tags"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
    },
  });

  const bulkRemoveTagMutation = useMutation({
    mutationFn: ({ userIds, tagId }: { userIds: string[]; tagId: number }) =>
      removeTagFromUsers(userIds, tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tags"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
    },
  });

  const deleteTagMutation = useMutation({
    mutationFn: (tagId: number) => deleteTag(tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tags"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
    },
  });

  const openCreateModal = () => {
    setLessonModalMode("create");
    setEditingLesson(null);
    setFormData(emptyForm());
    setHasTouchedTitle(false);
    setIsColorPickerOpen(false);
    setIsIconPickerOpen(false);
    setIsModalOpen(true);
  };

  useEffect(() => {
    setSelectedUserIds((current) => {
      const visibleUserIdSet = new Set(visibleUserIds);
      const next = new Set(
        [...current].filter((userId) => visibleUserIdSet.has(userId)),
      );

      return next.size === current.size ? current : next;
    });
  }, [visibleUserIds]);

  useEffect(() => {
    if (!selectedVisibleCount) {
      setIsBulkTagPopoverOpen(false);
    }
  }, [selectedVisibleCount]);

  const setVisibleUsersSelected = (checked: boolean) => {
    setSelectedUserIds((current) => {
      const next = new Set(current);

      visibleUserIds.forEach((userId) => {
        if (checked) {
          next.add(userId);
        } else {
          next.delete(userId);
        }
      });

      return next;
    });
  };

  const setUserSelected = (userId: string, checked: boolean) => {
    setSelectedUserIds((current) => {
      const next = new Set(current);

      if (checked) {
        next.add(userId);
      } else {
        next.delete(userId);
      }

      return next;
    });
  };

  const openEditModal = (lesson: LessonMeta) => {
    setLessonModalMode("edit");
    setEditingLesson(lesson);
    setFormData({
      title: lesson.title,
      description: lesson.description,
      color: lesson.color,
      icon: lesson.icon,
      hidden: lesson.hidden ?? false,
    });
    setHasTouchedTitle(false);
    setIsColorPickerOpen(false);
    setIsIconPickerOpen(false);
    setIsModalOpen(true);
  };

  const handleDeleteLessonDraft = (lesson: LessonMeta) => {
    deleteLessonDraft(lesson.slug);
    setLessons(getAllLessons());
  };

  const handleRestoreLessonDraft = (lesson: LessonMeta) => {
    restoreLessonDraft(lesson.slug);
    setLessons(getAllLessons());
  };

  const handleCreateCourse = () => {
    if (titleValidationError) {
      setHasTouchedTitle(true);
      return;
    }

    const nextOrder = Math.max(0, ...lessons.map((lesson) => lesson.order)) + 1;

    saveLessonMetadataDraft({
      ...formData,
      slug: generatedSlug,
      order: nextOrder,
    });

    addCustomTask(generatedSlug, {
      editableHtml: "<h1>New Task</h1>\n<p>Start editing...</p>",
      editableCss: "h1 { color: blue; }",
      editableJs: 'console.log("Hello World");',
    });

    setLessons(getAllLessons());
    setIsModalOpen(false);
    navigate(`/lessons/${generatedSlug}`);
  };

  const handleLessonDragStart = ({ active }: DragStartEvent) => {
    setActiveLessonSlug(String(active.id));
    setActiveLessonWidth(active.rect.current.initial?.width ?? null);
  };

  const handleLessonDragOver = ({ active, over }: DragOverEvent) => {
    if (!over || active.id === over.id) return;

    setOrderedLessons((currentLessons) => {
      const oldIndex = currentLessons.findIndex(
        (lesson) => lesson.slug === active.id,
      );
      const newIndex = currentLessons.findIndex(
        (lesson) => lesson.slug === over.id,
      );

      if (oldIndex < 0 || newIndex < 0) return currentLessons;

      return arrayMove(currentLessons, oldIndex, newIndex);
    });
  };

  const handleLessonDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveLessonSlug(null);
    setActiveLessonWidth(null);

    if (!over) {
      setOrderedLessons(lessons);
      return;
    }

    const hasActiveLesson = displayedLessons.some(
      (lesson) => lesson.slug === active.id,
    );
    const hasOverLesson = displayedLessons.some(
      (lesson) => lesson.slug === over.id,
    );

    if (!hasActiveLesson || !hasOverLesson) return;

    const nextLessons = displayedLessons.map((lesson, index) => ({
      ...lesson,
      order: index + 1,
    }));

    nextLessons.forEach((lesson) => saveLessonMetadataDraft(lesson));

    setLessons(getAllLessons());
  };

  const handleLessonDragCancel = () => {
    setActiveLessonSlug(null);
    setActiveLessonWidth(null);
    setOrderedLessons(lessons);
  };

  const handleDownloadLessonChanges = async () => {
    if (!hasLessonChanges || isDownloadingLessonChanges) return;

    setIsDownloadingLessonChanges(true);

    try {
      await generateCoursesZip(
        displayedLessons
          .filter((lesson) => !lesson.deleted)
          .map((lesson) => ({
            course: lesson,
            tasks: getLessonTasksSync(lesson.slug),
          })),
        "lessons.zip",
      );
      clearAllCustomData();
      setLessons(getAllLessons());
    } finally {
      setIsDownloadingLessonChanges(false);
    }
  };

  const handleDiscardLessonChanges = () => {
    if (!hasLessonChanges || isDownloadingLessonChanges) return;

    clearAllCustomData();
    setLessons(getAllLessons());
  };

  const handleSaveEditedLessonMetadata = () => {
    if (!editingLesson) return;
    if (titleValidationError) {
      setHasTouchedTitle(true);
      return;
    }

    saveLessonMetadataDraft({
      ...editingLesson,
      ...formData,
      slug: editingLesson.slug,
      order: editingLesson.order,
    });
    setLessons(getAllLessons());
    setIsModalOpen(false);
  };

  const updateTagDraft = (
    userId: string,
    field: "tagId" | "name",
    value: string,
  ) => {
    setTagDrafts((prev) => ({
      ...prev,
      [userId]: {
        tagId: prev[userId]?.tagId ?? "",
        name: prev[userId]?.name ?? "",
        [field]: value,
      },
    }));
  };

  const submitTag = (targetUser: AdminUser) => {
    const draft = tagDrafts[targetUser.id] ?? { tagId: "", name: "" };
    const tagId = draft.tagId ? Number(draft.tagId) : "";
    const name = draft.name.trim();

    if (!tagId && !name) return;

    addTagMutation.mutate({
      userId: targetUser.id,
      tagId,
      name,
    });
  };

  const submitBulkTag = () => {
    const tagId = bulkTagDraft.tagId ? Number(bulkTagDraft.tagId) : "";
    const name = bulkTagDraft.name.trim();

    if ((!tagId && !name) || !selectedVisibleUserIds.length) return;

    bulkAddTagMutation.mutate({
      userIds: selectedVisibleUserIds,
      tagId,
      name,
    });
  };

  const removeCommonTagFromSelectedUsers = (tagId: number) => {
    if (!selectedVisibleUserIds.length) return;

    bulkRemoveTagMutation.mutate({
      userIds: selectedVisibleUserIds,
      tagId,
    });
  };

  const error = tagsError || usersError || submissionsError;

  if (authLoading) return <LoadingSpinner />;

  return (
    <main className="admin-page">
      <aside className="admin-sidebar" aria-label="Admin sections">
        <div className="admin-sidebar-heading">
          <strong>Control panel</strong>
        </div>
        <nav className="admin-sidebar-nav">
          {[
            { key: "lessons", label: "Lessons", icon: BookOpen },
            { key: "users", label: "Users", icon: Users },
            { key: "submissions", label: "Submissions", icon: Send },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                className={`admin-nav-item ${
                  activeSection === item.key ? "is-active" : ""
                }`}
                onClick={() => setActiveSection(item.key as AdminSection)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <section className="admin-workspace">
        {error && (
          <div className="admin-error">
            {error instanceof Error ? error.message : "Error loading data"}
          </div>
        )}

        {activeSection === "lessons" && (
          <section className="admin-panel">
            <div className="admin-panel-header">
              <div>
                <h1>Lessons</h1>
                <p>
                  {displayedLessons.length} lessons available
                  {changedLessonSummaries.length > 0
                    ? `, ${changedLessonSummaries.length} with draft changes`
                    : ""}
                </p>
              </div>
              <div className="admin-panel-header-actions">
                <button
                  type="button"
                  onClick={handleDiscardLessonChanges}
                  className="admin-row-button"
                  disabled={!hasLessonChanges || isDownloadingLessonChanges}
                >
                  <RotateCcw size={16} />
                  Discard drafts
                </button>
                <button
                  type="button"
                  onClick={handleDownloadLessonChanges}
                  className="admin-row-button"
                  disabled={!hasLessonChanges || isDownloadingLessonChanges}
                >
                  <Download size={16} />
                  Download drafts
                </button>
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="btn-primary"
                >
                  <Plus size={16} />
                  Create new lesson
                </button>
              </div>
            </div>

            <DndContext
              sensors={lessonDragSensors}
              collisionDetection={closestCenter}
              onDragStart={handleLessonDragStart}
              onDragOver={handleLessonDragOver}
              onDragEnd={handleLessonDragEnd}
              onDragCancel={handleLessonDragCancel}
            >
              <SortableContext
                items={lessonIds}
                strategy={verticalListSortingStrategy}
              >
                <div
                  className={`admin-lesson-grid ${
                    activeDraggedLesson ? "is-dragging" : ""
                  }`}
                >
                  {displayedLessons.map((lesson) => (
                    <SortableLessonCard
                      key={lesson.slug}
                      lesson={lesson}
                      summary={
                        lessonDraftSummariesBySlug.get(lesson.slug) ?? {
                          lesson,
                          status: "unchanged",
                          changes: [],
                        }
                      }
                      onEdit={openEditModal}
                      onDelete={handleDeleteLessonDraft}
                      onRestore={handleRestoreLessonDraft}
                    />
                  ))}
                </div>
              </SortableContext>
              <DragOverlay zIndex={10000}>
                {activeDraggedLesson ? (
                  <LessonDragOverlayCard
                    lesson={activeDraggedLesson}
                    width={activeLessonWidth}
                  />
                ) : null}
              </DragOverlay>
            </DndContext>

            <section className="admin-lesson-changelog">
              <div className="admin-lesson-changelog-heading">
                Draft changelog
              </div>
              {changedLessonSummaries.length > 0 && (
                <ul>
                  {changedLessonSummaries.map((summary) => (
                    <li key={summary.lesson.slug}>
                      <span className={`admin-change-tag is-${summary.status}`}>
                        {summary.status === "added" ? "Added" : "Changed"}
                      </span>
                      <strong>{summary.lesson.title}</strong>
                      <span className="admin-muted">
                        {summary.changes.join(", ")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {changedLessonSummaries.length === 0 && (
                <p className="admin-muted">No draft changes</p>
              )}
            </section>
          </section>
        )}

        {activeSection === "users" && (
          <section className="admin-panel admin-table-panel">
            <div className="admin-panel-header">
              <div>
                <h1>Users</h1>
                <p>Admins and signed-in students</p>
              </div>
              <div className="admin-table-toolbar">
                {selectedVisibleCount > 0 && (
                  <span className="admin-selection-count">
                    {selectedVisibleCount} selected
                  </span>
                )}
                <span className="admin-tag-add-anchor admin-popover-boundary">
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => {
                      if (!selectedVisibleCount) return;
                      setIsBulkTagPopoverOpen((current) => !current);
                      setOpenTagPopoverUserId(null);
                      setOpenMoreTagsKey(null);
                    }}
                    disabled={!selectedVisibleCount}
                    aria-label="Edit tags for selected users"
                    aria-expanded={isBulkTagPopoverOpen}
                    title="Edit tags for selected users"
                  >
                    <Tags size={18} />
                  </button>
                  {isBulkTagPopoverOpen && (
                    <div className="lesson-picker-popover admin-tag-popover admin-bulk-tag-popover">
                      <div className="admin-tag-popover-section">
                        <div className="admin-tag-popover-heading">
                          Common tags
                        </div>
                        <CompactTags
                          tags={commonSelectedTags}
                          canRemove
                          showAll
                          onRemove={removeCommonTagFromSelectedUsers}
                        />
                      </div>
                      <UserTagPopover
                        tags={tags}
                        assignedTagIds={commonSelectedTagIds}
                        availableLabel="Addable saved tags"
                        draftName={bulkTagDraft.name}
                        isPending={
                          bulkAddTagMutation.isPending ||
                          bulkRemoveTagMutation.isPending ||
                          deleteTagMutation.isPending
                        }
                        onSelectExisting={(tagId) =>
                          bulkAddTagMutation.mutate({
                            userIds: selectedVisibleUserIds,
                            tagId,
                          })
                        }
                        onDeleteTag={(tagId) => deleteTagMutation.mutate(tagId)}
                        onDraftNameChange={(value) =>
                          setBulkTagDraft((current) => ({
                            ...current,
                            name: value,
                          }))
                        }
                        onCreateTag={submitBulkTag}
                      />
                    </div>
                  )}
                </span>
                <TagFilter
                  value={userTagFilter}
                  onChange={setUserTagFilter}
                  tags={tags}
                />
              </div>
            </div>

            {usersLoading ? (
              <LoadingSpinner />
            ) : (
              <>
                <div className="admin-table-scroll">
                  <table className="admin-table admin-users-table">
                    <thead>
                      <tr>
                        <th>
                          <SelectAllCheckbox
                            checked={isAllVisibleUsersSelected}
                            indeterminate={isSomeVisibleUsersSelected}
                            onChange={setVisibleUsersSelected}
                          />
                        </th>
                        <th>
                          <SortableHeader
                            label="User"
                            column="user"
                            sort={userSort}
                            onSortChange={updateUserSort}
                          />
                        </th>
                        <th>
                          <SortableHeader
                            label="Role"
                            column="role"
                            sort={userSort}
                            onSortChange={updateUserSort}
                          />
                        </th>
                        <th>Tags</th>
                        <th>
                          <SortableHeader
                            label="Joined"
                            column="joined"
                            sort={userSort}
                            onSortChange={updateUserSort}
                          />
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(usersData?.items ?? []).map((row) => {
                        const draft = tagDrafts[row.id] ?? {
                          tagId: "",
                          name: "",
                        };

                        return (
                          <tr key={row.id}>
                            <td>
                              <input
                                type="checkbox"
                                checked={selectedUserIds.has(row.id)}
                                onChange={(event) =>
                                  setUserSelected(row.id, event.target.checked)
                                }
                                aria-label={`Select ${row.name || row.email}`}
                              />
                            </td>
                            <td>
                              <strong>{row.name || "Unnamed user"}</strong>
                              <span className="admin-cell-subtitle">
                                {row.email}
                              </span>
                            </td>
                            <td>
                              <span className="admin-role-pill">
                                {row.role}
                              </span>
                            </td>
                            <td>
                              <div className="admin-tags-cell">
                                <CompactTags
                                  tags={row.tags}
                                  canRemove
                                  expanded={
                                    openMoreTagsKey === `user-${row.id}`
                                  }
                                  onToggleExpanded={() => {
                                    setOpenTagPopoverUserId(null);
                                    setOpenMoreTagsKey((current) =>
                                      current === `user-${row.id}`
                                        ? null
                                        : `user-${row.id}`,
                                    );
                                  }}
                                  onRemove={(tagId) =>
                                    removeTagMutation.mutate({
                                      userId: row.id,
                                      tagId,
                                    })
                                  }
                                >
                                  <span className="admin-tag-add-anchor admin-popover-boundary">
                                    <button
                                      type="button"
                                      className="admin-tag-add-button"
                                      onClick={() => {
                                        setOpenMoreTagsKey(null);
                                        setOpenTagPopoverUserId((current) =>
                                          current === row.id ? null : row.id,
                                        );
                                      }}
                                      aria-label={`Add tag to ${
                                        row.name || row.email
                                      }`}
                                      aria-expanded={
                                        openTagPopoverUserId === row.id
                                      }
                                    >
                                      <Plus size={14} />
                                    </button>
                                    {openTagPopoverUserId === row.id && (
                                      <UserTagPopover
                                        tags={tags}
                                        assignedTagIds={
                                          new Set(row.tags.map((tag) => tag.id))
                                        }
                                        draftName={draft.name}
                                        isPending={
                                          addTagMutation.isPending ||
                                          deleteTagMutation.isPending
                                        }
                                        onSelectExisting={(tagId) =>
                                          addTagMutation.mutate({
                                            userId: row.id,
                                            tagId,
                                          })
                                        }
                                        onDeleteTag={(tagId) =>
                                          deleteTagMutation.mutate(tagId)
                                        }
                                        onDraftNameChange={(value) =>
                                          updateTagDraft(row.id, "name", value)
                                        }
                                        onCreateTag={() => submitTag(row)}
                                      />
                                    )}
                                  </span>
                                </CompactTags>
                              </div>
                            </td>
                            <td>{formatDate(row.created_at)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  page={usersData?.page ?? userPage}
                  total={usersData?.total ?? 0}
                  pageSize={usersData?.pageSize ?? PAGE_SIZE}
                  onChange={setUserPage}
                />
              </>
            )}
          </section>
        )}

        {activeSection === "submissions" && (
          <section className="admin-panel admin-table-panel">
            <div className="admin-panel-header">
              <div>
                <h1>Submissions</h1>
                <p>Latest student work</p>
              </div>
              <TagFilter
                value={submissionTagFilter}
                onChange={setSubmissionTagFilter}
                tags={tags}
              />
            </div>

            {submissionsLoading ? (
              <LoadingSpinner />
            ) : (
              <>
                <div className="admin-table-scroll">
                  <table className="admin-table admin-submissions-table">
                    <thead>
                      <tr>
                        <th>
                          <SortableHeader
                            label="ID"
                            column="id"
                            sort={submissionSort}
                            onSortChange={updateSubmissionSort}
                          />
                        </th>
                        <th>
                          <SortableHeader
                            label="User"
                            column="user"
                            sort={submissionSort}
                            onSortChange={updateSubmissionSort}
                          />
                        </th>
                        <th>Tags</th>
                        <th>
                          <SortableHeader
                            label="Lesson"
                            column="lesson"
                            sort={submissionSort}
                            onSortChange={updateSubmissionSort}
                          />
                        </th>
                        <th>Task</th>
                        <th>
                          <SortableHeader
                            label="Submitted"
                            column="submitted"
                            sort={submissionSort}
                            onSortChange={updateSubmissionSort}
                          />
                        </th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(submissionsData?.items ?? []).map((sub) => (
                        <tr key={sub.id}>
                          <td className="font-mono">#{sub.id}</td>
                          <td>
                            <strong>{sub.user_name || "Anonymous"}</strong>
                            <span className="admin-cell-subtitle">
                              {sub.user_email}
                            </span>
                          </td>
                          <td>
                            <CompactTags
                              tags={sub.user_tags ?? []}
                              expanded={
                                openMoreTagsKey === `submission-${sub.id}`
                              }
                              onToggleExpanded={() => {
                                setOpenTagPopoverUserId(null);
                                setOpenMoreTagsKey((current) =>
                                  current === `submission-${sub.id}`
                                    ? null
                                    : `submission-${sub.id}`,
                                );
                              }}
                            />
                          </td>
                          <td>
                            <span className="pill pill-blue">
                              {sub.lesson_slug}
                            </span>
                          </td>
                          <td>Task {sub.task_id}</td>
                          <td>{formatDate(sub.timestamp)}</td>
                          <td>
                            <Link
                              to={`/lessons/${sub.lesson_slug}?submissionId=${sub.id}`}
                              className="admin-row-button"
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  page={submissionsData?.page ?? submissionPage}
                  total={submissionsData?.total ?? 0}
                  pageSize={submissionsData?.pageSize ?? PAGE_SIZE}
                  onChange={setSubmissionPage}
                />
              </>
            )}
          </section>
        )}

        <Modal
          title={
            lessonModalMode === "create"
              ? "Create new lesson"
              : "Edit lesson metadata"
          }
          isOpen={isModalOpen}
          onClose={() => {
            closePopovers();
            setIsModalOpen(false);
          }}
          actions={
            <div className="admin-modal-actions">
              <button
                type="button"
                onClick={() => {
                  closePopovers();
                  setIsModalOpen(false);
                }}
                className="btn-ghost"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={
                  lessonModalMode === "create"
                    ? handleCreateCourse
                    : handleSaveEditedLessonMetadata
                }
                className="btn-primary"
                disabled={Boolean(titleValidationError)}
              >
                {lessonModalMode === "create" ? (
                  <>
                    <Plus size={16} />
                    Create
                  </>
                ) : (
                  <>
                    <Edit3 size={16} />
                    Save draft
                  </>
                )}
              </button>
            </div>
          }
        >
          <div className="admin-form">
            <div className="form-group">
              <label>Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(event) => {
                  setHasTouchedTitle(true);
                  setFormData({ ...formData, title: event.target.value });
                }}
                placeholder="Intro to React"
                className="admin-input"
              />
              {hasTouchedTitle && titleValidationError ? (
                <p className="form-error">{titleValidationError}</p>
              ) : generatedSlug ? (
                <p className="form-hint">Slug: {generatedSlug}</p>
              ) : null}
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                value={formData.description}
                onChange={(event) =>
                  setFormData({ ...formData, description: event.target.value })
                }
                className="admin-input"
              />
            </div>
            <div className="lesson-picker-row">
              <div className="form-group lesson-color-field">
                <label>Color</label>
                <div className="lesson-picker admin-popover-boundary">
                  <button
                    type="button"
                    className="lesson-picker-button"
                    onClick={() => {
                      setIsColorPickerOpen((prev) => !prev);
                      setIsIconPickerOpen(false);
                      setOpenTagPopoverUserId(null);
                      setOpenMoreTagsKey(null);
                    }}
                    aria-expanded={isColorPickerOpen}
                  >
                    <span
                      className="lesson-picker-color-preview"
                      style={{ backgroundColor: formData.color }}
                      aria-hidden="true"
                    />
                    <span className="lesson-picker-button-text">
                      {formData.color}
                    </span>
                  </button>
                  {isColorPickerOpen && (
                    <div className="lesson-picker-popover color" role="dialog">
                      <HexColorPicker
                        color={currentHexColor}
                        onChange={(color) =>
                          setFormData({
                            ...formData,
                            color: oklchFromHex(color),
                          })
                        }
                      />
                      <div className="lesson-color-options">
                        {LESSON_COLOR_OPTIONS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            className={`lesson-color-option ${
                              formData.color === color ? "is-selected" : ""
                            }`}
                            style={{ backgroundColor: color }}
                            onClick={() => setFormData({ ...formData, color })}
                            aria-label={`Use color ${color}`}
                            aria-pressed={formData.color === color}
                          />
                        ))}
                      </div>
                      <div className="lesson-color-meta">
                        <span>
                          L {formatNumber(currentOklchColor.lightness, 1)}%
                        </span>
                        <span>
                          C {formatNumber(currentOklchColor.chroma, 3)}
                        </span>
                        <span>H {formatNumber(currentOklchColor.hue, 1)}</span>
                      </div>
                      <input
                        type="text"
                        value={formData.color}
                        onChange={(event) =>
                          setFormData({
                            ...formData,
                            color: event.target.value,
                          })
                        }
                        className="admin-input lesson-color-text"
                        aria-label="OKLCH color value"
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className="form-group lesson-icon-field">
                <label>Icon</label>
                <div className="lesson-picker lesson-picker-right admin-popover-boundary">
                  <button
                    type="button"
                    className="lesson-picker-button"
                    onClick={() => {
                      setIsIconPickerOpen((prev) => !prev);
                      setIsColorPickerOpen(false);
                      setOpenTagPopoverUserId(null);
                      setOpenMoreTagsKey(null);
                    }}
                    aria-expanded={isIconPickerOpen}
                  >
                    <span className="lesson-picker-icon-preview">
                      <LessonIcon name={formData.icon} size={24} />
                    </span>
                    <span className="lesson-picker-icon-name">
                      {formData.icon}
                    </span>
                  </button>
                  {isIconPickerOpen && (
                    <div className="lesson-picker-popover icon" role="dialog">
                      <label className="lesson-icon-search">
                        <Search size={18} aria-hidden="true" />
                        <input
                          type="search"
                          value={iconSearch}
                          onChange={(event) =>
                            setIconSearch(event.target.value)
                          }
                          placeholder="Search Lucide icons"
                          autoFocus
                        />
                      </label>
                      <div className="lesson-icon-result-count">
                        {filteredIconNames.length} icons
                      </div>
                      <div className="lesson-icon-options">
                        {filteredIconNames.map((icon) => (
                          <button
                            key={icon}
                            type="button"
                            className={`lesson-icon-option ${
                              formData.icon === icon ? "is-selected" : ""
                            }`}
                            onClick={() => {
                              setFormData((prev) => ({ ...prev, icon }));
                              setIsIconPickerOpen(false);
                            }}
                            aria-label={`Use ${icon} icon`}
                            aria-pressed={formData.icon === icon}
                          >
                            <LessonIcon name={icon} size={22} />
                            <span>{icon}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="admin-switch-row">
              <span>
                <strong>Hidden lesson</strong>
              </span>
              <button
                type="button"
                role="switch"
                className="admin-switch"
                aria-checked={formData.hidden}
                onClick={() =>
                  setFormData((prev) => ({ ...prev, hidden: !prev.hidden }))
                }
              >
                <span />
              </button>
            </div>
          </div>
        </Modal>
      </section>
    </main>
  );
}
