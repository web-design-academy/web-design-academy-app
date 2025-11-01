import { lazy, Suspense, useMemo, useState } from "react";
import { Navigate, useParams } from "react-router";
import { Resizable, type ResizeCallback } from "re-resizable";

import "@/styles/lesson.css";
import EditorPane from "@/components/EditorPane";
import PreviewPane from "@/components/PreviewPane";
import { MDXProvider } from "@mdx-js/react";
import LoadingSpinner from "@/components/LoadingSpinner";
import { getLessonTasksSync, type TaskCode } from "@/lib/helpers/getTasks";

export default function Lesson() {
  const { slug } = useParams<{ slug: string }>();
  const LessonContent = useMemo(
    () => lazy(() => import(`../lessons/${slug}/index.mdx`)),
    [slug],
  );

  const tasks = useMemo(() => getLessonTasksSync(slug!), [slug]);
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);

  const [taskStates, setTaskStates] = useState(
    tasks.map((t) => ({
      editableHtml: t.editableHtml,
      editableCss: t.editableCss,
      editableJs: t.editableJs,
    })),
  );

  const [editorPercent, setEditorPercent] = useState(40);
  const [topRowPercent, setTopRowPercent] = useState(60);

  const currentTask = tasks[currentTaskIndex];
  const currentTaskState = taskStates[currentTaskIndex];

  if (!currentTask) {
    return <Navigate to="/" />;
  }

  const srcDoc = `
  <!DOCTYPE html>
  <html>
    <head>
      <base target="_blank" />
      <style>
        * {margin: 0; padding: 0;}
        ${currentTask.hiddenCss || ""}
        ${currentTask.readonlyCss || ""}
        ${currentTaskState.editableCss || ""}
      </style>
    </head>
    <body>
      ${currentTask.hiddenHtml || ""}
      ${currentTask.readonlyHtml || ""}
      ${currentTaskState.editableHtml || ""}
      <script>
        ${currentTask.hiddenJs || ""}
        ${currentTask.readonlyJs || ""}
        ${currentTaskState.editableJs || ""}
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

  const updateTask = (field: keyof TaskCode, value: string) => {
    setTaskStates((prev) =>
      prev.map((s, idx) =>
        idx === currentTaskIndex ? { ...s, [field]: value } : s,
      ),
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
                readonlyHtml={currentTask.readonlyHtml}
                readonlyCss={currentTask.readonlyCss}
                readonlyJs={currentTask.readonlyJs}
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
          <MDXProvider>
            <LessonContent />
          </MDXProvider>
        </div>
      </Suspense>
    </main>
  );
}
