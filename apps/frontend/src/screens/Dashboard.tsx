import {useEffect, useState} from "react";
import {Link} from "react-router";
import "@/styles/dashboard.css";
import LoadingSpinner from "@/components/LoadingSpinner";
import Pagination from "@/components/Pagination";
import LessonIcon from "@/components/Lesson/LessonIcon.tsx";
import {useAuth} from "@/lib/ctx/useAuth";
import {ArrowRight, Pencil, RotateCcw, ShoppingBag,} from "lucide-react";
import {getPlayableLessonsAsync, getProgressAsync, type LessonMeta} from "@/lib/helpers/db.ts";
import Updater from "@/components/Updater.tsx";

const PAGE_SIZE = 8;

type LessonWithProgress = LessonMeta & {
  progress: number;
  taskCount: number;
};

export default function Dashboard() {
  const [lessons, setLessons] = useState<LessonWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const { user, isAuthenticated } = useAuth();
  const [updateCheckToken, setUpdateCheckToken] = useState(0);

  useEffect(() => {
    setLoading(true);
    setLoadError(null);

    const fetchProgress = async () : Promise<LessonWithProgress[]> => {
      const lessons = await getPlayableLessonsAsync();
      return await Promise.all(
        lessons.map(async (lesson) => ({
            ...lesson,
          progress: user ? (await getProgressAsync(lesson.id, user.userId))?.completedTasks.length ?? 0 : 0,
            taskCount: lesson.taskCount ?? 0,
          })
        )
      );
    };

    fetchProgress().then((l) => {
      setLessons(l);
      setLoading(false);
    });
  }, [isAuthenticated, user]);

  if (loading) return <LoadingSpinner />;

  if (loadError) {
    return (
      <main className="dashboard-page">
        <div className="dashboard-shell">
          <p className="admin-error">{loadError}</p>
        </div>
      </main>
    );
  }

  const pageLessons = lessons.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
              onClick={() => setUpdateCheckToken(updateCheckToken + 1)}
            >
              <RotateCcw size="1em"/>
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

        {loading ? <LoadingSpinner/> : lessons.length === 0 ? (
          <h3 className="dashboard-info">No lessons available</h3>
        ) : (
          <>
            <ul className="course-list">
              {pageLessons.map(
                (lesson: LessonWithProgress) => (
                  <li key={lesson.id} className="course-row">
                    <div
                      className="course-icon"
                      style={{background: lesson.color}}
                      aria-hidden="true"
                    >
                      <LessonIcon name={lesson.icon} size={20}/>
                    </div>

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
              total={lessons.length}
              pageSize={PAGE_SIZE}
              onChange={setPage}
            />
          </>
        )}
      </section>

      <Updater refresh={updateCheckToken}/>
    </main>
  );
}
