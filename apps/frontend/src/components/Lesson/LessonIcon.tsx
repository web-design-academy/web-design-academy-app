import type {LucideProps} from "lucide-react";
import * as LucideIcons from "lucide-react";
import {HelpCircle} from "lucide-react";

interface LessonIconProps {
  name: string;
  size?: number;
}

export default function LessonIcon({ name, size = 30 }: LessonIconProps) {
  const maybeIcon = (LucideIcons as Record<string, unknown>)[name];

  const isRenderableIcon =
    maybeIcon !== null && ["function", "object"].includes(typeof maybeIcon);

  const IconComponent = isRenderableIcon
    ? (maybeIcon as React.ComponentType<LucideProps>)
    : HelpCircle;

  return <IconComponent size={size} strokeWidth={2} />;
}
