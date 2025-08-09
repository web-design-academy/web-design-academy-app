import React, { Suspense, useMemo, useState } from "react";
import { useParams } from "react-router";
import { MDXProvider } from "@mdx-js/react";
import LoadingSpinner from "../components/LoadingSpinner";

import "../styles/lesson.css";
import EditorPane from "../components/EditorPane";

export default function Lesson() {
  const { slug } = useParams<{ slug: string }>();

  const LessonContent = useMemo(
    () => React.lazy(() => import(`../lessons/${slug}.mdx`)),
    [slug],
  );

  const [html, setHtml] = useState("<h1>Hello world!</h1>");

  return (
    <main className="lesson-container">
      <Suspense fallback={<LoadingSpinner />}>
        <section className="lesson-editor">
          <EditorPane value={html} onChange={setHtml} />
        </section>

        <div className="lesson-right">
          <section className="lesson-preview">
            <iframe
              title="HTML Preview"
              sandbox="allow-scripts allow-same-origin"
              srcDoc={html}
              style={{
                width: "100%",
                height: "100%",
                border: "none",
                backgroundColor: "white",
              }}
            />
          </section>

          <section className="lesson-content">
            <MDXProvider>
              <LessonContent />
            </MDXProvider>
          </section>
        </div>
      </Suspense>
    </main>
  );
}
