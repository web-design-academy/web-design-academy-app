import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import { evaluate } from "@mdx-js/mdx";
import { MDXProvider, useMDXComponents } from "@mdx-js/react";
import * as runtime from "react/jsx-runtime";
import C from "./C";
import LoadingSpinner from "./LoadingSpinner";

const compiledContent = new Map<string, ComponentType>();

export default function RuntimeMdx({ source }: { source: string }) {
  const [Content, setContent] = useState<ComponentType | null>(
    () => compiledContent.get(source) ?? null,
  );
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cached = compiledContent.get(source);

    if (cached) {
      setContent(() => cached);
      setError(null);
      return;
    }

    setContent(null);
    setError(null);

    evaluate(source, {
      ...runtime,
      useMDXComponents,
      baseUrl: window.location.href,
    })
      .then((module) => {
        if (cancelled) return;

        const NextContent = module.default as ComponentType;
        compiledContent.set(source, NextContent);
        setContent(() => NextContent);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(
          reason instanceof Error
            ? reason
            : new Error("Lesson content could not be rendered"),
        );
      });

    return () => {
      cancelled = true;
    };
  }, [source]);

  if (error) {
    return <p className="admin-error">{error.message}</p>;
  }

  if (!Content) return <LoadingSpinner />;

  return (
    <MDXProvider components={{ C }}>
      <Content />
    </MDXProvider>
  );
}
