import React, { Suspense, useMemo } from "react";
import { useParams } from "react-router";
import { MDXProvider } from "@mdx-js/react";
import LoadingSpinner from "../components/LoadingSpinner";

export default function Lesson() {
  const { slug } = useParams<{ slug: string }>();

  const LessonContent = useMemo(
    () => React.lazy(() => import(`../lessons/${slug}.mdx`)),
    [slug],
  );

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <MDXProvider>
        <LessonContent />
      </MDXProvider>
    </Suspense>
  );
}
