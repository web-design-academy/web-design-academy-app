import type {LucideProps} from "lucide-react";
import * as LucideIcons from "lucide-react";
import {HelpCircle} from "lucide-react";
import {type ComponentType} from "react";

interface Props {
  name: string;
  size?: number;
}

export default function LucideIcon({name, size = 30}: Props) {
  const maybeIcon = (LucideIcons as Record<string, unknown>)[name];

  const isRenderableIcon =
    maybeIcon !== null && ["function", "object"].includes(typeof maybeIcon);

  const IconComponent = isRenderableIcon
    ? (maybeIcon as ComponentType<LucideProps>)
    : HelpCircle;

  return <IconComponent size={size} strokeWidth={2}/>;
}
