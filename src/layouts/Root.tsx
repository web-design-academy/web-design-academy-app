import { Link, Outlet } from "react-router";
import "../styles/root.css";
import ThemeSwitcher from "../components/ThemeSwitcher";

export default function Root() {
  return (
    <div className="app-container">
      <header>
        <Link to="/" className="header-link">
          <img src="/logo.svg" alt="Web Fundamentals Logo" />
          <span className="logo">Web Fundamentals</span>
        </Link>
        <ThemeSwitcher />
      </header>
      <Outlet />
    </div>
  );
}
