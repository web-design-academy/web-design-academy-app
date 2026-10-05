import React from "react";
import type {DefaultLesson} from "@/interfaces/DefaultLesson.ts";

interface Props {
  lesson: DefaultLesson;
  actions: React.ReactNode;
}

export default function DefaultLessonBanner({lesson, actions}: Props) {
  return (
    <div key={lesson.title} className="profile-repository">
      <div className="profile-repository-info">
        <h3>{lesson.title}</h3>
        <div>{lesson.description}</div>
      </div>

      <div className="profile-repository-actions">
        {actions}
      </div>
    </div>
  );
}