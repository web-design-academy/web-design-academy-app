import { useMemo, useState, type ReactNode } from "react";

import { UiPreferencesContext } from "./useUiPreferences";

export function UiPreferencesProvider({ children }: { children: ReactNode }) {
  const [visualEditorEnabled, setVisualEditorEnabled] = useState(false);
  const [visualPreviewEnabled, setVisualPreviewEnabled] = useState(false);
  const [visualEditorAvailable, setVisualEditorAvailable] = useState(false);

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
