import { useEffect, useState } from "react";
import { Link } from "react-router";
import "@/styles/dashboard.css";
import LoadingSpinner from "@/components/LoadingSpinner";
import { getLessons, type LessonMeta } from "@/lib/helpers/getLessons";
import { getLessonTasksSync } from "@/lib/helpers/getTasks";
import LessonIcon from "@/components/LessonIcon";
import { useAuth } from "@/lib/ctx/useAuth";
import { isOnlineMode } from "@/lib/config/appMode";
import { API_BASE } from "@/lib/api/client";
import { ArrowRight } from "lucide-react";

export default function Dashboard() {
  const [lessons, setLessons] = useState<(LessonMeta & { progress: number })[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const { user, isAuthenticated } = useAuth();

  const showProgress = isAuthenticated && user?.role === "student";

  useEffect(() => {
    const fetchAllProgress = async () => {
      const allLessons = getLessons();

      if (!isOnlineMode || !showProgress) {
        setLessons(allLessons.map((l) => ({ ...l, progress: 0 })));
        setLoading(false);
        return;
      }

      const lessonsWithProgress = await Promise.all(
        allLessons.map(async (lesson) => {
          try {
            const res = await fetch(`${API_BASE}/progress/${lesson.slug}`);
            const data = await res.json();
            const completedCount = data.completedTaskIds?.length || 0;
            const totalTasks = getLessonTasksSync(lesson.slug).length;

            const progress =
              totalTasks > 0
                ? Math.round((completedCount / totalTasks) * 100)
                : 0;

            return { ...lesson, progress };
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch (err) {
            return { ...lesson, progress: 0 };
          }
        }),
      );

      setLessons(lessonsWithProgress);
      setLoading(false);
    };

    fetchAllProgress();
  }, [isAuthenticated, showProgress]);

  if (loading) return <LoadingSpinner />;

  return (
    <main className="dashboard-page">
      <ul className="dashboard-grid">
        {lessons.map(({ slug, title, description, color, icon, progress }) => (
          <li key={slug} className="lesson-card">
            <div className="lesson-card-header">
              <div
                className="lesson-card-avatar"
                style={{
                  background: color,
                }}
              >
                <LessonIcon name={icon} />
              </div>
              <h2 className="lesson-card-title">{title}</h2>
            </div>

            <p className="lesson-card-description">{description}</p>

            <div className="lesson-card-footer">
              {showProgress && (
                <div className="progress-container">
                  <span className="progress-text">{progress}%</span>
                  <div className="progress-bar-bg">
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${progress}%`,
                        backgroundColor: "var(--color-primary)",
                      }}
                    />
                  </div>
                </div>
              )}

              <Link
                to={`/lessons/${slug}`}
                className="btn-primary"
                aria-label={`Start lesson "${title}"`}
              >
                {showProgress && progress > 0
                  ? progress === 100
                    ? "Review"
                    : "Continue"
                  : user?.role === "admin"
                    ? "View"
                    : "Start"}
                <ArrowRight size={18} style={{ marginLeft: 8 }} />
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
