import { useEffect, useState } from "react";
import { Link } from "react-router";
import "@/styles/dashboard.css";
import LoadingSpinner from "@/components/LoadingSpinner";
import { FEATURE_FLAGS } from "@/lib/config/featureFlags";
import { getLessons } from "@/lib/helpers/getLessons";

import type { LessonMeta } from "@/lib/api/getLessonsMeta";

export default function Dashboard() {
  const [lessons, setLessons] = useState<LessonMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLessons = async () => {
      if (FEATURE_FLAGS.useBackend) {
        const module = await import("@/lib/api/getLessonsMeta");
        const data = await module.getLessonsMeta();
        setLessons(data);
      } else {
        setLessons(getLessons());
      }
      setLoading(false);
    };

    loadLessons();
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <main className="dashboard-page">
      <h1 className="dashboard-title">Lessons</h1>
      <ul className="dashboard-grid">
        {lessons.map(({ slug, title, description, color }) => {
          const avatarLetter = title?.trim()?.charAt(0)?.toUpperCase() || "?";
          return (
            <li key={slug} className="lesson-card">
              <div className="lesson-card-header">
                <div
                  className="lesson-card-avatar"
                  style={{
                    background: color
                      ? `linear-gradient(135deg, ${color}, oklch(from ${color} 70% 0.25 h))`
                      : "linear-gradient(135deg, var(--color-primary), oklch(80% 0.2 150))",
                  }}
                >
                  {avatarLetter}
                </div>
                <h2 className="lesson-card-title">{title}</h2>
              </div>

              <p className="lesson-card-description">{description}</p>

              <Link
                to={`/lessons/${slug}`}
                className="lesson-card-link"
                aria-label={`Start lesson "${title}"`}
              >
                Start →
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
