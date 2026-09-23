import Modal from "@/components/Modal.tsx";
import {useQuery} from "@tanstack/react-query";
import {getLessonsAsync, type LessonMeta} from "@/lib/helpers/db.ts";
import {API_BASE} from "@/lib/api/client.ts";

export default function Updater() {
  const {data: lessons, isLoading: lessonLoading, error: lessonsError} = useQuery({
    queryKey: ["lessons"],
    queryFn: async () => {
      const lessons = await getLessonsAsync() || [];
      const updatable: LessonMeta[] = [];
      for (const lesson of lessons) {
        if (lesson.source === "wda") {
          const response = await fetch(`${API_BASE}/lessons/${lesson.remoteId}`, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            }
          });
          const remoteLesson = await response.json();
          console.log(remoteLesson.sha, lesson.sha)
          if (remoteLesson.sha !== lesson.sha)
            updatable.push(remoteLesson);
        } else if (lesson.source === "github") {
          const response = await fetch(`${API_BASE}/github/repositories/${lesson.remoteId}`, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            credentials: "include"
          });

          const remoteLesson = await response.json();
          if (remoteLesson.sha === lesson.sha)
            updatable.push(remoteLesson);
        }
      }

      return updatable;
    },
    staleTime: 60 * 60 * 1000
  });

  return (
    <Modal
      title="Available lesson updates"
      isOpen={!lessonLoading}
      onClose={() => {
      }}
      children={lessons && lessons.map((l) => (
        <div>{l.title}</div>
      ))}
    />
  );
}