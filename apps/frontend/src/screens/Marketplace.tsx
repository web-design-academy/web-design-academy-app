import "@/styles/marketplace.css"
import {ArrowLeft, DownloadIcon, RotateCcw, XIcon} from "lucide-react";
import {Link} from "react-router";
import {useQuery} from "@tanstack/react-query";
import InfoBanner from "@/components/InfoBanner.tsx";
import {useEffect, useState} from "react";
import LoadingSpinner from "@/components/LoadingSpinner.tsx";
import DefaultLessonBanner from "@/components/Lesson/DefaultLessonBanner.tsx";
import {parseLessonsZipAsync} from "@/lib/helpers/zipHeper.ts";
import {downloadLesson, getLesson, getLessons} from "@/lib/api/lessons.ts";

export default function Marketplace() {
  const [error, setError] = useState<Error | null>(null);

  const {data: defaultLessons, isLoading: defaultLoading, error: defaultError, refetch: defaultRefetch} = useQuery({
    queryKey: ["default"],
    queryFn: async () => await getLessons()
  });

  const downloadDefault = async (id: string) => {
    const data = await downloadLesson(id);
    const metadata = await getLesson(id);

    await parseLessonsZipAsync(data, "wda", id, metadata.sha);
  };

  useEffect(() => {
    if (defaultError)
      setError(defaultError);
  }, [defaultError]);

  return (
    <>
      {error && (
        <div className="profile-error">
          <InfoBanner
            type="error"
            icon={(<XIcon/>)}
            message={error.message}
            actions={(
              <button
                onClick={() => setError(null)}
                className="btn-ghost"
              >
                Close
              </button>
            )}
          />
        </div>
      )}

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
              <RotateCcw size="1em" className="icon-margin-right"/>
              Refresh
            </button>

            <Link
              to={`/`}
              className="btn-ghost"
              aria-label={`Back to dashboard`}
            >
              <ArrowLeft size="1em" className="icon-margin-right"/>
              Back to dashboard
            </Link>
          </div>
        </section>

        <section className="marketplace-panel">
          <div className="marketplace-section marketplace-section-panel">
            <h2>Made by WDA team</h2>
            {defaultLoading ? <LoadingSpinner/> : defaultLessons && defaultLessons.map((l) => (
              <DefaultLessonBanner
                lesson={l}
                actions={(
                  <button
                    className="btn-ghost"
                    title="Download lesson"
                    onClick={() => downloadDefault(l.remoteId)}
                  >
                    <DownloadIcon size="1em" className="icon-margin-right"/>
                    Download
                  </button>
                )}
              />
            ))}
          </div>

          {/*<div className="marketplace-section marketplace-section-panel">*/}
          {/*  <h2>Third party lessons</h2>*/}
          {/*</div>*/}
        </section>
      </main>
    </>
  );
}