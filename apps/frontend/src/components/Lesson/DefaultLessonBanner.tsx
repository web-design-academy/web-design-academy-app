import React from "react";

export interface DefaultLesson {
  id: string;
  title: string;
  description: string;
  color: string;
  icon: string;
  visualEditor: boolean;
  visualPreview: boolean;
  sha: string;
}

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