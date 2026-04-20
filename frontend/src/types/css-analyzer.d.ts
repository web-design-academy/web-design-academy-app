declare module "css-analyzer" {
  import type { ComponentType, ReactNode } from "react";

  export const ChallengeProvider: ComponentType<{
    task: unknown;
    locale?: string;
    onComplete?: (result: { finalScore: number; code: string }) => void;
    children?: ReactNode;
  }>;

  export const ChallengeLayout: ComponentType<{
    initialWidths?: number[];
    children?: ReactNode;
  }>;

  export const TaskPanel: ComponentType<{
    showChecks?: boolean;
    customPadding?: string;
    bgColor?: string;
  }>;

  export const OutputPanel: ComponentType<{
    allowInspect?: boolean;
    showControls?: boolean;
    defaultMode?: string;
  }>;

  export const EditorPanel: ComponentType<{
    theme?: string;
    showMinimap?: boolean;
    readOnly?: boolean;
  }>;

  export const TeacherTaskCreator: ComponentType<{
    initialTask?: unknown;
    onSave?: (config: unknown) => void;
    locale?: string;
    className?: string;
    style?: Record<string, unknown>;
  }>;
}

declare module "css-analyzer/style.css";
