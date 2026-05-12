import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Navigate, useParams, useSearchParams } from "react-router";
import { Resizable, type ResizeCallback } from "re-resizable";
import { MDXProvider } from "@mdx-js/react";
import type { MDXContent } from "mdx/types";

import "@/styles/lesson.css";
import EditorPane from "@/components/EditorPane";
import PreviewPane from "@/components/PreviewPane";
import LoadingSpinner from "@/components/LoadingSpinner";
import Modal from "@/components/Modal";
import { getLessonMeta } from "@/lib/helpers/getLessons";
import { getLessonTasksSync, type TaskCode } from "@/lib/helpers/getTasks";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  submitSolution,
  fetchSubmissionById,
  type SubmissionPayload,
} from "@/lib/api/submissions";
import { useAuth } from "@/lib/ctx/useAuth";
import { isOnlineMode } from "@/lib/config/appMode";

export default function Lesson() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const submissionId = searchParams.get("submissionId");

  const { isAuthenticated, user } = useAuth();

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

  const [tasks, setTasks] = useState<Partial<TaskCode>[]>([]);
  const [taskStates, setTaskStates] = useState<Partial<TaskCode>[]>([]);
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [editorPercent, setEditorPercent] = useState(45);
  const [topRowPercent, setTopRowPercent] = useState(60);
  const [isMobileLayout, setIsMobileLayout] = useState(
    typeof window !== "undefined" ? window.innerWidth <= 900 : false,
  );

  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  const [LessonContent, setLessonContent] =
    useState<React.LazyExoticComponent<MDXContent> | null>(null);
  const lessonContentRef = useRef<HTMLDivElement | null>(null);
  const lastAutoFocusKeyRef = useRef("");
  const lessonMeta = slug ? getLessonMeta(slug) : undefined;

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;

    import("@/lib/helpers/adminStorage").then((m) => {
      if (cancelled) return;

      const customCourse = m.isCustomCourse(slug);
      setIsNew(customCourse);

      if (!customCourse) {
        setLessonContent(lazy(() => import(`../lessons/${slug}/index.mdx`)));
      } else {
        setLessonContent(null);
      }
    });

    const localTasks = getLessonTasksSync(slug);
    setTasks(localTasks);
    setTaskStates(
      localTasks.map((t) => ({
        editableHtml: t.editableHtml,
        editableCss: t.editableCss,
        editableJs: t.editableJs,
      })),
    );

    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    const onResize = () => {
      setIsMobileLayout(window.innerWidth <= 900);
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
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
    if (slug && isOnlineMode && isAuthenticated) {
      fetch(`/api/progress/${slug}`)
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
  if (lessonMeta?.hidden && !isNew) return <Navigate to="/" />;
  if (!tasks.length) return <Navigate to={isNew ? "/admin" : "/"} />;

  const currentTask = tasks[currentTaskIndex];
  const currentTaskState = taskStates[currentTaskIndex];
  const currentTaskId = (currentTaskIndex + 1).toString();

  if (!currentTask) return <Navigate to={isNew ? "/admin" : "/"} />;

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
        ${currentTask?.hiddenCss || ""}
        ${currentTask?.readonlyCss || ""}
        ${currentTaskState?.editableCss || ""}
      </style>
    </head>
    <body>
      ${currentTask?.hiddenHtml || ""}
      ${currentTask?.readonlyHtml || ""}
      ${currentTaskState?.editableHtml || ""}
      <script>
        ${currentTask?.hiddenJs || ""}
        ${currentTask?.readonlyJs || ""}
        ${currentTaskState?.editableJs || ""}
      </script>
    </body>
  </html>
  `;

  const handleEditorResize: ResizeCallback = (_e, _dir, ref) => {
    const parentWidth = ref.parentElement!.offsetWidth;
    setEditorPercent((ref.offsetWidth / parentWidth) * 100);
  };

  const handleTopRowResize: ResizeCallback = (_e, _dir, ref) => {
    const containerHeight = ref.parentElement!.offsetHeight;
    setTopRowPercent((ref.offsetHeight / containerHeight) * 100);
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
        import("@/lib/helpers/adminStorage").then((m) => {
          m.saveCustomTasks(slug, persisted);
        });
      }
      return updated;
    });
  };

  const applyResetTask = () => {
    setTaskStates((prev) => {
      const updated = prev.map((s, idx) => {
        if (idx !== currentTaskIndex) {
          return s;
        }

        return {
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
        import("@/lib/helpers/adminStorage").then((m) => {
          m.saveCustomTasks(slug, persisted);
        });
      }
      return updated;
    });
  };

  const resetTask = () => {
    setShowResetModal(true);
  };

  const addTask = () => {
    if (!isAdmin || !slug) return;

    import("@/lib/helpers/adminStorage").then((m) => {
      if (!m.isCustomCourse(slug)) {
        import("@/lib/helpers/getLessons").then((l) => {
          const lessons = l.getLessons();
          const currentMeta = lessons.find((c) => c.slug === slug);
          if (currentMeta) {
            m.saveCustomCourse(currentMeta);
          }
        });
      }

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

      m.saveCustomTasks(slug, updatedTaskStates);
    });
  };

  const handleSubmit = async (cssOverride?: string) => {
    if (!currentTaskState) return;
    if (!isOnlineMode) {
      setShowLoginModal(true);
      return;
    }
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    if (isAdmin) return;

    submitMutation.mutate(
      {
        lessonSlug: slug!,
        taskId: currentTaskId,
        html: currentTaskState.editableHtml || "",
        css: (cssOverride ?? currentTaskState.editableCss) || "",
        js: currentTaskState.editableJs || "",
      },
      {
        onSuccess: () => {
          setCompletedTasks((prev) => new Set(prev).add(currentTaskId));
        },
      },
    );
  };

  return (
    <main
      className={`lesson-container ${isMobileLayout ? "lesson-container-mobile" : ""}`}
    >
      <Suspense fallback={<LoadingSpinner />}>
        <>
          {isMobileLayout ? (
            <>
              <section className="lesson-mobile-editor">
                <EditorPane
                  task={currentTaskState}
                  currentIndex={currentTaskIndex}
                  totalTasks={tasks.length}
                  onTaskChange={updateTask}
                  onChangeTask={(idx) => setCurrentTaskIndex(idx)}
                  readonlyHtml={currentTask?.readonlyHtml}
                  readonlyCss={currentTask?.readonlyCss}
                  readonlyJs={currentTask?.readonlyJs}
                  onSubmit={handleSubmit}
                  completedTasks={completedTasks}
                  currentTaskId={currentTaskId}
                  onAddTask={addTask}
                  onResetTask={resetTask}
                  lessonSlug={slug}
                />
              </section>

              <section className="lesson-mobile-preview">
                <PreviewPane html={srcDoc} />
              </section>
            </>
          ) : (
            <Resizable
              className="lesson-top-row"
              size={{ width: "100%", height: `${topRowPercent}%` }}
              enable={{ bottom: true }}
              minHeight={100}
              maxHeight="90%"
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
                    totalTasks={tasks.length}
                    onTaskChange={updateTask}
                    onChangeTask={(idx) => setCurrentTaskIndex(idx)}
                    readonlyHtml={currentTask?.readonlyHtml}
                    readonlyCss={currentTask?.readonlyCss}
                    readonlyJs={currentTask?.readonlyJs}
                    onSubmit={handleSubmit}
                    completedTasks={completedTasks}
                    currentTaskId={currentTaskId}
                    onAddTask={addTask}
                    onResetTask={resetTask}
                    lessonSlug={slug}
                  />
                </Resizable>

                <div
                  className="lesson-preview"
                  style={{ width: `${100 - editorPercent}%` }}
                >
                  <PreviewPane html={srcDoc} />
                </div>
              </div>
            </Resizable>
          )}

          <div
            ref={lessonContentRef}
            className={`lesson-content ${isMobileLayout ? "lesson-content-mobile" : ""}`}
            style={
              isMobileLayout ? undefined : { height: `${100 - topRowPercent}%` }
            }
          >
            {isNew ? (
              <div
                className="admin-new-lesson-placeholder"
                style={{ padding: 40, textAlign: "center" }}
              >
                <h1>New Course: {slug}</h1>
                <p>You are in creation mode. Add tasks and edit code above.</p>
              </div>
            ) : (
              <MDXProvider>{LessonContent && <LessonContent />}</MDXProvider>
            )}
          </div>
        </>

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
                  applyResetTask();
                  setShowResetModal(false);
                }}
              >
                Reset
              </button>
            </>
          }
        >
          <p>
            Are you sure you want to reset this task? All your changes will be
            lost.
          </p>
        </Modal>
      </Suspense>
    </main>
  );
}
