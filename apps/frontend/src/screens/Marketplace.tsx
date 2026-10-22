import "@/styles/marketplace.css";
import { ArrowLeft, DownloadIcon, RotateCcw } from "lucide-react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import LoadingSpinner from "@/components/LoadingSpinner.tsx";
import DefaultLessonBanner from "@/components/Lesson/DefaultLessonBanner.tsx";
import { downloadLessonArchive, fetchLesson, fetchLessons } from "@/lib/api/lessons.ts";
import { useDownloader } from "@/components/Downloader.tsx";
import { useNotifications } from "@/components/Notifications.tsx";

export default function Marketplace() {
  const { processZip } = useDownloader();
  const { pushNotification } = useNotifications();
  const lastErrorRef = useRef<Error | null>(null);

  const {
    data: defaultLessons,
    isLoading: defaultLoading,
    error: defaultError,
    refetch: defaultRefetch,
  } = useQuery({
    queryKey: ["marketplaceDefaultLessons"],
    queryFn: async () => await fetchLessons(),
  });

  const downloadDefault = async (id: string) => {
    try {
      const data = await downloadLessonArchive(id);
      if (!data || data.size === 0) {
        throw new Error("Failed to download lesson archive");
      }
      const metadata = await fetchLesson(id);
      if (!metadata) {
        throw new Error("Failed to fetch lesson metadata");
      }

      const result = await processZip(data, "wda", id, metadata.sha);
      if (result.errors.length > 0 || (result.success === 0 && result.conflicts === 0)) {
        return;
      }

      pushNotification({
        type: "success",
        message: `Lesson ${metadata.title} downloaded successfully`,
        duration: 3,
      });
    } catch (e) {
      pushNotification({
        type: "error",
        message: (e as Error).message || "Failed to download lesson",
        duration: 15,
      });
      return;
    }
  };

  useEffect(() => {
    if (defaultError && defaultError !== lastErrorRef.current) {
      lastErrorRef.current = defaultError;

      pushNotification({
        type: "error",
        message: defaultError.message || "Failed to load lessons",
        duration: 5,
      });
    }
  }, [defaultError, pushNotification]);

  return (
    <main className="marketplace-page">
      <section className="marketplace-header">
        <div>
          <h1>Marketplace</h1>
        </div>

        <div className="marketplace-header-actions">
          <button
            className="btn-ghost"
            aria-label="Refresh lessons"
            title="Refresh lessons"
            onClick={() => defaultRefetch()}
          >
            <RotateCcw size="1em" className="icon-margin-right" />
            Refresh
          </button>

          <Link to={`/`} className="btn-ghost" aria-label={`Back to dashboard`}>
            <ArrowLeft size="1em" className="icon-margin-right" />
            Back to dashboard
          </Link>
        </div>
      </section>

      <section className="marketplace-panel">
        <div className="marketplace-section marketplace-section-panel">
          <h2>Made by WDA team</h2>
          {defaultLoading ? (
            <LoadingSpinner />
          ) : (
            defaultLessons &&
            defaultLessons.map((l) => (
              <DefaultLessonBanner
                key={l.slug}
                lesson={l}
                actions={
                  <button
                    className="btn-ghost"
                    title="Download lesson"
                    onClick={() => downloadDefault(l.slug)}
                  >
                    <DownloadIcon size="1em" className="icon-margin-right" />
                    Download
                  </button>
                }
              />
            ))
          )}
        </div>

        {/*<div className="marketplace-section marketplace-section-panel">*/}
        {/*  <h2>Third party lessons</h2>*/}
        {/*</div>*/}
      </section>
    </main>
  );
}
