import * as LucideIcons from "lucide-react";
import { HelpCircle } from "lucide-react";
import type { LucideProps } from "lucide-react";

interface LessonIconProps {
  name: string;
  size?: number;
}

export default function LessonIcon({ name }: LessonIconProps) {
  const maybeIcon = (LucideIcons as Record<string, unknown>)[name];

  const isRenderableIcon = maybeIcon !== null && typeof maybeIcon === "object";

  const IconComponent = isRenderableIcon
    ? (maybeIcon as React.ComponentType<LucideProps>)
    : HelpCircle;

  return <IconComponent size={30} strokeWidth={2} />;
}
