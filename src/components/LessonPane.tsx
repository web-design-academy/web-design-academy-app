import { MDXProvider } from "@mdx-js/react";
import { lazy, useMemo, Suspense } from "react";
import LoadingSpinner from "../components/LoadingSpinner";

interface LessonPaneProps {
  slug: string | undefined;
}

export default function LessonPane({ slug }: LessonPaneProps) {
  const LessonContent = useMemo(
    () => lazy(() => import(`../lessons/${slug}.mdx`)),
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
