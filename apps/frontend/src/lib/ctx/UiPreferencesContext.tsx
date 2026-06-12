import { useEffect, useMemo, useState, type ReactNode } from "react";

import { UiPreferencesContext } from "./useUiPreferences";

const VISUAL_EDITOR_KEY = "ui-visual-editor-enabled";
const VISUAL_PREVIEW_KEY = "ui-visual-preview-enabled";

function getStoredBoolean(key: string) {
  return localStorage.getItem(key) === "true";
}

export function UiPreferencesProvider({ children }: { children: ReactNode }) {
  const [visualEditorEnabled, setVisualEditorEnabled] = useState(() =>
    getStoredBoolean(VISUAL_EDITOR_KEY),
  );
  const [visualPreviewEnabled, setVisualPreviewEnabled] = useState(() =>
    getStoredBoolean(VISUAL_PREVIEW_KEY),
  );
  const [visualEditorAvailable, setVisualEditorAvailable] = useState(false);

  useEffect(() => {
    localStorage.setItem(VISUAL_EDITOR_KEY, String(visualEditorEnabled));
  }, [visualEditorEnabled]);

  useEffect(() => {
    localStorage.setItem(VISUAL_PREVIEW_KEY, String(visualPreviewEnabled));
  }, [visualPreviewEnabled]);

  const value = useMemo(
    () => ({
      visualEditorEnabled,
      visualPreviewEnabled,
      visualEditorAvailable,
      setVisualEditorEnabled,
      setVisualPreviewEnabled,
      setVisualEditorAvailable,
    }),
    [visualEditorAvailable, visualEditorEnabled, visualPreviewEnabled],
  );

  return (
    <UiPreferencesContext.Provider value={value}>
      {children}
    </UiPreferencesContext.Provider>
  );
}
