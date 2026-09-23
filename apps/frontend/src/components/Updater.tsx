import {useQuery} from "@tanstack/react-query";
import {deleteLessonAsync, getLessonsAsync, type LessonMeta} from "@/lib/helpers/db.ts";
import "@/styles/updater.css"
import {DownloadCloud, InfoIcon} from "lucide-react";
import {useEffect, useState} from "react";
import InfoBanner from "@/components/InfoBanner.tsx";
import LessonIcon from "@/components/Lesson/LessonIcon.tsx";
import {downloadLesson, getLesson} from "@/lib/api/lessons.ts";
import {getGitHubRepository} from "@/lib/api/github.ts";
import type {Repository} from "@/components/Dashboard/RepositoryBanner.tsx";
import {parseLessonsZipAsync} from "@/lib/helpers/zipHeper.ts";

interface Props {
  refresh: number | undefined;
}

export default function Updater({refresh = 0}: Props) {
  const [visible, setVisible] = useState(true);

  const {data: updates, isLoading: updatesLoading, refetch: updatesRefetch} = useQuery({
    queryKey: ["lessons"],
    queryFn: async () => {
      const lessons = await getLessonsAsync() || [];
      const updatable: LessonMeta[] = [];
      for (const lesson of lessons.filter((l) => (l.source !== "local" && l.remoteId))) {

        try {
          const remoteLesson = lesson.source === "wda"
            ? await getLesson(lesson.remoteId ?? "") as LessonMeta
            : await getGitHubRepository(lesson.remoteId ?? "") as Repository
          ;

          if (remoteLesson && (remoteLesson.sha !== lesson.sha))
            updatable.push(lesson);
        } catch (e) {
          console.warn(e);
        }
      }

      return updatable;
    },
    staleTime: 60 * 60 * 1000
  });

  const performUpdate = async () => {
    if (updates) {
      for (const lesson of updates) {
        await deleteLessonAsync(lesson.id);

        if (lesson.source === "wda" && lesson.remoteId) {
          const data = await downloadLesson(lesson.remoteId);
          const metadata = await getLesson(lesson.remoteId);

          await parseLessonsZipAsync(data, "wda", lesson.remoteId, metadata.sha);
        }
      }
    }
    setVisible(false);
  }

  useEffect(() => {
    updatesRefetch();
    setVisible(true);

  }, [updatesRefetch, refresh]);

  return (
    <div className={`updater ${(visible && !updatesLoading && updates && updates.length > 0) ? "" : "hidden"}`}>
      <div className="updater-title">
        <h3>Lesson updates available</h3>
        <button
          className="btn-ghost modal-close"
          onClick={() => setVisible(false)}
        >
          &times;
        </button>
      </div>

      <div className="updater-body">
        <InfoBanner type="warning" icon={(<InfoIcon/>)} message="Updating will rewrite said existing lessons"/>
      </div>

      <div className="updater-body">
        {updates && updates.map((l) => (
          <div key={l.id} className="updater-lesson">
            <div
              className="course-icon"
              style={{background: l.color}}
              aria-hidden="true"
            >
              <LessonIcon name={l.icon} size={20}/>
            </div>

            <h4>{l.title}</h4>
          </div>
        ))}
      </div>

      <div className="updater-body">
        <button
          className="updater-button btn-primary"
          onClick={() => performUpdate()}
        >
          <DownloadCloud size="1em" className="icon-margin-right"/>
          Update all
        </button>
      </div>
    </div>
  );
}