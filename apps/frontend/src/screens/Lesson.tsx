import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useParams, useSearchParams } from "react-router";
import { Resizable, type ResizeCallback } from "re-resizable";
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
import RuntimeMdx from "@/components/RuntimeMdx";
import {
  getLessonMeta,
  loadLessons,
  setDefaultLessonContent,
  type LessonMeta,
} from "@/lib/helpers/getLessons";
import {
  getDefaultLessonTasksSync,
  getLessonTasksSync,
  mergeLegacyEditableSource,
  normalizeTaskCode,
  setDefaultLessonTasks,
  type TaskCode,
} from "@/lib/helpers/getTasks";
import {
  isAddedLessonDraft,
  saveLessonTasksDraft,
} from "@/lib/helpers/lessonDrafts";
import {
  getStudentLessonDraft,
  saveStudentLessonDraft,
} from "@/lib/helpers/studentDrafts";
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
import { fetchLesson } from "@/lib/api/lessons";
import EvaluationPanel from "@/features/challenge/EvaluationPanel";
import { useTaskEvaluation } from "@/features/challenge/useTaskEvaluation";
import type { AnalysisIssue } from "@wda/css-analysis";

type TaskFileState = Pick<Partial<TaskCode>, "html" | "css" | "js">;

const normalizeCode = (value?: string) => (value ?? "").replace(/\r\n/g, "\n");

const getTaskFileState = (task?: Partial<TaskCode>): TaskFileState => ({
  html: task?.html,
  css: task?.css,
  js: task?.js,
});

const areTaskFileStatesEqual = (left?: TaskFileState, right?: TaskFileState) =>
  normalizeCode(left?.html) === normalizeCode(right?.html) &&
  normalizeCode(left?.css) === normalizeCode(right?.css) &&
  normalizeCode(left?.js) === normalizeCode(right?.js);

const getSubmittedTaskState = (
  task: Partial<TaskCode>,
  submission: { html: string; css: string; js: string },
): TaskFileState => ({
  html: mergeLegacyEditableSource(task.html, submission.html, "html"),
  css: mergeLegacyEditableSource(task.css, submission.css, "css"),
  js: mergeLegacyEditableSource(task.js, submission.js, "js"),
});

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
  const [lessonMeta, setLessonMeta] = useState<LessonMeta | undefined>();
  const [lessonContent, setLessonContent] = useState("");
  const [lessonLoadError, setLessonLoadError] = useState<string | null>(null);

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
  const [autosaveStatus, setAutosaveStatus] = useState<
    "saved" | "saving" | "pending" | "error"
  >("saved");
  const [autosaveRevision, setAutosaveRevision] = useState(0);
  const [submissionBaselines, setSubmissionBaselines] = useState<
    Record<string, TaskFileState>
  >({});
  const [editorFocusRequest, setEditorFocusRequest] = useState<{
    line: number;
    nonce: number;
  } | null>(null);

  const lessonContentRef = useRef<HTMLDivElement | null>(null);
  const lessonContentAnimationTimeoutRef = useRef<number | undefined>(
    undefined,
  );
  const lastAutoFocusKeyRef = useRef("");
  const tasksRef = useRef<Partial<TaskCode>[]>([]);
  const taskStatesRef = useRef<Partial<TaskCode>[]>([]);
  const persistAutosaveDraftRef = useRef<() => void>(() => {});
  const autosaveRevisionRef = useRef(0);
  const autosaveStatusRef = useRef<"saved" | "saving" | "pending" | "error">(
    "saved",
  );
  const persistAutosaveDraft = useCallback(() => {
    if (!slug || loadedSubmission) return;

    if (isAdmin) {
      const persisted = taskStatesRef.current.map((state, idx) => ({
        ...tasksRef.current[idx],
        ...state,
      }));
      saveLessonTasksDraft(slug, persisted);
      return;
    }

    saveStudentLessonDraft(slug, taskStatesRef.current, user?.userId);
  }, [isAdmin, loadedSubmission, slug, user?.userId]);

  useEffect(() => {
    persistAutosaveDraftRef.current = persistAutosaveDraft;
  }, [persistAutosaveDraft]);

  const setTasksSnapshot = (nextTasks: Partial<TaskCode>[]) => {
    tasksRef.current = nextTasks;
    setTasks(nextTasks);
  };

  const setTaskStatesSnapshot = (nextTaskStates: Partial<TaskCode>[]) => {
    taskStatesRef.current = nextTaskStates;
    setTaskStates(nextTaskStates);
  };

  const updateTaskStatesSnapshot = (
    updater: (prev: Partial<TaskCode>[]) => Partial<TaskCode>[],
  ) => {
    setTaskStates((prev) => {
      const updated = updater(prev);
      taskStatesRef.current = updated;
      return updated;
    });
  };

  const setAutosaveStatusSnapshot = useCallback(
    (nextStatus: "saved" | "saving" | "pending" | "error") => {
      autosaveStatusRef.current = nextStatus;
      setAutosaveStatus(nextStatus);
    },
    [],
  );

  const markAutosaveChanged = useCallback(() => {
    autosaveRevisionRef.current += 1;
    setAutosaveRevision(autosaveRevisionRef.current);
    setAutosaveStatusSnapshot("pending");
  }, [setAutosaveStatusSnapshot]);

  const markAutosaveSaved = useCallback(() => {
    autosaveRevisionRef.current = 0;
    setAutosaveRevision(0);
    setAutosaveStatusSnapshot("saved");
  }, [setAutosaveStatusSnapshot]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    setIsNew(null);
    setLessonMeta(undefined);
    setLessonContent("");
    setLessonLoadError(null);
    setCurrentTaskIndex(0);

    const loadLesson = async () => {
      try {
        await loadLessons();
        const addedDraft = isAddedLessonDraft(slug);

        if (!addedDraft) {
          const detail = await fetchLesson(slug);
          setDefaultLessonTasks(slug, detail.tasks);
          setDefaultLessonContent(slug, detail.content);
          if (!cancelled) setLessonContent(detail.content);
        }

        if (cancelled) return;

        const localTasks = getLessonTasksSync(slug).filter(
          (task) => isAdmin || !task.deleted,
        );
        const studentDraft =
          !isAdmin && !submissionId
            ? getStudentLessonDraft(slug, user?.userId)
            : null;
        const nextTaskStates = localTasks.map((task, index) => {
          if (isAdmin) return { ...task };

          const draftTask = studentDraft?.tasks[index]
            ? normalizeTaskCode(studentDraft.tasks[index], task)
            : undefined;
          return {
            html: draftTask?.html ?? task.html,
            css: draftTask?.css ?? task.css,
            js: draftTask?.js ?? task.js,
          };
        });

        setLessonMeta(getLessonMeta(slug));
        setIsNew(addedDraft);
        setTasksSnapshot(localTasks);
        setTaskStatesSnapshot(nextTaskStates);
        setSubmissionBaselines({});
        markAutosaveSaved();
      } catch (error) {
        if (cancelled) return;
        setLessonLoadError(
          error instanceof Error ? error.message : "Failed to load lesson",
        );
        setIsNew(false);
      }
    };

    void loadLesson();

    return () => {
      cancelled = true;
    };
  }, [isAdmin, markAutosaveSaved, slug, submissionId, user?.userId]);

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
        const submittedTaskState = getSubmittedTaskState(
          tasks[targetTaskIndex],
          loadedSubmission,
        );
        setSubmissionBaselines({
          [loadedSubmission.task_id]: submittedTaskState,
        });

        updateTaskStatesSnapshot((prev) =>
          prev.map((s, idx) => {
            if (idx === targetTaskIndex) {
              return {
                ...s,
                ...submittedTaskState,
              };
            }
            return s;
          }),
        );
      }
    }
  }, [loadedSubmission, tasks]);

  useEffect(() => {
    const submissions = latestLessonSubmissions?.items ?? [];

    if (submissions.length === 0 || tasks.length === 0 || submissionId) {
      return;
    }

    setSubmissionBaselines(
      Object.fromEntries(
        submissions.map((submission) => {
          const taskIndex = Number.parseInt(submission.task_id, 10) - 1;
          return [
            submission.task_id,
            getSubmittedTaskState(tasks[taskIndex] ?? {}, submission),
          ];
        }),
      ),
    );

    updateTaskStatesSnapshot((prev) =>
      prev.map((state, index) => {
        const savedSubmission = submissions.find(
          (submission) => submission.task_id === String(index + 1),
        );
        const storedDraftTask = slug
          ? getStudentLessonDraft(slug, user?.userId)?.tasks[index]
          : undefined;
        const draftTask = storedDraftTask
          ? normalizeTaskCode(storedDraftTask, tasks[index])
          : undefined;
        const submittedTask = savedSubmission
          ? getSubmittedTaskState(tasks[index], savedSubmission)
          : undefined;

        if (!savedSubmission && !draftTask) {
          return state;
        }

        return {
          ...state,
          html: draftTask?.html ?? submittedTask?.html ?? state.html,
          css: draftTask?.css ?? submittedTask?.css ?? state.css,
          js: draftTask?.js ?? submittedTask?.js ?? state.js,
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
  }, [latestLessonSubmissions, slug, submissionId, tasks, user?.userId]);

  useEffect(() => {
    if (!slug || autosaveRevision === 0 || loadedSubmission) {
      return;
    }

    setAutosaveStatusSnapshot("pending");

    const timeout = window.setTimeout(() => {
      try {
        setAutosaveStatusSnapshot("saving");
        persistAutosaveDraft();
        markAutosaveSaved();
      } catch (error) {
        console.error("Failed to autosave editor draft:", error);
        setAutosaveStatusSnapshot("error");
      }
    }, 1500);

    return () => window.clearTimeout(timeout);
  }, [
    autosaveRevision,
    loadedSubmission,
    markAutosaveSaved,
    persistAutosaveDraft,
    setAutosaveStatusSnapshot,
    slug,
  ]);

  useEffect(() => {
    return () => {
      if (autosaveRevisionRef.current === 0) return;

      try {
        persistAutosaveDraftRef.current();
      } catch (error) {
        console.error("Failed to save editor draft before leaving:", error);
      }
    };
  }, []);

  useEffect(() => {
    if (autosaveRevision === 0 || autosaveStatus === "saved") {
      return;
    }

    const flushDraft = () => {
      try {
        persistAutosaveDraft();
      } catch (error) {
        console.error("Failed to flush editor draft:", error);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushDraft();
      }
    };

    window.addEventListener("pagehide", flushDraft);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (
        autosaveRevisionRef.current > 0 &&
        autosaveStatusRef.current !== "saved"
      ) {
        flushDraft();
      }
      window.removeEventListener("pagehide", flushDraft);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [autosaveRevision, autosaveStatus, persistAutosaveDraft]);

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

  const evaluationTask = tasks[currentTaskIndex]
    ? {
        ...tasks[currentTaskIndex],
        ...taskStates[currentTaskIndex],
      }
    : undefined;
  const lessonVisualPreviewEnabled = Boolean(lessonMeta?.visualPreview);
  const lessonVisualEditorEnabled = Boolean(lessonMeta?.visualEditor);
  const taskSupportsVisualPreview = !evaluationTask?.js;
  const visualPreviewActive =
    lessonVisualPreviewEnabled &&
    taskSupportsVisualPreview &&
    visualPreviewEnabled;
  const taskEvaluation = useTaskEvaluation(
    evaluationTask,
    visualPreviewActive,
    currentTaskIndex,
  );
  const [evaluationViewRequest, setEvaluationViewRequest] = useState(0);

  useEffect(() => {
    if (!lessonVisualPreviewEnabled || !taskSupportsVisualPreview) {
      setVisualPreviewEnabled(false);
    }
    if (!lessonVisualEditorEnabled) {
      setVisualEditorEnabled(false);
    }
  }, [
    lessonVisualEditorEnabled,
    lessonVisualPreviewEnabled,
    setVisualEditorEnabled,
    setVisualPreviewEnabled,
    taskSupportsVisualPreview,
  ]);

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
  if (lessonLoadError) {
    return (
      <main className="lesson-container">
        <p className="admin-error" style={{ margin: 24 }}>
          {lessonLoadError}
        </p>
      </main>
    );
  }
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
  const visualPreviewSupported = lessonVisualPreviewEnabled && !previewTask.js;
  const currentStudentBaseline =
    submissionBaselines[currentTaskId] ?? getTaskFileState(currentTask);
  const hasStudentTaskChanges = !areTaskFileStatesEqual(
    getTaskFileState(currentTaskState),
    currentStudentBaseline,
  );
  const needsPassingEvaluation =
    visualPreviewActive && Boolean(effectiveTask.evaluation);
  const hasPassingEvaluation =
    taskEvaluation.result?.passed === true && !taskEvaluation.isResultStale;
  const isSubmitDisabled =
    !isAdmin &&
    (!hasStudentTaskChanges ||
      (needsPassingEvaluation && !hasPassingEvaluation));
  const submitDisabledTitle =
    needsPassingEvaluation && !hasPassingEvaluation
      ? "Evaluate the current solution successfully before submitting."
      : completedTasks.has(currentTaskId)
        ? "Make a change before resubmitting."
        : "Make a change before submitting.";
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
        ${previewTask.css || ""}
      </style>
    </head>
    <body>
      ${previewTask.html || ""}
      <script>
        ${previewTask.js || ""}
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
    updateTaskStatesSnapshot((prev) =>
      prev.map((s, idx) =>
        idx === currentTaskIndex ? { ...s, [field]: value } : s,
      ),
    );
    markAutosaveChanged();
  };

  const updateTaskMetadata = <K extends keyof TaskCode>(
    field: K,
    value: TaskCode[K],
  ) => {
    updateTaskStatesSnapshot((prev) =>
      prev.map((state, index) =>
        index === currentTaskIndex ? { ...state, [field]: value } : state,
      ),
    );
    markAutosaveChanged();
  };

  const applyResetTask = (taskIndex = currentTaskIndex) => {
    updateTaskStatesSnapshot((prev) => {
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
              html: tasks[idx].html,
              css: tasks[idx].css,
              js: tasks[idx].js,
            };
      });

      if (isAdmin && slug && !loadedSubmission) {
        const persisted = updated.map((state, idx) => ({
          ...tasks[idx],
          ...state,
        }));
        saveLessonTasksDraft(slug, persisted);
      } else if (!isAdmin && slug && !loadedSubmission) {
        saveStudentLessonDraft(slug, updated, user?.userId);
      }
      setAutosaveStatusSnapshot("saved");
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
      html: "<h1>New Task</h1>\n<p>Start editing...</p>",
      css: "h1 { color: blue; }",
    };
    const updatedTasks = [...tasks, newTask];
    const updatedTaskStates = [...taskStates, newTask];
    setTasksSnapshot(updatedTasks);
    setTaskStatesSnapshot(updatedTaskStates);
    setCurrentTaskIndex(updatedTasks.length - 1);

    saveLessonTasksDraft(slug, updatedTaskStates);
    setAutosaveStatusSnapshot("saved");
  };

  const deleteTask = (taskIndex = currentTaskIndex) => {
    if (!isAdmin || !slug) return;

    const updatedTaskStates = taskStates.map((state, index) =>
      index === taskIndex ? { ...state, deleted: true } : state,
    );

    setCurrentTaskIndex(taskIndex);
    setTaskStatesSnapshot(updatedTaskStates);
    saveLessonTasksDraft(slug, updatedTaskStates);
    setAutosaveStatusSnapshot("saved");
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

    const evaluationResult = taskEvaluation.result;
    if (
      visualPreviewActive &&
      effectiveTask.evaluation &&
      (!evaluationResult?.passed || taskEvaluation.isResultStale)
    ) {
      setIsLessonContentHidden(false);
      return false;
    }

    await submitMutation.mutateAsync({
      lessonSlug: slug!,
      taskId: currentTaskId,
      html: currentTaskState.html || "",
      css: (cssOverride ?? currentTaskState.css) || "",
      js: currentTaskState.js || "",
      evaluation:
        visualPreviewActive && evaluationResult
          ? {
              version: effectiveTask.evaluation?.version ?? 1,
              status: evaluationResult.status,
              score: evaluationResult.score,
              passed: evaluationResult.passed,
              issues: evaluationResult.results,
            }
          : undefined,
    });

    setCompletedTasks((prev) => new Set(prev).add(currentTaskId));
    setSubmissionBaselines((prev) => ({
      ...prev,
      [currentTaskId]: {
        html: currentTaskState.html || "",
        css: (cssOverride ?? currentTaskState.css) || "",
        js: currentTaskState.js || "",
      },
    }));
    return true;
  };

  const evaluationResults =
    visualPreviewActive && effectiveTask.evaluation ? (
      <EvaluationPanel
        config={effectiveTask.evaluation}
        result={taskEvaluation.result}
        liveIssues={taskEvaluation.liveIssues}
        isEvaluating={taskEvaluation.isEvaluating}
        isStale={taskEvaluation.isResultStale}
        onIssueClick={(issue: AnalysisIssue) =>
          setEditorFocusRequest({
            line: issue.lineNumber,
            nonce: Date.now(),
          })
        }
      />
    ) : null;
  const handleEvaluate = async () => {
    setEvaluationViewRequest((request) => request + 1);
    return taskEvaluation.evaluate();
  };

  return (
    <main
      className={`lesson-container ${isMobileLayout ? "lesson-container-mobile" : ""}`}
    >
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
                aria-disabled={!lessonVisualEditorEnabled}
                disabled={!lessonVisualEditorEnabled}
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
                aria-disabled={!visualPreviewSupported}
                disabled={!visualPreviewSupported}
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
                  onSubmit={handleSubmit}
                  isSubmitted={completedTasks.has(currentTaskId)}
                  isSubmitDisabled={isSubmitDisabled}
                  submitDisabledTitle={submitDisabledTitle}
                  autosaveStatus={autosaveStatus}
                  autosaveLabelPrefix={isAdmin ? "Task draft" : "Work"}
                  diagnostics={
                    taskEvaluation.result && !taskEvaluation.isResultStale
                      ? taskEvaluation.result.results
                      : taskEvaluation.liveIssues
                  }
                  focusRequest={editorFocusRequest}
                  onEvaluationChange={(evaluation) =>
                    updateTaskMetadata("evaluation", evaluation)
                  }
                  onEvaluate={handleEvaluate}
                  isEvaluating={taskEvaluation.isEvaluating}
                  evaluationEnabled={
                    visualPreviewActive && Boolean(effectiveTask.evaluation)
                  }
                  visualEditorSupported={lessonVisualEditorEnabled}
                  onGenerateEvaluation={async () => {
                    const analyzer = await import("@wda/css-analysis");
                    const evaluation = analyzer.generateEvaluationChecks(
                      effectiveTask.solutionCss ?? "",
                    );
                    updateTaskMetadata("evaluation", evaluation);
                    return evaluation;
                  }}
                />
              </section>

              <section className="lesson-mobile-preview">
                <PreviewPane
                  html={srcDoc}
                  visualHtml={previewTask.html}
                  visualCss={previewTask.css}
                  visualPreviewSupported={visualPreviewSupported}
                  solutionHtml={previewTask.solutionHtml}
                  solutionCss={previewTask.solutionCss}
                  evaluationContent={evaluationResults}
                  evaluationViewRequest={evaluationViewRequest}
                  onSelectSelector={(selector) => {
                    const line = (previewTask.css ?? "")
                      .split("\n")
                      .findIndex((sourceLine) => sourceLine.includes(selector));
                    setEditorFocusRequest({
                      line: line >= 0 ? line + 1 : 1,
                      nonce: Date.now(),
                    });
                  }}
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
                    onSubmit={handleSubmit}
                    isSubmitted={completedTasks.has(currentTaskId)}
                    isSubmitDisabled={isSubmitDisabled}
                    submitDisabledTitle={submitDisabledTitle}
                    autosaveStatus={autosaveStatus}
                    autosaveLabelPrefix={isAdmin ? "Task draft" : "Work"}
                    diagnostics={
                      taskEvaluation.result && !taskEvaluation.isResultStale
                        ? taskEvaluation.result.results
                        : taskEvaluation.liveIssues
                    }
                    focusRequest={editorFocusRequest}
                    onEvaluationChange={(evaluation) =>
                      updateTaskMetadata("evaluation", evaluation)
                    }
                    onEvaluate={handleEvaluate}
                    isEvaluating={taskEvaluation.isEvaluating}
                    evaluationEnabled={
                      visualPreviewActive && Boolean(effectiveTask.evaluation)
                    }
                    visualEditorSupported={lessonVisualEditorEnabled}
                    onGenerateEvaluation={async () => {
                      const analyzer = await import("@wda/css-analysis");
                      const evaluation = analyzer.generateEvaluationChecks(
                        effectiveTask.solutionCss ?? "",
                      );
                      updateTaskMetadata("evaluation", evaluation);
                      return evaluation;
                    }}
                  />
                </Resizable>

                <div
                  className="lesson-preview"
                  style={{ width: `${100 - editorPercent}%` }}
                >
                  <PreviewPane
                    html={srcDoc}
                    visualHtml={previewTask.html}
                    visualCss={previewTask.css}
                    visualPreviewSupported={visualPreviewSupported}
                    solutionHtml={previewTask.solutionHtml}
                    solutionCss={previewTask.solutionCss}
                    evaluationContent={evaluationResults}
                    evaluationViewRequest={evaluationViewRequest}
                    onSelectSelector={(selector) => {
                      const line = (previewTask.css ?? "")
                        .split("\n")
                        .findIndex((sourceLine) =>
                          sourceLine.includes(selector),
                        );
                      setEditorFocusRequest({
                        line: line >= 0 ? line + 1 : 1,
                        nonce: Date.now(),
                      });
                    }}
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
                <p>You are in creation mode. Add tasks and edit code above.</p>
              </div>
            ) : (
              <>
                {lessonContent ? <RuntimeMdx source={lessonContent} /> : null}
              </>
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
    </main>
  );
}
