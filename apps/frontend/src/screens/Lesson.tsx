import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Navigate, useParams, useSearchParams } from "react-router";
import { Resizable, type ResizeCallback } from "re-resizable";
import { MDXProvider } from "@mdx-js/react";
import type { MDXContent } from "mdx/types";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";

import "@/styles/lesson.css";
import EditorPane from "@/components/EditorPane";
import PreviewPane from "@/components/PreviewPane";
import LoadingSpinner from "@/components/LoadingSpinner";
import Modal from "@/components/Modal";
import LessonIcon from "@/components/LessonIcon";
import { getLessonMeta } from "@/lib/helpers/getLessons";
import {
  getDefaultLessonTasksSync,
  getLessonTasksSync,
  type TaskCode,
} from "@/lib/helpers/getTasks";
import {
  isAddedLessonDraft,
  saveLessonTasksDraft,
} from "@/lib/helpers/lessonDrafts";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  fetchLatestLessonSubmissions,
  submitSolution,
  fetchSubmissionById,
  type SubmissionPayload,
} from "@/lib/api/submissions";
import { useAuth } from "@/lib/ctx/useAuth";
import { useUiPreferences } from "@/lib/ctx/useUiPreferences";
import { isOnlineMode } from "@/lib/config/appMode";
import { API_BASE } from "@/lib/api/client";

export default function Lesson() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const submissionId = searchParams.get("submissionId");

  const { isAuthenticated, user } = useAuth();
  const {
    visualEditorEnabled,
    visualPreviewEnabled,
    setVisualEditorEnabled,
    setVisualPreviewEnabled,
  } = useUiPreferences();

  const isAdmin = user?.role === "admin";
  const [isNew, setIsNew] = useState<boolean | null>(null);

  const submitMutation = useMutation({
    mutationFn: (payload: SubmissionPayload) => submitSolution(payload),
  });

  const {
    data: loadedSubmission,
    isLoading: isLoadingSubmission,
    error: submissionError,
  } = useQuery({
    queryKey: ["submission", submissionId],
    queryFn: () => fetchSubmissionById(submissionId!),
    enabled: !!submissionId && isOnlineMode,
  });

  const { data: latestLessonSubmissions } = useQuery({
    queryKey: ["latest-lesson-submissions", slug],
    queryFn: () => fetchLatestLessonSubmissions(slug!),
    enabled:
      !!slug && !submissionId && isOnlineMode && isAuthenticated && !isAdmin,
  });

  const [tasks, setTasks] = useState<Partial<TaskCode>[]>([]);
  const [taskStates, setTaskStates] = useState<Partial<TaskCode>[]>([]);
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [editorPercent, setEditorPercent] = useState(45);
  const [topRowPercent, setTopRowPercent] = useState(60);
  const [isLessonContentHidden, setIsLessonContentHidden] = useState(false);
  const [isLessonContentAnimating, setIsLessonContentAnimating] =
    useState(false);
  const [isMobileLayout, setIsMobileLayout] = useState(
    typeof window !== "undefined" ? window.innerWidth <= 900 : false,
  );

  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetTaskIndex, setResetTaskIndex] = useState(0);

  const [LessonContent, setLessonContent] =
    useState<React.LazyExoticComponent<MDXContent> | null>(null);
  const lessonContentRef = useRef<HTMLDivElement | null>(null);
  const lessonContentAnimationTimeoutRef = useRef<number | undefined>(
    undefined,
  );
  const lastAutoFocusKeyRef = useRef("");
  const lessonMeta = slug ? getLessonMeta(slug) : undefined;

  useEffect(() => {
    if (!slug) return;

    const addedDraft = isAddedLessonDraft(slug);
    setIsNew(addedDraft);

    if (!addedDraft) {
      const sourceFolder = lessonMeta?.sourceFolder ?? slug;
      setLessonContent(
        lazy(() => import(`../lessons/${sourceFolder}/index.mdx`)),
      );
    } else {
      setLessonContent(null);
    }

    const localTasks = getLessonTasksSync(slug).filter(
      (task) => isAdmin || !task.deleted,
    );
    setTasks(localTasks);
    setTaskStates(
      localTasks.map((task) =>
        isAdmin
          ? { ...task }
          : {
              editableHtml: task.editableHtml,
              editableCss: task.editableCss,
              editableJs: task.editableJs,
            },
      ),
    );
  }, [isAdmin, lessonMeta?.sourceFolder, slug]);

  useEffect(() => {
    setVisualEditorEnabled(false);
    setVisualPreviewEnabled(false);
  }, [setVisualEditorEnabled, setVisualPreviewEnabled, slug]);

  useEffect(() => {
    const onResize = () => {
      setIsMobileLayout(window.innerWidth <= 900);
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    return () => {
      if (lessonContentAnimationTimeoutRef.current) {
        window.clearTimeout(lessonContentAnimationTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (loadedSubmission && tasks.length > 0) {
      const targetTaskIndex = parseInt(loadedSubmission.task_id) - 1;

      if (
        !isNaN(targetTaskIndex) &&
        targetTaskIndex >= 0 &&
        targetTaskIndex < tasks.length
      ) {
        setCurrentTaskIndex(targetTaskIndex);

        setTaskStates((prev) =>
          prev.map((s, idx) => {
            if (idx === targetTaskIndex) {
              return {
                ...s,
                editableHtml: loadedSubmission.html,
                editableCss: loadedSubmission.css,
                editableJs: loadedSubmission.js,
              };
            }
            return s;
          }),
        );
      }
    }
  }, [loadedSubmission, tasks.length]);

  useEffect(() => {
    const submissions = latestLessonSubmissions?.items ?? [];

    if (submissions.length === 0 || tasks.length === 0 || submissionId) {
      return;
    }

    setTaskStates((prev) =>
      prev.map((state, index) => {
        const savedSubmission = submissions.find(
          (submission) => submission.task_id === String(index + 1),
        );

        if (!savedSubmission) {
          return state;
        }

        return {
          ...state,
          editableHtml: savedSubmission.html,
          editableCss: savedSubmission.css,
          editableJs: savedSubmission.js,
        };
      }),
    );

    const latestTaskIndex = parseInt(submissions[0].task_id, 10) - 1;

    if (
      !Number.isNaN(latestTaskIndex) &&
      latestTaskIndex >= 0 &&
      latestTaskIndex < tasks.length
    ) {
      setCurrentTaskIndex(latestTaskIndex);
    }
  }, [latestLessonSubmissions, submissionId, tasks.length]);

  useEffect(() => {
    if (slug && isOnlineMode && isAuthenticated) {
      fetch(`${API_BASE}/progress/${slug}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.completedTaskIds) {
            setCompletedTasks(new Set(data.completedTaskIds));
          }
        });
    }
  }, [slug, isAuthenticated]);

  useEffect(() => {
    if (isNew) return;

    let cancelled = false;
    let retryFrame: number | undefined;
    let clearHighlightTimeout: number | undefined;

    const focusKey = `${slug || "lesson"}:${currentTaskIndex}`;

    const focusCurrentTaskInstruction = () => {
      const container = lessonContentRef.current;
      if (!container) return false;

      const heading = Array.from(container.querySelectorAll("h1, h2, h3")).find(
        (node) =>
          node.textContent?.trim().toLowerCase() === "task instructions",
      );

      let list: HTMLOListElement | null = null;
      if (heading) {
        let candidate = heading.nextElementSibling;
        while (candidate && candidate.tagName !== "OL") {
          candidate = candidate.nextElementSibling;
        }
        if (candidate instanceof HTMLOListElement) {
          list = candidate;
        }
      }

      if (!list) {
        list = container.querySelector("ol");
      }

      if (!list) return false;

      const taskItems = Array.from(list.children).filter(
        (child): child is HTMLLIElement => child.tagName === "LI",
      );
      const target = taskItems[currentTaskIndex];
      if (!target) return false;

      if (lastAutoFocusKeyRef.current === focusKey) {
        return true;
      }

      taskItems.forEach((item) =>
        item.classList.remove("task-instruction-focus"),
      );
      target.classList.add("task-instruction-focus");
      target.scrollIntoView({ behavior: "smooth", block: "nearest" });
      lastAutoFocusKeyRef.current = focusKey;

      if (clearHighlightTimeout) {
        window.clearTimeout(clearHighlightTimeout);
      }
      clearHighlightTimeout = window.setTimeout(() => {
        target.classList.remove("task-instruction-focus");
      }, 1500);

      return true;
    };

    let attempts = 0;
    const tryFocus = () => {
      if (cancelled) return;

      const applied = focusCurrentTaskInstruction();
      if (applied || attempts >= 30) return;

      attempts += 1;
      retryFrame = window.requestAnimationFrame(tryFocus);
    };

    tryFocus();

    return () => {
      cancelled = true;
      if (retryFrame) {
        window.cancelAnimationFrame(retryFrame);
      }
      if (clearHighlightTimeout) {
        window.clearTimeout(clearHighlightTimeout);
      }
    };
  }, [currentTaskIndex, isNew, slug]);

  if (submissionId && submissionError) {
    return (
      <main className="lesson-container">
        <div className="admin-error" style={{ margin: 24 }}>
          {submissionError instanceof Error
            ? submissionError.message
            : "Failed to load submission."}
        </div>
      </main>
    );
  }

  if (isNew === null || isLoadingSubmission) return <LoadingSpinner />;
  if (!lessonMeta && !isNew) return <Navigate to="/" />;
  if (lessonMeta?.hidden && !isAdmin && !isNew) return <Navigate to="/" />;
  if (lessonMeta?.deleted && !isAdmin) return <Navigate to="/" />;
  if (!tasks.length) return <Navigate to={isNew ? "/admin" : "/"} />;

  const currentTask = tasks[currentTaskIndex];
  const currentTaskState = taskStates[currentTaskIndex];
  const currentTaskId = (currentTaskIndex + 1).toString();

  if (!currentTask) return <Navigate to={isNew ? "/admin" : "/"} />;

  const effectiveTask = {
    ...currentTask,
    ...currentTaskState,
  };
  const previewTask: Partial<TaskCode> = effectiveTask.deleted
    ? {}
    : effectiveTask;
  const visualPreviewSupported =
    !previewTask?.hiddenJs &&
    !previewTask?.readonlyJs &&
    !previewTask?.editableJs;
  const srcDoc = `
  <!DOCTYPE html>
  <html>
    <head>
      <base target="_blank" />
      <meta
        http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src https: http: data: blob:;"
      >
      <style>
        * {margin: 0; padding: 0;}
        ${previewTask?.hiddenCss || ""}
        ${previewTask?.readonlyCss || ""}
        ${previewTask?.editableCss || ""}
      </style>
    </head>
    <body>
      ${previewTask?.hiddenHtml || ""}
      ${previewTask?.readonlyHtml || ""}
      ${previewTask?.editableHtml || ""}
      <script>
        ${previewTask?.hiddenJs || ""}
        ${previewTask?.readonlyJs || ""}
        ${previewTask?.editableJs || ""}
      </script>
    </body>
  </html>
  `;

  const handleEditorResize: ResizeCallback = (_e, _dir, ref) => {
    const parentWidth = ref.parentElement!.offsetWidth;
    setEditorPercent((ref.offsetWidth / parentWidth) * 100);
  };

  const handleTopRowResize: ResizeCallback = (_e, _dir, ref) => {
    if (isLessonContentHidden) return;

    const containerHeight = ref.parentElement!.offsetHeight;
    setTopRowPercent((ref.offsetHeight / containerHeight) * 100);
  };

  const toggleLessonContent = () => {
    setIsLessonContentAnimating(true);
    setIsLessonContentHidden((prev) => !prev);

    if (lessonContentAnimationTimeoutRef.current) {
      window.clearTimeout(lessonContentAnimationTimeoutRef.current);
    }

    lessonContentAnimationTimeoutRef.current = window.setTimeout(() => {
      setIsLessonContentAnimating(false);
    }, 260);
  };

  const updateTask = (field: keyof Partial<TaskCode>, value: string) => {
    setTaskStates((prev) => {
      const updated = prev.map((s, idx) =>
        idx === currentTaskIndex ? { ...s, [field]: value } : s,
      );
      if (isAdmin && slug && !loadedSubmission) {
        const persisted = updated.map((state, idx) => ({
          ...tasks[idx],
          ...state,
        }));
        saveLessonTasksDraft(slug, persisted);
      }
      return updated;
    });
  };

  const applyResetTask = (taskIndex = currentTaskIndex) => {
    setTaskStates((prev) => {
      const updated = prev.map((s, idx) => {
        if (idx !== taskIndex) {
          return s;
        }

        const defaultTask = slug
          ? getDefaultLessonTasksSync(slug)[idx]
          : undefined;

        return isAdmin
          ? { ...(defaultTask ?? tasks[idx]) }
          : {
              ...s,
              editableHtml: tasks[idx].editableHtml,
              editableCss: tasks[idx].editableCss,
              editableJs: tasks[idx].editableJs,
            };
      });

      if (isAdmin && slug && !loadedSubmission) {
        const persisted = updated.map((state, idx) => ({
          ...tasks[idx],
          ...state,
        }));
        saveLessonTasksDraft(slug, persisted);
      }
      return updated;
    });
  };

  const resetTask = (taskIndex = currentTaskIndex) => {
    setCurrentTaskIndex(taskIndex);
    setResetTaskIndex(taskIndex);
    setShowResetModal(true);
  };

  const addTask = () => {
    if (!isAdmin || !slug) return;

    const newTask: Partial<TaskCode> = {
      editableHtml: "<h1>New Task</h1>\n<p>Start editing...</p>",
      editableCss: "h1 { color: blue; }",
      editableJs: 'console.log("Hello World");',
    };
    const updatedTasks = [...tasks, newTask];
    const updatedTaskStates = [...taskStates, newTask];
    setTasks(updatedTasks);
    setTaskStates(updatedTaskStates);
    setCurrentTaskIndex(updatedTasks.length - 1);

    saveLessonTasksDraft(slug, updatedTaskStates);
  };

  const deleteTask = (taskIndex = currentTaskIndex) => {
    if (!isAdmin || !slug) return;

    const updatedTaskStates = taskStates.map((state, index) =>
      index === taskIndex ? { ...state, deleted: true } : state,
    );

    setCurrentTaskIndex(taskIndex);
    setTaskStates(updatedTaskStates);
    saveLessonTasksDraft(slug, updatedTaskStates);
  };

  const handleSubmit = async (cssOverride?: string) => {
    if (!currentTaskState) return false;
    if (!isOnlineMode) {
      setShowLoginModal(true);
      return false;
    }
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return false;
    }
    if (isAdmin) return false;

    await submitMutation.mutateAsync({
      lessonSlug: slug!,
      taskId: currentTaskId,
      html: currentTaskState.editableHtml || "",
      css: (cssOverride ?? currentTaskState.editableCss) || "",
      js: currentTaskState.editableJs || "",
    });

    setCompletedTasks((prev) => new Set(prev).add(currentTaskId));
    return true;
  };

  return (
    <main
      className={`lesson-container ${isMobileLayout ? "lesson-container-mobile" : ""}`}
    >
      <Suspense fallback={<LoadingSpinner />}>
        <div className="lesson-shell">
          <aside className="lesson-sidebar">
            <div className="lesson-sidebar-heading">
              {lessonMeta?.icon ? (
                <span
                  className="lesson-sidebar-icon"
                  style={{ background: lessonMeta.color }}
                  aria-hidden="true"
                >
                  <LessonIcon name={lessonMeta.icon} size={20} />
                </span>
              ) : null}
              <strong>{lessonMeta?.title ?? slug}</strong>
            </div>

            <div className="lesson-task-list">
              <nav className="lesson-task-nav" aria-label="Lesson tasks">
                {tasks.map((task, index) => {
                  const taskId = (index + 1).toString();
                  const isActive = index === currentTaskIndex;
                  const isCompleted = completedTasks.has(taskId);
                  const isDeleted = Boolean(
                    taskStates[index]?.deleted ?? task.deleted,
                  );

                  return (
                    <div
                      key={taskId}
                      className={`lesson-task-item ${isActive ? "is-active" : ""} ${isDeleted ? "is-deleted" : ""}`}
                    >
                      <button
                        type="button"
                        className="lesson-task-link"
                        onClick={() => setCurrentTaskIndex(index)}
                      >
                        <span>Task {index + 1}</span>
                        {isCompleted && !isAdmin && (
                          <span className="lesson-task-done">
                            <CheckCircle2 size={14} />
                            DONE
                          </span>
                        )}
                        {isDeleted && isAdmin && (
                          <span className="lesson-task-deleted">Deleted</span>
                        )}
                      </button>

                      <div className="lesson-task-actions">
                        <button
                          type="button"
                          className="lesson-task-icon-button"
                          onClick={() => resetTask(index)}
                          title="Discard task changes"
                          aria-label={`Discard changes for task ${index + 1}`}
                        >
                          <RotateCcw size={14} />
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            className="lesson-task-icon-button is-danger"
                            onClick={() => deleteTask(index)}
                            title="Delete task"
                            aria-label={`Delete task ${index + 1}`}
                            disabled={isDeleted}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </nav>

              {isAdmin && (
                <button
                  type="button"
                  className="lesson-add-task-button"
                  onClick={addTask}
                >
                  <Plus size={16} />
                  Add new task
                </button>
              )}
            </div>

            <div className="lesson-sidebar-switches">
              <div className="lesson-switch-row">
                <span>
                  <strong>Visual editor</strong>
                  <small>Use direct HTML/CSS editing</small>
                </span>
                <button
                  type="button"
                  role="switch"
                  className="lesson-switch"
                  aria-checked={visualEditorEnabled}
                  onClick={() => setVisualEditorEnabled(!visualEditorEnabled)}
                >
                  <span />
                </button>
              </div>

              <div className="lesson-switch-row">
                <span>
                  <strong>Visual preview</strong>
                  <small>Use guided visual checks</small>
                </span>
                <button
                  type="button"
                  role="switch"
                  className="lesson-switch"
                  aria-checked={visualPreviewEnabled}
                  onClick={() => setVisualPreviewEnabled(!visualPreviewEnabled)}
                >
                  <span />
                </button>
              </div>
            </div>
          </aside>

          <section className="lesson-workspace">
            {isMobileLayout ? (
              <>
                <section className="lesson-mobile-editor">
                  <EditorPane
                    task={currentTaskState}
                    currentIndex={currentTaskIndex}
                    onTaskChange={updateTask}
                    readonlyHtml={effectiveTask?.readonlyHtml}
                    readonlyCss={effectiveTask?.readonlyCss}
                    readonlyJs={effectiveTask?.readonlyJs}
                    onSubmit={handleSubmit}
                    isSubmitted={completedTasks.has(currentTaskId)}
                  />
                </section>

                <section className="lesson-mobile-preview">
                  <PreviewPane
                    html={srcDoc}
                    visualHtml={`${previewTask?.hiddenHtml || ""}${previewTask?.readonlyHtml || ""}${previewTask?.editableHtml || ""}`}
                    visualCss={`${previewTask?.hiddenCss || ""}\n${previewTask?.readonlyCss || ""}\n${previewTask?.editableCss || ""}`}
                    solutionCss={`${previewTask?.hiddenCss || ""}\n${previewTask?.readonlyCss || ""}\n${previewTask?.solutionCss || ""}`}
                    solutionHtml={
                      previewTask?.solutionHtml !== undefined
                        ? `${previewTask?.hiddenHtml || ""}${previewTask?.readonlyHtml || ""}${previewTask?.solutionHtml || ""}`
                        : `${previewTask?.hiddenHtml || ""}${previewTask?.readonlyHtml || ""}${previewTask?.editableHtml || ""}`
                    }
                    initialCss={`${previewTask?.hiddenCss || ""}\n${previewTask?.readonlyCss || ""}\n${previewTask?.editableCss || ""}`}
                    targetSelectors={previewTask?.targetSelectors}
                    checks={previewTask?.checks}
                    visualPreviewSupported={visualPreviewSupported}
                  />
                </section>
              </>
            ) : (
              <Resizable
                className={`lesson-top-row ${isLessonContentHidden ? "is-expanded" : ""} ${isLessonContentAnimating ? "is-animating" : ""}`}
                size={{
                  width: "100%",
                  height: isLessonContentHidden
                    ? "calc(100% - 2.25rem)"
                    : `${topRowPercent}%`,
                }}
                enable={{ bottom: !isLessonContentHidden }}
                minHeight={isLessonContentHidden ? 0 : 100}
                maxHeight={isLessonContentHidden ? "100%" : "90%"}
                onResize={handleTopRowResize}
                onResizeStop={handleTopRowResize}
                handleComponent={{
                  bottom: <div className="resize-handle-bottom" />,
                }}
                handleStyles={{ bottom: { height: 16 } }}
              >
                <div className="lesson-top-inner">
                  <Resizable
                    className="lesson-editor"
                    size={{ width: `${editorPercent}%`, height: "100%" }}
                    enable={{ right: true }}
                    minWidth="15%"
                    maxWidth="85%"
                    onResize={handleEditorResize}
                    onResizeStop={handleEditorResize}
                    handleComponent={{
                      right: <div className="resize-handle-right" />,
                    }}
                    handleStyles={{ right: { width: 16 } }}
                  >
                    <EditorPane
                      task={currentTaskState}
                      currentIndex={currentTaskIndex}
                      onTaskChange={updateTask}
                      readonlyHtml={effectiveTask?.readonlyHtml}
                      readonlyCss={effectiveTask?.readonlyCss}
                      readonlyJs={effectiveTask?.readonlyJs}
                      onSubmit={handleSubmit}
                      isSubmitted={completedTasks.has(currentTaskId)}
                    />
                  </Resizable>

                  <div
                    className="lesson-preview"
                    style={{ width: `${100 - editorPercent}%` }}
                  >
                    <PreviewPane
                      html={srcDoc}
                      visualHtml={`${previewTask?.hiddenHtml || ""}${previewTask?.readonlyHtml || ""}${previewTask?.editableHtml || ""}`}
                      visualCss={`${previewTask?.hiddenCss || ""}\n${previewTask?.readonlyCss || ""}\n${previewTask?.editableCss || ""}`}
                      solutionCss={`${previewTask?.hiddenCss || ""}\n${previewTask?.readonlyCss || ""}\n${previewTask?.solutionCss || ""}`}
                      solutionHtml={
                        previewTask?.solutionHtml !== undefined
                          ? `${previewTask?.hiddenHtml || ""}${previewTask?.readonlyHtml || ""}${previewTask?.solutionHtml || ""}`
                          : `${previewTask?.hiddenHtml || ""}${previewTask?.readonlyHtml || ""}${previewTask?.editableHtml || ""}`
                      }
                      initialCss={`${previewTask?.hiddenCss || ""}\n${previewTask?.readonlyCss || ""}\n${previewTask?.editableCss || ""}`}
                      targetSelectors={previewTask?.targetSelectors}
                      checks={previewTask?.checks}
                      visualPreviewSupported={visualPreviewSupported}
                    />
                  </div>
                </div>
              </Resizable>
            )}

            <div className="lesson-content-toggle-row">
              <button
                type="button"
                className="lesson-content-toggle"
                onClick={toggleLessonContent}
                aria-expanded={!isLessonContentHidden}
              >
                {isLessonContentHidden ? (
                  <>
                    <ChevronUp size={16} />
                    Show lesson content
                  </>
                ) : (
                  <>
                    <ChevronDown size={16} />
                    Hide lesson content
                  </>
                )}
              </button>
            </div>

            <div
              ref={lessonContentRef}
              className={`lesson-content ${isMobileLayout ? "lesson-content-mobile" : ""} ${isLessonContentHidden ? "is-hidden" : ""} ${isLessonContentAnimating ? "is-animating" : ""}`}
              style={
                isMobileLayout
                  ? undefined
                  : {
                      height: isLessonContentHidden
                        ? "0%"
                        : `${100 - topRowPercent}%`,
                    }
              }
            >
              {isNew ? (
                <div
                  className="admin-new-lesson-placeholder"
                  style={{ padding: 40, textAlign: "center" }}
                >
                  <h1>New Course: {slug}</h1>
                  <p>
                    You are in creation mode. Add tasks and edit code above.
                  </p>
                </div>
              ) : (
                <MDXProvider>{LessonContent && <LessonContent />}</MDXProvider>
              )}
            </div>
          </section>
        </div>

        <Modal
          title="Authentication Required"
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
        >
          <p>
            {isOnlineMode
              ? "You need to be signed in to submit your solution"
              : "Submissions are disabled in offline mode"}
          </p>
        </Modal>

        <Modal
          title="Reset Task"
          isOpen={showResetModal}
          onClose={() => setShowResetModal(false)}
          actions={
            <>
              <button
                className="btn-ghost"
                onClick={() => setShowResetModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  applyResetTask(resetTaskIndex);
                  setShowResetModal(false);
                }}
              >
                Reset
              </button>
            </>
          }
        >
          <p>
            Are you sure you want to reset task {resetTaskIndex + 1}? All your
            changes will be lost.
          </p>
        </Modal>
      </Suspense>
    </main>
  );
}
