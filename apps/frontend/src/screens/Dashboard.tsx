import { useEffect, useState } from "react";
import { Link } from "react-router";
import "@/styles/dashboard.css";
import LoadingSpinner from "@/components/LoadingSpinner";
import Pagination from "@/components/Pagination";
import { getLessons, type LessonMeta } from "@/lib/helpers/getLessons";
import { getLessonTasksSync } from "@/lib/helpers/getTasks";
import LessonIcon from "@/components/LessonIcon";
import { useAuth } from "@/lib/ctx/useAuth";
import { isOnlineMode } from "@/lib/config/appMode";
import { API_BASE } from "@/lib/api/client";
import { ArrowRight } from "lucide-react";

const PAGE_SIZE = 8;

type LessonWithProgress = LessonMeta & {
  progress: number;
  taskCount: number;
};

export default function Dashboard() {
  const [lessons, setLessons] = useState<LessonWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const { user, isAuthenticated } = useAuth();

  const showProgress = isAuthenticated && user?.role === "student";

  useEffect(() => {
    const fetchAllProgress = async () => {
      const allLessons = getLessons();

      if (!isOnlineMode || !showProgress) {
        setLessons(
          allLessons.map((lesson) => ({
            ...lesson,
            progress: 0,
            taskCount: getLessonTasksSync(lesson.slug).length,
          })),
        );
        setLoading(false);
        return;
      }

      const lessonsWithProgress = await Promise.all(
        allLessons.map(async (lesson) => {
          try {
            const res = await fetch(`${API_BASE}/progress/${lesson.slug}`);
            const data = await res.json();
            const completedCount = data.completedTaskIds?.length || 0;
            const taskCount = getLessonTasksSync(lesson.slug).length;

            const progress =
              taskCount > 0
                ? Math.round((completedCount / taskCount) * 100)
                : 0;

            return { ...lesson, progress, taskCount };
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch (err) {
            return {
              ...lesson,
              progress: 0,
              taskCount: getLessonTasksSync(lesson.slug).length,
            };
          }
        }),
      );

      setLessons(lessonsWithProgress);
      setLoading(false);
    };

    fetchAllProgress();
  }, [isAuthenticated, showProgress]);

  if (loading) return <LoadingSpinner />;

  const pageLessons = lessons.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <main className="dashboard-page">
      <div className="dashboard-shell">
        <h1 className="dashboard-title">Course dashboard</h1>

        <ul className="course-list">
          {pageLessons.map(
            ({ slug, title, description, color, icon, progress, taskCount }) => (
              <li key={slug} className="course-row">
                <div
                  className="course-icon"
                  style={{ background: color }}
                  aria-hidden="true"
                >
                  <LessonIcon name={icon} size={20} />
                </div>

                <div className="course-info">
                  <h2 className="course-name">{title}</h2>
                  <p className="course-description">{description}</p>
                </div>

                <div className="course-right">
                  <span className="course-task-count">
                    {taskCount} {taskCount === 1 ? "task" : "tasks"}
                  </span>

                  {showProgress && (
                    <div className="course-progress">
                      <div className="course-progress-bar-bg">
                        <div
                          className="course-progress-bar-fill"
                          style={{
                            width: `${progress}%`,
                            background: color,
                          }}
                        />
                      </div>
                      <span className="course-progress-label">{progress}%</span>
                    </div>
                  )}

                  <Link
                    to={`/lessons/${slug}`}
                    className="btn-primary"
                    aria-label={`Open lesson "${title}"`}
                  >
                    {showProgress && progress > 0
                      ? progress === 100
                        ? "Review"
                        : "Continue"
                      : user?.role === "admin"
                        ? "View"
                        : "Start"}
                    <ArrowRight size={16} />
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
      </div>
    </main>
  );
}
