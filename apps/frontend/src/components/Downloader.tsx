import {useQuery} from "@tanstack/react-query";
import {
  deleteLessonAsync,
  getLessonsAsync,
  type LessonMeta,
  saveLessonAsync,
  saveLessonContentAsync,
  saveTasksAsync,
  type Source
} from "@/lib/helpers/db.ts";
import "@/styles/updater.css"
import {DownloadCloud} from "lucide-react";
import {createContext, type ReactNode, useContext, useState} from "react";
import InfoBanner from "@/components/InfoBanner.tsx";
import LucideIcon from "@/components/Lesson/LucideIcon.tsx";
import {downloadLesson, fetchLesson} from "@/lib/api/lessons.ts";
import {fetchRepository} from "@/lib/api/github.ts";
import {parseAndSaveZipAsync, parseZipAsync} from "@/lib/helpers/zipHeper.ts";
import Modal from "@/components/Modal.tsx";
import LessonIcon from "@/components/Lesson/LessonIcon.tsx";
import "@/styles/downloader.css";
import type {NewLesson} from "@/interfaces/NewLesson.ts";

interface DownloadContextType {
  refreshUpdates: () => Promise<void>;
  processZip: (
    lesson: Blob,
    source: Source,
    remoteId: string | undefined,
    sha: string | undefined
  ) => Promise<void>;
}

const DownloadContext = createContext<DownloadContextType | null>(null);

interface Conflict {
  original: LessonMeta;
  newLesson: NewLesson;
  detectedChanges?: boolean;
}

export default function DownloaderProvider({children}: { children: ReactNode }) {
  const [visible, setVisible] = useState(true);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);

  const {data: updates, isLoading: updatesLoading, refetch: updatesRefetch} = useQuery({
    queryKey: ["downloaderUpdates"],
    queryFn: async () => {
      const lessons = await getLessonsAsync() || [];
      const updatable: LessonMeta[] = [];
      const errors: string[] = [];

      for (const lesson of lessons.filter((l) => (l.source !== "local" && l.remoteId))) {
        try {
          const remoteLesson = lesson.source === "wda"
            ? await fetchLesson(lesson.remoteId ?? "")
            : await fetchRepository(lesson.remoteId ?? "")
          ;

          if (remoteLesson && (remoteLesson.sha !== lesson.sha))
            updatable.push(lesson);
        } catch (e) {
          errors.push(`Failed to fetch updates for ${lesson.title} (${lesson.source}): ${e}`);
          console.warn(e);
        }
      }

      return {updatable, errors};
    },
    staleTime: 60 * 60 * 1000
  });

  const updateLesson = async (lesson: LessonMeta) => {
    if (lesson.source === "wda" && lesson.remoteId) {
      const metadata = await fetchLesson(lesson.remoteId);
      const data = await downloadLesson(lesson.remoteId);

      await parseAndSaveZipAsync(data, "wda", lesson.remoteId, metadata.sha);
    } else if (lesson.source === "github" && lesson.remoteId) {
      // TODO: Implement GitHub lesson update logic
    }
  };

  const performUpdates = async () => {
    if (updates) {
      for (const lesson of updates.updatable) {
        await deleteLessonAsync(lesson.id);
        await updateLesson(lesson);
      }
    }
    setVisible(false);
  };

  const refreshUpdates = async () => {
    await updatesRefetch();
  };

  const saveLesson = async (newLesson: NewLesson) => {
    await saveLessonAsync(newLesson.lesson);
    await saveLessonContentAsync(newLesson.lesson.id, newLesson.content);
    await saveTasksAsync(newLesson.lesson.id, newLesson.tasks);
  }

  const processZip = async (
    blob: Blob,
    source: Source = "local",
    remoteId: string | undefined = undefined,
    sha: string | undefined = undefined
  ) => {
    const existing = await getLessonsAsync();
    const newLessons = await parseZipAsync(blob, source, remoteId, sha);

    for (const newLesson of newLessons) {
      const existingLesson =
        existing.find((e) =>
          e.remoteId === newLesson.lesson.remoteId && e.source === newLesson.lesson.source);

      if (existingLesson) {
        setConflicts((prev) => [...prev, {
          original: existingLesson,
          newLesson: newLesson,
          detectedChanges: existingLesson.sha !== newLesson.lesson.sha
        }]);
      } else {
        await saveLesson(newLesson);
      }
    }
  }

  const replaceLesson = async (conflict: Conflict) => {
    await deleteLessonAsync(conflict.original.id);
    await saveLesson(conflict.newLesson);
    setConflicts((prev) => prev.filter((c) => c.original.id !== conflict.original.id));
  };

  const keepBothLessons = async (conflict: Conflict) => {
    conflict.newLesson.lesson.title = `${conflict.newLesson.lesson.title} (Copy)`;
    await saveLesson(conflict.newLesson);
    setConflicts((prev) => prev.filter((c) => c.original.id !== conflict.original.id));
  };

  return (
    <DownloadContext.Provider
      value={{
        refreshUpdates,
        processZip
      }}
    >
      {children}

      <div
        className={`updater ${(visible && !updatesLoading && updates?.updatable && updates.updatable.length > 0) ? "" : "hidden"}`}
      >
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
          <InfoBanner type="warning" message="Updating will rewrite said existing lessons"/>
        </div>

        <div className="updater-body">
          {updates?.updatable && updates.updatable.map((l) => (
            <div key={l.id} className="updater-lesson">
              <div
                className="course-icon"
                style={{background: l.color}}
                aria-hidden="true"
              >
                <LucideIcon name={l.icon} size={20}/>
              </div>

              <h4>{l.title}</h4>
            </div>
          ))}
        </div>

        <div className="updater-body">
          <button
            className="updater-button btn-primary"
            onClick={() => performUpdates()}
          >
            <DownloadCloud size="1em" className="icon-margin-right"/>
            Update all
          </button>
        </div>
      </div>

      <Modal
        title={"Download conflicts"}
        isOpen={conflicts.length > 0}
        onClose={() => setConflicts([])}
        children={(
          <div className={"downloader-conflicts"}>
            {conflicts.map((conflict) => (
              <div key={conflict.original.id} className={"downloader-conflict-item"}>
                <div className={"downloader-conflict-info"}>
                  <LessonIcon name={conflict.original.icon} size={24} color={conflict.original.color}/>

                  <div className={"downloader-conflict-details"}>
                    <h4>
                      <span>{conflict.original.title}</span>
                      <small
                        style={{color: conflict.detectedChanges ? "orange" : "green"}}> - {conflict.detectedChanges ? "Changes detected" : "No changes"}
                      </small>
                    </h4>

                    <div className={"downloader-conflict-content"}>{conflict.original.description}</div>
                    <div className={"downloader-conflict-content"}>{conflict.newLesson.content}</div>
                  </div>
                </div>

                <div className={"downloader-conflict-actions"}>
                  <button
                    className={"btn-ghost"}
                    onClick={() => replaceLesson(conflict)}
                  >
                    Replace
                  </button>

                  <button
                    className={"btn-ghost"}
                    onClick={() => keepBothLessons(conflict)}
                  >
                    Keep Both
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      />
    </DownloadContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDownloader() {
  const context = useContext(DownloadContext);
  if (!context)
    throw new Error("useDownloader must be used within a DownloaderProvider");

  return context;
}
