import * as React from "react";

export interface EditorTask {
  editableHtml?: string;
  editableCss?: string;
  editableJs?: string;
}

export interface EditorPaneProps {
  task: EditorTask;
  currentIndex: number;
  totalTasks: number;
  onTaskChange: (field: "editableHtml" | "editableCss" | "editableJs", value: string) => void;
  onChangeTask: (index: number) => void;
  readonlyHtml?: string;
  readonlyCss?: string;
  readonlyJs?: string;
  onSubmit?: () => Promise<void> | void;
  completedTasks?: Set<string>;
  currentTaskId?: string;
  onAddTask?: () => void;
  onResetTask?: () => void;
  canSubmit?: boolean;
  isAdmin?: boolean;
  isDark?: boolean;
  onDiscard?: () => void;
  onDownload?: () => void;
}

export const EditorPane: React.ComponentType<EditorPaneProps>;
export const VisualEditor: React.ComponentType<any>;
declare const _default: React.ComponentType<EditorPaneProps>;
export default _default;
