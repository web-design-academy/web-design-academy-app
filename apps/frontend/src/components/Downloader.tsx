import {useQuery} from "@tanstack/react-query";
import {
  decodeSlug,
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
import LucideIcon from "@/components/Lesson/LucideIcon.tsx";
import {downloadLesson, fetchLesson} from "@/lib/api/lessons.ts";
import {fetchRepository} from "@/lib/api/github.ts";
import {parseZipAsync} from "@/lib/helpers/zipHeper.ts";
import Modal from "@/components/Modal.tsx";
import LessonIcon from "@/components/Lesson/LessonIcon.tsx";
import "@/styles/downloader.css";
import type {NewLesson} from "@/interfaces/NewLesson.ts";
import {useNotifications} from "@/components/Notifications.tsx";

interface ProcessZipResult {
  saved: number;
  conflicts: number;
}

interface DownloadContextType {
  refreshUpdates: () => Promise<void>;
  processZip: (
    lesson: Blob,
    source?: Source,
    remoteId?: string,
    sha?: string,
  ) => Promise<ProcessZipResult>;
}

const DownloadContext = createContext<DownloadContextType | null>(null);

interface Conflict {
  original: LessonMeta;
  newLesson: NewLesson;
  detectedChanges?: boolean;
}

export default function DownloaderProvider({children}: { children: ReactNode }) {
  const {pushNotification} = useNotifications();
  const [visible, setVisible] = useState(true);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);

  const {data: updates, isLoading: updatesLoading, refetch: updatesRefetch} = useQuery({
    queryKey: ["downloaderUpdates"],
    queryFn: async () => {
      const lessons = await getLessonsAsync() || [];
      const updatable: LessonMeta[] = [];

      const remotes = new Map<string, Source>();
      for (const lesson of lessons) {
        const {source, remote} = decodeSlug(lesson.slug);
        if (source && remote)
          remotes.set(remote, source);
      }

      const shas = new Map<string, string>();
      for (const [remote, source] of remotes) {
        try {
          const remoteData =
            source === "wda"
              ? await fetchLesson(remote)
              : await fetchRepository(remote);

          if (remoteData?.sha)
            shas.set(remote, remoteData.sha);
        } catch (e) {
          pushNotification({
            type: "error",
            message: `Failed to fetch updates for ${remote} (${source}): ${e}`,
            duration: 10,
          });
          console.warn(e);
        }
      }

      for (const lesson of lessons) {
        const {remote} = decodeSlug(lesson.slug);
        if (remote && shas.has(remote)) {
          const latestSha = shas.get(remote);
          if (latestSha && latestSha !== lesson.sha)
            updatable.push(lesson);
        }
      }


      return updatable;
    },
    staleTime: 60 * 60 * 1000
  });

  const saveLesson = async (newLesson: NewLesson) => {
    await saveLessonAsync(newLesson.lesson);
    await saveLessonContentAsync(newLesson.lesson.id, newLesson.content);
    await saveTasksAsync(newLesson.lesson.id, newLesson.tasks);
  }

  const processZip = async (
    blob: Blob,
    source?: Source,
    remote?: string,
    sha?: string
  ): Promise<ProcessZipResult> => {
    const existing = await getLessonsAsync();
    const existingMap = new Map(existing.map((l) => [l.slug, l]));
    const newLessons = await parseZipAsync(blob, source && remote ? {source, remote} : undefined, sha);
    const detectedConflicts: Conflict[] = [];
    let saved = 0;

    for (const newLesson of newLessons) {
      const existingLesson = existingMap.get(newLesson.lesson.slug);

      if (existingLesson) {
        detectedConflicts.push({
          original: existingLesson,
          newLesson,
          detectedChanges: existingLesson.sha !== newLesson.lesson.sha,
        });
      } else {
        await saveLesson(newLesson);
        saved++;
      }
    }

    if (detectedConflicts.length > 0) {
      setConflicts((prev) => [...prev, ...detectedConflicts]);
    }

    return {saved, conflicts: detectedConflicts.length};
  };

  const performUpdates = async () => {
    if (!updates?.length)
      return;

    const reposToUpdate = new Map<string, Source>();
    for (const lesson of updates) {
      const {source, remote} = decodeSlug(lesson.slug);

      if (source && remote)
        reposToUpdate.set(remote, source);
    }

    let incompleteUpdates = 0;
    for (const [remote, source] of reposToUpdate) {
      try {
        if (source === "wda") {
          const metadata = await fetchLesson(remote);
          const data = await downloadLesson(remote);
          const result = await processZip(data, "wda", remote, metadata.sha);
          if (result.conflicts > 0)
            incompleteUpdates++;
        } else {
          incompleteUpdates++;
          pushNotification({
            type: "error",
            message: `Updates from ${source} are not supported for ${remote} yet`,
            duration: 10,
          });
        }
      } catch (e) {
        incompleteUpdates++;
        const message = e instanceof Error ? e.message : String(e);
        pushNotification({
          type: "error",
          message: `Failed to update ${remote} from ${source}: ${message}`,
          duration: 10,
        });
        console.error(`Failed to update repo ${remote}:`, e);
      }
    }

    if (incompleteUpdates === 0)
      setVisible(false);

    await updatesRefetch();
  };

  const refreshUpdates = async () => {
    await updatesRefetch();
    if (updates && updates.length === 0)
      pushNotification({
        type: "success",
        message: "All lessons are up to date",
        duration: 3,
      });
  };

  const replaceLesson = async (conflict: Conflict) => {
    await deleteLessonAsync(conflict.original.id);
    await saveLesson(conflict.newLesson);
    setConflicts((prev) => prev.filter((c) => c.original.id !== conflict.original.id));
    await updatesRefetch();
    pushNotification({
      type: "success",
      message: `Lesson "${conflict.original.title}" replaced with "${conflict.newLesson.lesson.title}"`,
      duration: 5,
    });
  };

  const keepBothLessons = async (conflict: Conflict) => {
    conflict.newLesson.lesson.title = `${conflict.newLesson.lesson.title} (Copy)`;
    await saveLesson(conflict.newLesson);
    setConflicts((prev) => prev.filter((c) => c.original.id !== conflict.original.id));
    await updatesRefetch();
    pushNotification({
      type: "success",
      message: `Lesson "${conflict.newLesson.lesson.title}" saved as a copy`,
      duration: 5,
    });
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
        className={`updater ${(visible && !updatesLoading && updates?.length && updates.length > 0) ? "" : "hidden"}`}
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
          {updates && updates.map((l) => (
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
            Update
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
                <LessonIcon name={conflict.original.icon} size={24} color={conflict.original.color}/>

                <div className={"downloader-conflict-info"}>
                  <h4>
                    <span>{conflict.original.title}</span> {"->"} <span>{conflict.newLesson.lesson.title}</span>
                  </h4>

                  <div className={"downloader-conflict-details"}>
                    <div className={"downloader-conflict-content"}>
                      <div style={{color: conflict.detectedChanges ? "orange" : "green"}}>
                        {conflict.detectedChanges ? "Changes detected" : "No changes detected"}
                      </div>

                      <div className={"downloader-conflict-text"}>{conflict.newLesson.lesson.description}</div>
                    </div>

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
                      Keep
                    </button>
                  </div>
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
