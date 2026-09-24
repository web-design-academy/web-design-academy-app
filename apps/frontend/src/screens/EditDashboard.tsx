import * as LucideIcons from "lucide-react";
import {ArrowLeft, Download, Edit3, ExternalLink, GripVertical, Plus, Search, Trash2, Undo2} from "lucide-react";
import {useCallback, useEffect, useMemo, useState} from "react";
import {
  deleteMarkedAsync,
  generateId,
  getLessonsAsync,
  type LessonMeta,
  markLessonDeletedAsync,
  markLessonRestoredAsync,
  saveLessonAsync,
  saveTasksAsync
} from "@/lib/helpers/db.ts";
import {Link} from "react-router";
import LessonIcon from "@/components/Lesson/LessonIcon.tsx";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import {converter, formatHex, parse} from "culori";
import {CSS} from "@dnd-kit/utilities";
import Modal from "@/components/Modal.tsx";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import {packLessonsZipAsync, parseLessonsZipAsync} from "@/lib/helpers/zipHeper";
import {HexColorPicker} from "react-colorful";
import LoadingSpinner from "@/components/LoadingSpinner.tsx";

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

export type OklchColor = {
  lightness: number;
  chroma: number;
  hue: number;
};

/**
 * Converts color values to the OKLCH color space representation.
 *
 * The `toOklch` variable represents a conversion function that transforms
 * input color data into the OKLCH (Oklab Color Lightness Chroma Hue) format.
 * OKLCH is a perceptually uniform color model, which is useful for color
 * manipulation and comparisons.
 *
 * The conversion process is determined by the underlying `converter`
 * method used to initialize this variable.
 */
const toOklch = converter("oklch");

/**
 * A sorted array containing the names of all valid Lucide icons.
 *
 * This variable is derived from the `LucideIcons` object and includes icon names
 * that meet the following criteria:
 * - The name starts with an uppercase letter.
 * - The name does not match the string "Icon".
 * - The name does not start with "Lucide".
 * - The name does not end with "Icon".
 * - The associated value is not null and is of the type "function" or "object".
 *
 * The resulting icon names are sorted in ascending lexicographical order.
 */
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

/**
 * Formats a number to a specified number of fractional digits and converts it to a string.
 *
 * @param {number} value - The number to format.
 * @param {number} maxFractionDigits - The maximum number of fractional digits to include.
 * @return {string} The formatted number as a string.
 */
function formatNumber(value: number, maxFractionDigits: number): string {
  return Number(value.toFixed(maxFractionDigits)).toString();
}

/**
 * Formats an OklchColor object into a string representation of the OKLCH color model.
 *
 * @param {OklchColor} color - An object representing a color in the OKLCH color space,
 *                             containing properties for lightness, chroma, and hue.
 * @return {string} A formatted string representing the color in OKLCH notation.
 */
function formatOklchColor(color: OklchColor): string {
  return `oklch(${formatNumber(color.lightness, 1)}% ${formatNumber(
    color.chroma,
    3,
  )} ${formatNumber(color.hue, 3)})`;
}

/**
 * Converts an OKLCH color string to its hexadecimal color representation.
 * If the conversion fails, a default hexadecimal color "#f54900" is returned.
 *
 * @param {string} value - The OKLCH color string to be converted.
 * @return {string} The hexadecimal color representation of the input or a default value.
 */
function hexFromOklch(value: string): string {
  const parsedColor = parse(value);
  return parsedColor ? formatHex(parsedColor) : "#f54900";
}

/**
 * Converts a hexadecimal color value to an OKLCH color format.
 *
 * @param {string} value - The hexadecimal color value to be converted.
 * @return {string} The converted color in OKLCH format. If the input is invalid, returns a default OKLCH color.
 */
function oklchFromHex(value: string): string {
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

/**
 * Parses a string representing a color in OKLCH format and extracts its components.
 *
 * @param {string} value - The OKLCH color string to parse. The expected format is `oklch(lightness% chroma hue)`
 * or `oklch(lightness chroma hue)`, where lightness is a percentage or number, and chroma and hue are numbers.
 *
 * @return {OklchColor} An object representing the parsed OKLCH color with `lightness`, `chroma`, and `hue` properties
 * as numbers. Returns a default value if parsing fails.
 */
function parseOklchColor(value: string): OklchColor {
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

type LessonForm = Omit<LessonMeta, "id" | "order" | "deleted" | "remoteId" | "sha" | "taskCount">;

/**
 * Creates and returns a new empty lesson form object with default values.
 *
 * @return {LessonForm} A lesson form object initialized with default values, including an empty title, description,
 * default color, and icon, with no tasks, and visual editor/preview set to false.
 */
function emptyForm(): LessonForm {
  return {
    title: "",
    description: "",
    color: LESSON_COLOR_OPTIONS[0],
    icon: DEFAULT_ICON,
    source: "local",
    visualEditor: false,
    visualPreview: false
  };
}

function SortableLessonCard({
                              lesson,
                              onEdit,
                              onDelete,
                              onRestore,
                            }: {
  lesson: LessonMeta;
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
  } = useSortable({ id: lesson.id });

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
          {lesson.deleted && (
            <span className="admin-change-tag is-deleted">Deleted</span>
          )}
        </div>
        <p className="admin-lesson-description">{lesson.description}</p>
      </div>
      <div className="admin-lesson-card-actions">
        <button
          type="button"
          className="admin-icon-button"
          onClick={() => onEdit(lesson)}
          aria-label={`Edit metadata for ${lesson.title}`}
          title="Edit metadata"
        >
          <Edit3 size="1em"/>
        </button>
        {lesson.deleted ? (
          <button
            type="button"
            className="admin-icon-button"
            onClick={() => onRestore(lesson)}
            aria-label={`Restore ${lesson.title}`}
            title="Restore"
          >
            <Undo2 size="1em"/>
          </button>
        ) : (
          <button
            type="button"
            className="admin-icon-button"
            onClick={() => onDelete(lesson)}
            aria-label={`Delete ${lesson.title}`}
            title="Delete"
          >
            <Trash2 size="1em"/>
          </button>
        )}
        <Link
          to={{
            pathname: `/lessons/${lesson.id}`,
            search: "?mode=edit",
          }}
          className="admin-icon-button"
          aria-label={`Open ${lesson.title}`}
          title="Open lesson"
        >
          <ExternalLink size="1em"/>
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
        </div>
        <p className="admin-lesson-description">{lesson.description}</p>
      </div>
      <div className="admin-lesson-card-actions" aria-hidden="true">
        <span className="admin-icon-button">
          <Edit3 size="1em"/>
        </span>
        <span className="admin-icon-button">
          <Trash2 size="1em"/>
        </span>
        <span className="admin-icon-button">
          <ExternalLink size="1em"/>
        </span>
      </div>
    </article>
  );
}

export default function EditDashboard() {
  const [lessons, setLessons] = useState<LessonMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLesson, setActiveLesson] = useState<LessonMeta | null>(null);
  const [activeLessonWidth, setActiveLessonWidth] = useState<number | null>(null);
  const [lessonModalMode, setLessonModalMode] = useState<"create" | "edit">("create");
  const [editingLesson, setEditingLesson] = useState<LessonMeta | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  const [formData, setFormData] = useState<LessonForm>(emptyForm);
  const [hasTouchedTitle, setHasTouchedTitle] = useState(false);
  const [isDownloadingLessonChanges, setIsDownloadingLessonChanges] = useState(false);
  const [iconSearch, setIconSearch] = useState("");
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const closePopovers = useCallback(() => {
    setIsColorPickerOpen(false);
    setIsIconPickerOpen(false);
  }, []);

  const currentOklchColor: OklchColor = useMemo(
    (): OklchColor => parseOklchColor(formData.color),
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

  const setActiveLessonFunction = (lessonId: string | null) => {
    if (lessonId) {
      const lesson = lessons.find((l) => l.id === lessonId);
      if (lesson) {
        setActiveLesson(lesson);
      } else {
        setActiveLesson(null);
      }
    } else {
      setActiveLesson(null);
    }
  }

  const lessonIds = useMemo(
    () => lessons.map((lesson) => lesson.id),
    [lessons],
  );

  const generatedId = useMemo(
    () => generateId(formData.title, "local"),
    [formData.title],
  );

  const titleValidationError = useMemo(() => {
    if (!formData.title.trim()) return "Title is required.";

    if (lessonModalMode === "edit") return "";

    if (!generatedId)
      return "Title must contain at least one letter or number.";

    const idExists = lessons.some(
      (lesson) =>
        lesson.id === generatedId && lesson.id !== editingLesson?.id,
    );
    return idExists ? "A lesson with this title already exists." : "";
  }, [
    editingLesson?.id,
    formData.title,
    generatedId,
    lessonModalMode,
    lessons,
  ]);

  const lessonDragSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleLessonDragStart = ({ active }: DragStartEvent) => {
    setActiveLessonFunction(active.id as string);
    setActiveLessonWidth(active.rect.current.initial?.width ?? null);
  };

  const handleLessonDragEnd = async ({ active, over }: DragEndEvent) => {
    setActiveLessonFunction(null);
    setActiveLessonWidth(null);

    if (!over || active.id === over.id)
      return;

    const oldIndex = lessons.findIndex((lesson) => lesson.id === active.id);
    const newIndex = lessons.findIndex((lesson) => lesson.id === over.id);

    if (oldIndex < 0 || newIndex < 0)
      return;

    const reordered = arrayMove(lessons, oldIndex, newIndex);

    const updatedLessons = reordered.map((lesson, index) => ({
      ...lesson,
      order: index + 1,
    }));

    setLessons(updatedLessons);

    for (const lesson of updatedLessons) {
      await saveLessonAsync(lesson);
    }
  };

  const handleLessonDragCancel = () => {
    setActiveLessonFunction(null);
    setActiveLessonWidth(null);
    setLessons(lessons);
  };

  const openEditModal = (lesson: LessonMeta) => {
    setLessonModalMode("edit");
    setEditingLesson(lesson);
    setFormData({
      title: lesson.title,
      description: lesson.description,
      color: lesson.color,
      icon: lesson.icon,
      visualEditor: lesson.visualEditor ?? false,
      visualPreview: lesson.visualPreview ?? false,
      source: lesson.source
    });
    setHasTouchedTitle(false);
    setIsColorPickerOpen(false);
    setIsIconPickerOpen(false);
    setIsModalOpen(true);
  };

  const handleDeleteLessonDraft = async (lesson: LessonMeta) => {
    await markLessonDeletedAsync(lesson.id);
    setLessons(await getLessonsAsync());
  };

  const handleRestoreLessonDraft = async (lesson: LessonMeta) => {
    await markLessonRestoredAsync(lesson.id);
    setLessons(await getLessonsAsync());
  };

  const handleCreateCourse = async () => {
    if (titleValidationError) {
      setHasTouchedTitle(true);
      return;
    }

    await saveLessonAsync({
      ...formData,
      id: generatedId,
      order: -1,
      deleted: false,
      taskCount: 0,
    });

    await saveTasksAsync(generatedId, [{
      html: "<h1>New Task</h1>\n<p>Start editing...</p>",
      css: "h1 { color: blue; }",
      js: 'console.log("Hello World");',
    }])

    setLessons(await getLessonsAsync());
    setIsModalOpen(false);
  };

  const handleDownloadLessonChanges = async () => {
    if (isDownloadingLessonChanges || lessons.length == 0) return;

    setIsDownloadingLessonChanges(true);

    try {
      const coursesData = await Promise.all(
        lessons
          .filter((lesson) => !lesson.deleted)
      );

      await packLessonsZipAsync(coursesData, "lessons.zip");
    } finally {
      setIsDownloadingLessonChanges(false);
    }
  };

  const handleDiscardLessonChanges = async () => {
    if (isDownloadingLessonChanges) return;

    await deleteMarkedAsync();
    setLessons(await getLessonsAsync());
  };

  const openCreateModal = () => {
    setLessonModalMode("create");
    setEditingLesson(null);
    setFormData(emptyForm());
    setHasTouchedTitle(false);
    setIsColorPickerOpen(false);
    setIsIconPickerOpen(false);
    setIsModalOpen(true);
  };

  const handleSaveEditedLessonMetadata = async () => {
    if (!editingLesson) return;
    if (titleValidationError) {
      setHasTouchedTitle(true);
      return;
    }

    await saveLessonAsync({
      ...editingLesson,
      title: formData.title,
      description: formData.description,
      color: formData.color,
      icon: formData.icon,
      visualEditor: formData.visualEditor,
      visualPreview: formData.visualPreview,
    });

    setLessons(await getLessonsAsync());
    setIsModalOpen(false);
  };

  function useFileDrop(onFileDrop: (file: File) => void) {
    useEffect(() => {
      let dragCounter = 0;

      const handleDragEnter = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter += 1;

        if (e.dataTransfer?.types?.includes("Files")) {
          setIsDraggingOver(true);
        }
      };

      const handleDragLeave = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter -= 1;

        if (dragCounter <= 0) {
          dragCounter = 0;
          setIsDraggingOver(false);
        }
      };

      const handleDragOver = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
      };

      const handleDrop = (e: DragEvent) => {
        e.preventDefault();
        dragCounter = 0;
        setIsDraggingOver(false);

        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
          onFileDrop(files[0]);
        }
      };

      window.addEventListener("dragenter", handleDragEnter);
      window.addEventListener("dragover", handleDragOver);
      window.addEventListener("dragleave", handleDragLeave);
      window.addEventListener("drop", handleDrop);

      return () => {
        window.removeEventListener("dragenter", handleDragEnter);
        window.removeEventListener("dragover", handleDragOver);
        window.removeEventListener("dragleave", handleDragLeave);
        window.removeEventListener("drop", handleDrop);
      };
    }, [onFileDrop]);
  }

  const handleFileDrop = useCallback(async (file: File) => {
    if (file.name.endsWith(".zip")) {
      const data = await parseLessonsZipAsync(file);
      setLessons(data);
    } else {
      alert("unsupported file type");
    }
  }, []);

  useFileDrop(handleFileDrop);

  useEffect(() => {
    setLoading(true);
    getLessonsAsync().then((data) => {
      setLessons(data);
      setLoading(false);
    });
  }, []);

  return (
    <main className={`dashboard-page`}>
      <section className="dashboard-shell">
        <div className={`dashboard-title`}>
          <h1>Course editing</h1>

          <Link
            to={`/`}
            className="btn-ghost"
            aria-label={`Back to dashboard`}
          >
            <ArrowLeft size="1em" className="icon-margin-right"/>
            Back to dashboard
          </Link>
        </div>

        <div className="dashboard-edit-actions">
          <div className="dashboard-edit-actions-count">
            {lessons.length} lessons available
          </div>

          <div className="dashboard-edit-actions-buttons">
            <button
              type="button"
              onClick={handleDiscardLessonChanges}
              className="btn-ghost"
              disabled={isDownloadingLessonChanges || lessons.filter((lesson) => lesson.deleted).length === 0}
              title="Delete all lessons marked as 'Deleted'"
            >
              <Trash2 size="1em"/>
            </button>

            <button
              type="button"
              onClick={handleDownloadLessonChanges}
              className="btn-ghost"
              disabled={isDownloadingLessonChanges || lessons.length == 0}
              title="Export all lessons to a .zip file"
            >
              <Download size="1em" className="icon-margin-right"/>
              Download lessons .zip
            </button>

            <button
              type="button"
              onClick={openCreateModal}
              className="btn-primary"
              title="Creates a new lesson"
            >
              <Plus size="1em" className="icon-margin-right"/>
              Create new lesson
            </button>
          </div>
        </div>

        {loading ? (<LoadingSpinner/>) : lessons.length === 0 ? (
          <h3 className="dashboard-info">No lessons available</h3>
        ) : (
          <DndContext
            sensors={lessonDragSensors}
            collisionDetection={closestCenter}
            onDragStart={handleLessonDragStart}
            onDragEnd={handleLessonDragEnd}
            onDragCancel={handleLessonDragCancel}
          >
            <SortableContext
              items={lessonIds}
              strategy={verticalListSortingStrategy}
            >
              <div
                className={`admin-lesson-grid ${
                  activeLesson ? "is-dragging" : ""
                }`}
              >
                {lessons.map((lesson) => (
                  <SortableLessonCard
                    key={lesson.id}
                    lesson={lesson}
                    onEdit={openEditModal}
                    onDelete={handleDeleteLessonDraft}
                    onRestore={handleRestoreLessonDraft}
                  />
                ))}
              </div>
            </SortableContext>
            <DragOverlay zIndex={10000}>
              {activeLesson ? (
                <LessonDragOverlayCard
                  lesson={activeLesson}
                  width={activeLessonWidth}
                />
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </section>

      {isDraggingOver && (
        <div className="drag-overlay">
          <div className="drag-overlay-text">
            <span>Drop a .zip file to import lessons</span>
            <Download size={32} />
          </div>
        </div>
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
                  <Plus size="1em"/>
                  Create
                </>
              ) : (
                <>
                  <Edit3 size="1em"/>
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
            ) : generatedId ? (
              <p className="form-hint">id: {generatedId}</p>
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
                <strong>Visual editor</strong>
              </span>
            <button
              type="button"
              role="switch"
              className="admin-switch"
              aria-checked={formData.visualEditor}
              onClick={() =>
                setFormData((prev) => ({
                  ...prev,
                  visualEditor: !prev.visualEditor,
                }))
              }
            >
              <span />
            </button>
          </div>
          <div className="admin-switch-row">
              <span>
                <strong>Visual preview and evaluation</strong>
              </span>
            <button
              type="button"
              role="switch"
              className="admin-switch"
              aria-checked={formData.visualPreview}
              onClick={() =>
                setFormData((prev) => ({
                  ...prev,
                  visualPreview: !prev.visualPreview,
                }))
              }
            >
              <span />
            </button>
          </div>
        </div>
      </Modal>
    </main>
  );
}