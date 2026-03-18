import { lazy, Suspense, useEffect, useState } from "react";
import {
  Navigate,
  useParams,
  useSearchParams,
} from "react-router";
import { Resizable, type ResizeCallback } from "re-resizable";
import { MDXProvider } from "@mdx-js/react";
import type { MDXContent } from "mdx/types";

import "@/styles/lesson.css";
import EditorPane from "@/components/EditorPane";
import PreviewPane from "@/components/PreviewPane";
import LoadingSpinner from "@/components/LoadingSpinner";
import Modal from "@/components/Modal";
import { getLessonTasksSync, type TaskCode } from "@/lib/helpers/getTasks";
import { useAuth } from "@/lib/ctx/useAuth";

import { useSubmitSolution, useSubmission } from "@/lib/hooks/useSubmissions";

export default function Lesson() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const submissionId = searchParams.get("submissionId");

  const { token, isAuthenticated, user } = useAuth();

  const isAdmin = user?.role === "admin";
  const [isNew, setIsNew] = useState(false);

  const submitMutation = useSubmitSolution();
  const { data: loadedSubmission, isLoading: isLoadingSubmission } =
    useSubmission(submissionId || "");

  const [tasks, setTasks] = useState<Partial<TaskCode>[]>([]);
  const [taskStates, setTaskStates] = useState<Partial<TaskCode>[]>([]);
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [editorPercent, setEditorPercent] = useState(40);
  const [topRowPercent, setTopRowPercent] = useState(60);

  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());
  const [showLoginModal, setShowLoginModal] = useState(false);

  const [LessonContent, setLessonContent] =
    useState<React.LazyExoticComponent<MDXContent> | null>(null);

  useEffect(() => {
    if (!slug) return;

    import("@/lib/helpers/adminStorage").then((m) => {
      setIsNew(m.isCustomCourse(slug));
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

    if (!isNew) {
      setLessonContent(lazy(() => import(`../lessons/${slug}/index.mdx`)));
    }
  }, [slug, isNew]);

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
    if (slug && isAuthenticated && token) {
      fetch(`/api/progress/${slug}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.completedTaskIds) {
            setCompletedTasks(new Set(data.completedTaskIds));
          }
        })
    }
  }, [slug, isAuthenticated, token]);

  if (!tasks.length || isLoadingSubmission) return <LoadingSpinner />;

  const currentTask = tasks[currentTaskIndex];
  const currentTaskState = taskStates[currentTaskIndex];
  const currentTaskId = (currentTaskIndex + 1).toString();

  if (!currentTask && !isNew) return <Navigate to="/" />;

  const srcDoc = `
  <!DOCTYPE html>
  <html>
    <head>
      <base target="_blank" />
      <meta
        http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:;"
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
      if (isAdmin && slug) {
        import("@/lib/helpers/adminStorage").then((m) => {
          m.saveCustomTasks(slug, updated);
        });
      }
      return updated;
    });
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

  const handleSubmit = async () => {
    if (!currentTaskState) return;

    if (!token) {
      setShowLoginModal(true);
      return;
    }

    if (isAdmin) return;

    submitMutation.mutate(
      {
        lessonSlug: slug!,
        taskId: currentTaskId,
        html: currentTaskState.editableHtml || "",
        css: currentTaskState.editableCss || "",
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
    <main className="lesson-container">
      <Suspense fallback={<LoadingSpinner />}>
        <Resizable
          className="lesson-top-row"
          size={{ width: "100%", height: `${topRowPercent}%` }}
          enable={{ bottom: true }}
          minHeight={100}
          maxHeight="90%"
          onResize={handleTopRowResize}
          onResizeStop={handleTopRowResize}
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

        <div
          className="lesson-content"
          style={{ height: `${100 - topRowPercent}%` }}
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

        <Modal
          title="Authentication Required"
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
        >
          <p>
            You need to be signed in to submit your solution
          </p>
        </Modal>
      </Suspense>
    </main>
  );
}
