import LucideIcon from "@/components/Lesson/LucideIcon.tsx";

interface Props {
  name: string;
  size?: number;
  color: string;
}

export default function LessonIcon({name, size = 30, color}: Props) {
  return (
    <div
      className="course-icon"
      style={{background: color}}
      aria-hidden="true"
    >
      <LucideIcon name={name} size={size}/>
    </div>
  );
}