import { useState } from "react";
import { useParams } from "react-router";
import { Resizable, type ResizeCallback } from "re-resizable";

import "../styles/lesson.css";
import EditorPane from "../components/EditorPane";
import PreviewPane from "../components/PreviewPane";
import LessonPane from "../components/LessonPane";

export default function Lesson() {
  const { slug } = useParams<{ slug: string }>();

  const [html, setHtml] = useState("<h1>Hello world!</h1>");

  const [editorPercent, setEditorPercent] = useState(40);
  const [topRowPercent, setTopRowPercent] = useState(60);

  const handleEditorResize: ResizeCallback = (_e, _dir, ref) => {
    const parentWidth = ref.parentElement!.offsetWidth;
    setEditorPercent((ref.offsetWidth / parentWidth) * 100);
  };

  const handleTopRowResize: ResizeCallback = (_e, _dir, ref) => {
    const containerHeight = ref.parentElement!.offsetHeight;
    setTopRowPercent((ref.offsetHeight / containerHeight) * 100);
  };

  return (
    <main className="lesson-container">
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
            <EditorPane value={html} onChange={setHtml} />
          </Resizable>

          <div
            className="lesson-preview"
            style={{ width: `${100 - editorPercent}%` }}
          >
            <PreviewPane html={html} />
          </div>
        </div>
      </Resizable>

      <div
        className="lesson-content"
        style={{ height: `${100 - topRowPercent}%` }}
      >
        <LessonPane slug={slug} />
      </div>
    </main>
  );
}
