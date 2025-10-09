import { Link, Outlet } from "react-router";

import "@/styles/root.css";
import ThemeSwitcher from "@/components/ThemeSwitcher";

export default function Root() {
  return (
    <div className="app-container">
      <header>
        <Link to="/" className="header-link">
          <img src="/logo.svg" alt="Web Academy Icon" className="logo-image" />
          <span className="logo-title">Web Academy</span>
        </Link>
        <ThemeSwitcher />
      </header>
      <Outlet />
    </div>
  );
}
