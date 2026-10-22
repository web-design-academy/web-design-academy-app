import { useQuery } from "@tanstack/react-query";
import {
  buildSlug,
  decodeSlug,
  deleteLessonAsync,
  emitLessonDraftsChanged,
  getLessonsAsync,
  type LessonMeta,
  saveLessonAsync,
  saveLessonContentAsync,
  saveTasksAsync,
  type Source,
} from "@/lib/helpers/db.ts";
import "@/styles/updater.css";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { downloadLessonArchive, fetchLesson } from "@/lib/api/lessons.ts";
import { downloadRepositoryArchive, fetchRepository } from "@/lib/api/github.ts";
import { parseZipAsync } from "@/lib/helpers/zipHeper.ts";
import Modal from "@/components/Modal.tsx";
import LessonIcon from "@/components/Lesson/LessonIcon.tsx";
import "@/styles/downloader.css";
import type { NewLesson } from "@/interfaces/NewLesson.ts";
import { useNotifications } from "@/components/Notifications.tsx";
import InfoBanner from "@/components/InfoBanner.tsx";

interface ProcessZipResult {
  success: number;
  conflicts: number;
  errors: string[];
}

interface DownloadContextType {
  refreshUpdates: () => Promise<void>;
  processZip: (
    archive: Blob,
    source?: Source,
    remoteId?: string,
    sha?: string,
    shas?: Map<string, string>,
  ) => Promise<ProcessZipResult>;
}

const DownloadContext = createContext<DownloadContextType | null>(null);

interface Conflict {
  original: LessonMeta;
  newLesson: NewLesson;
  detectedChanges?: boolean;
}

export default function DownloaderProvider({ children }: { children: ReactNode }) {
  const { pushNotification } = useNotifications();
  const [newLessons, setNewLessons] = useState<NewLesson[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);

  const {
    data: updates,
    isLoading: updatesLoading,
    refetch: updatesRefetch,
  } = useQuery({
    queryKey: ["downloaderUpdates"],
    queryFn: async () => {
      const lessons = (await getLessonsAsync()) || [];
      const updatable: LessonMeta[] = [];

      const remotes = new Map<string, Source>();
      for (const lesson of lessons) {
        const { source, remote } = decodeSlug(lesson.slug);
        if (source && remote) remotes.set(remote, source);
      }

      const shas = new Map<string, string>();
      await Promise.all(
        Array.from(remotes.entries()).map(async ([remote, source]) => {
          try {
            const remoteData =
              source === "wda" ? await fetchLesson(remote) : await fetchRepository(remote);

            if (remoteData?.sha) {
              if (source === "wda") {
                shas.set(remote, remoteData.sha as string);
              } else if (source === "github") {
                for (const [lesson, sha] of remoteData.sha as Map<string, string>) {
                  shas.set(buildSlug(lesson, source, remote), sha);
                }
              }
            }
          } catch (e) {
            console.log(`Failed to fetch remote data for ${remote} from ${source}:`, e);
          }
        }),
      );

      for (const lesson of lessons) {
        const { remote, source } = decodeSlug(lesson.slug);
        if (remote) {
          let search = remote;
          if (source === "github") search = lesson.slug;

          if (shas.has(search)) {
            const latestSha = shas.get(search);
            if (latestSha && latestSha !== lesson.sha) updatable.push(lesson);
          }
        }
      }

      return updatable;
    },
    staleTime: 60 * 60 * 1000,
  });

  const processZip = useCallback(
    async (
      blob: Blob,
      source?: Source,
      remote?: string,
      sha?: string,
      shas?: Map<string, string>,
    ): Promise<ProcessZipResult> => {
      const existing = await getLessonsAsync();
      const existingMap = new Map(existing.map((l) => [l.slug, l]));
      const { lessons, errors } = await parseZipAsync(
        blob,
        source && remote ? { source, remote } : undefined,
        sha,
        shas,
      );
      const newLessons: NewLesson[] = [];
      const detectedConflicts: Conflict[] = [];

      if (errors.length > 0) {
        pushNotification({
          type: "error",
          message: `Several errors occurred while processing the archive, check the console for details`,
          duration: 15,
        });
      }

      if (lessons.length === 0) {
        pushNotification({
          type: "warning",
          message: "No valid lessons found in the archive",
          duration: 15,
        });

        return { success: 0, conflicts: 0, errors: errors };
      }

      for (const lesson of lessons) {
        const existingLesson = existingMap.get(lesson.lesson.slug);

        if (existingLesson) {
          const detectedChanges = existingLesson.sha !== lesson.lesson.sha;
          if (detectedChanges) {
            detectedConflicts.push({
              original: existingLesson,
              newLesson: lesson,
              detectedChanges: detectedChanges,
            });
          }
        } else {
          newLessons.push(lesson);
        }
      }

      if (detectedConflicts.length > 0) {
        setConflicts((prev) => [...prev, ...detectedConflicts]);
      }

      if (newLessons.length > 0) {
        setNewLessons((prev) => [...prev, ...newLessons]);
      }

      return {
        success: newLessons.length,
        conflicts: detectedConflicts.length,
        errors,
      };
    },
    [pushNotification],
  );

  const performUpdates = useCallback(
    async (updates: LessonMeta[]) => {
      if (!updates?.length)
        pushNotification({
          type: "info",
          message: "No updates available",
          duration: 3,
        });

      const reposToUpdate = new Map<string, Source>();
      for (const lesson of updates) {
        const { source, remote } = decodeSlug(lesson.slug);

        if (source && remote) reposToUpdate.set(remote, source);
      }

      await Promise.all(
        Array.from(reposToUpdate.entries()).map(async ([remote, source]) => {
          try {
            if (source === "wda") {
              const metadata = await fetchLesson(remote);
              const data = await downloadLessonArchive(remote);
              await processZip(data, "wda", remote, metadata.sha);
            } else if (source === "github") {
              const metadata = await fetchRepository(remote);
              const data = await downloadRepositoryArchive(metadata.owner_login, metadata.name);
              await processZip(data, "github", remote, undefined, metadata.sha);
            } else {
              pushNotification({
                type: "error",
                message: `Updates from ${source} are not supported for ${remote} yet`,
                duration: 10,
              });
            }
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            pushNotification({
              type: "error",
              message: `Failed to update ${remote} from ${source}: ${message}`,
              duration: 10,
            });
            console.error(`Failed to update repo ${remote}:`, e);
          }
        }),
      );
    },
    [processZip, pushNotification],
  );

  const refreshUpdates = async () => {
    pushNotification({
      type: "info",
      message: "Checking for lesson updates...",
      duration: 3,
    });
    await updatesRefetch();
  };

  const saveLesson = async (newLesson: NewLesson) => {
    await saveLessonAsync(newLesson.lesson);
    await saveTasksAsync(newLesson.lesson.id, newLesson.tasks);
    if (newLesson.content) {
      await saveLessonContentAsync(newLesson.lesson.id, newLesson.content);
    }

    pushNotification({
      type: "success",
      message: `Lesson "${newLesson.lesson.title}" saved successfully`,
      duration: 3,
    });

    emitLessonDraftsChanged();
  };

  const replaceLesson = async (conflict: Conflict) => {
    await deleteLessonAsync(conflict.original.id);
    await saveLesson(conflict.newLesson);
  };

  const keepBothLessons = async (conflict: Conflict) => {
    const existingTitles = new Set((await getLessonsAsync()).map((l) => l.title));
    let counter = 0;
    let newTitle = conflict.newLesson.lesson.title;

    while (existingTitles.has(newTitle)) {
      counter++;
      newTitle = `${conflict.newLesson.lesson.title} (Copy${counter > 1 ? ` ${counter}` : ""})`;
    }

    conflict.newLesson.lesson.title = newTitle;

    await saveLesson(conflict.newLesson);
  };

  const notifiedUpdatesRef = useRef<LessonMeta[] | null>(null);

  useEffect(() => {
    if (updatesLoading || !updates) return;
    if (notifiedUpdatesRef.current === updates) return;
    notifiedUpdatesRef.current = updates;

    if (updates.length > 0) {
      pushNotification({
        type: "info",
        message: `${updates.length} lesson(s) have updates available`,
        duration: undefined,
        actions: [
          {
            label: "View Updates",
            onClick: async () => {
              await performUpdates(updates);
            },
          },
        ],
      });
    }
  }, [updates, updatesLoading, pushNotification, performUpdates]);

  return (
    <DownloadContext.Provider
      value={{
        refreshUpdates,
        processZip,
      }}
    >
      {children}

      <Modal
        title={"Download manager"}
        isOpen={conflicts.length > 0 || newLessons.length > 0}
        onClose={() => {
          setNewLessons([]);
          setConflicts([]);
        }}
        children={
          <div className={"downloader-conflicts"}>
            <InfoBanner
              type={"info"}
              message={"Note that replacing lesson removes your progress on that lesson."}
            />

            {conflicts.length > 0 && <h3>Existing lessons</h3>}

            {conflicts.map((conflict) => (
              <div key={conflict.original.id} className={"downloader-conflict-item"}>
                <LessonIcon
                  name={conflict.original.icon}
                  size={24}
                  color={conflict.original.color}
                />

                <div className={"downloader-conflict-info"}>
                  <h4>
                    <span>{conflict.original.title}</span> {"->"}{" "}
                    <span>{conflict.newLesson.lesson.title}</span>
                  </h4>

                  <div className={"downloader-conflict-details"}>
                    <div className={"downloader-conflict-content"}>
                      <div
                        style={{
                          color: conflict.detectedChanges ? "orange" : "green",
                        }}
                      >
                        {conflict.detectedChanges ? "Changes detected" : "No changes detected"}
                      </div>

                      <div className={"downloader-conflict-text"}>
                        {conflict.newLesson.lesson.description}
                      </div>
                    </div>

                    <button
                      className={"btn-ghost"}
                      onClick={async () => {
                        setConflicts((prev) =>
                          prev.filter((c) => c.original.id !== conflict.original.id),
                        );
                        await replaceLesson(conflict);
                      }}
                    >
                      Replace
                    </button>

                    <button
                      className={"btn-ghost"}
                      onClick={async () => {
                        setConflicts((prev) =>
                          prev.filter((c) => c.original.id !== conflict.original.id),
                        );
                        await keepBothLessons(conflict);
                      }}
                    >
                      Keep
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {newLessons.length > 0 && <h3>New lessons</h3>}

            {newLessons.map((lesson) => (
              <div key={lesson.lesson.id} className={"downloader-conflict-item"}>
                <LessonIcon name={lesson.lesson.icon} size={24} color={lesson.lesson.color} />

                <div className={"downloader-conflict-info"}>
                  <h4>{lesson.lesson.title}</h4>

                  <div className={"downloader-conflict-details"}>
                    <div className={"downloader-conflict-content"}>
                      <div className={"downloader-conflict-text"}>{lesson.lesson.description}</div>
                    </div>

                    <button
                      className={"btn-ghost"}
                      onClick={async () => {
                        setNewLessons((prev) =>
                          prev.filter((l) => l.lesson.id !== lesson.lesson.id),
                        );
                        await saveLesson(lesson);
                      }}
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        }
      />
    </DownloadContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDownloader() {
  const context = useContext(DownloadContext);
  if (!context) throw new Error("useDownloader must be used within a DownloaderProvider");

  return context;
}
