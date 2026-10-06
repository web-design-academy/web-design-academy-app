import {useEffect, useRef, useState} from "react";
import {Link} from "react-router";
import "@/styles/dashboard.css";
import LoadingSpinner from "@/components/LoadingSpinner";
import Pagination from "@/components/Pagination";
import {useAuth} from "@/lib/ctx/useAuth";
import {ArrowRight, Pencil, RotateCcw, ShoppingBag,} from "lucide-react";
import {getPlayableLessonsAsync, getProgressAsync, type LessonMeta} from "@/lib/helpers/db.ts";
import LessonIcon from "@/components/Lesson/LessonIcon.tsx";
import {useDownloader} from "@/components/Downloader.tsx";
import {useNotifications} from "@/components/Notifications.tsx";
import {useQuery} from "@tanstack/react-query";

type LessonWithProgress = LessonMeta & {
  progress: number;
  taskCount: number;
};

export default function Dashboard() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const { user, isAuthenticated } = useAuth();
  const {refreshUpdates} = useDownloader();
  const {pushNotification} = useNotifications();
  const lastErrorRef = useRef<Error | null>(null);

  const {
    data: lessonsData,
    isLoading: lessonsLoading,
    error: lessonsError
  } = useQuery<LessonWithProgress[]>({
    queryKey: ["dashboardLessons"],
    queryFn: async (): Promise<LessonWithProgress[]> => {
      const lessons = await getPlayableLessonsAsync();
      return await Promise.all(
        lessons.map(async (lesson) => ({
            ...lesson,
          progress: user ? (await getProgressAsync(lesson.id, user.userId))?.completedTasks.length ?? 0 : 0,
            taskCount: lesson.taskCount ?? 0,
          })
        )
      );
    },
    staleTime: Infinity,
    gcTime: 0
  });

  useEffect(() => {
    if (lessonsError && lessonsError !== lastErrorRef.current) {
      lastErrorRef.current = lessonsError;

      pushNotification({
        type: "error",
        message: lessonsError.message || "Failed to load lessons",
        duration: 5,
      });
    }
  }, [lessonsError, pushNotification]);

  if (lessonsLoading) return <LoadingSpinner/>;

  const pageLessons = lessonsData ? lessonsData.slice((page - 1) * pageSize, page * pageSize) : [];

  return (
    <main className="dashboard-page">
      <section className="dashboard-shell">
        <div className="dashboard-title">
          <h1>Course dashboard</h1>

          <div className="dashboard-title-actions">
            <button
              className="btn-ghost"
              aria-label={`Check for lesson updates`}
              title="Check for lesson updates"
              onClick={() => refreshUpdates()}
            >
              <RotateCcw size="1em"/>
            </button>

            <button
              className="btn-ghost"
              aria-label={`Check for lesson updates`}
              title="Check for lesson updates"
              onClick={() => pushNotification({
                type: "info",
                message: "Checking for lesson updates...",
                duration: 3
              })}
            >
              TN
            </button>

            <Link
              to={`/marketplace`}
              className="btn-ghost"
              aria-label={`Marketplace`}
              title="Find and download new lessons"
            >
              <ShoppingBag size="1em" className="icon-margin-right"/>
              Marketplace
            </Link>

            {isAuthenticated && (
              <Link
                to={`/edit`}
                className="btn-ghost"
                aria-label={`Edit Mode`}
                title="Create, edit and manage lessons"
              >
                <Pencil size="1em" className="icon-margin-right"/>
                Edit Mode
              </Link>
            )}
          </div>
        </div>

        {lessonsLoading ? (
          <LoadingSpinner/>
        ) : lessonsError || !lessonsData ? (
          <p className="admin-error">Error loading lessons</p>
        ) : lessonsData?.length === 0 ? (
          <h3 className="dashboard-info">No lessons available</h3>
        ) : (
          <>
            <ul className="course-list">
              {pageLessons.map(
                (lesson: LessonWithProgress) => (
                  <li key={lesson.id} className="course-row">
                    <LessonIcon name={lesson.icon} size={20} color={lesson.color}/>

                    <div className="course-info">
                      <h2 className="course-name">
                        {lesson.title}
                      </h2>
                      <p className="course-description">{lesson.description}</p>
                    </div>

                    <div className="course-right">
                      <span className="course-task-count">
                        {lesson.taskCount} {lesson.taskCount === 1 ? "task" : "tasks"}
                      </span>

                      {isAuthenticated && (
                        <div className="course-progress">
                          <div className="course-progress-bar-bg">
                            <div
                              className="course-progress-bar-fill"
                              style={{
                                width: `${lesson.progress}%`,
                                background: lesson.color,
                              }}
                            />
                          </div>
                          <span className="course-progress-label">{lesson.progress}%</span>
                        </div>
                      )}

                      <Link
                        to={{
                          pathname: `/lessons/${lesson.id}`,
                          search: "?mode=play",
                        }}
                        className="btn-primary"
                        aria-label={`Open lesson "${lesson.title}"`}
                      >
                        {isAuthenticated && lesson.progress > 0
                          ? lesson.progress === 100
                            ? "Review"
                            : "Continue"
                          : "Start"}
                        <ArrowRight size="1em"/>
                      </Link>
                    </div>
                  </li>
                ),
              )}
            </ul>
            <Pagination
              page={page}
              total={lessonsData?.length || 0}
              pageSize={pageSize}
              onChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </>
        )}
      </section>
    </main>
  );
}
