import { Link } from "react-router";
import { getLessons } from "../lib/helpers/getLessons";

import "../styles/dashboard.css";

export default function Dashboard() {
  const lessons = getLessons();

  return (
    <main className="dashboard-container">
      <h1>Dashboard</h1>
      <ul className="lesson-grid" aria-label="List of lessons">
        {lessons.map(({ slug, title, description }) => (
          <li key={slug} className="lesson-card">
            <h2>{title}</h2>
            <p>{description}</p>
            <Link
              to={`/lessons/${slug}`}
              className="lesson-card-button"
              aria-label={`Start lesson "${title}"`}
            >
              Start →
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
