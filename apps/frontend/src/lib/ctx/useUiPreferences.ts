import { createContext, useContext } from "react";

interface UiPreferencesContextValue {
  visualEditorEnabled: boolean;
  visualPreviewEnabled: boolean;
  visualEditorAvailable: boolean;
  setVisualEditorEnabled: (enabled: boolean) => void;
  setVisualPreviewEnabled: (enabled: boolean) => void;
  setVisualEditorAvailable: (available: boolean) => void;
}

export const UiPreferencesContext =
  createContext<UiPreferencesContextValue | null>(null);

export function useUiPreferences() {
  const ctx = useContext(UiPreferencesContext);

  if (!ctx) {
    throw new Error(
      "useUiPreferences must be used within UiPreferencesProvider",
    );
  }

  return ctx;
}
