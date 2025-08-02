import { Link, Outlet } from "react-router";
import "../styles/root.css";
import ThemeSwitcher from "../components/ThemeSwitcher";

export default function Root() {
  return (
    <>
      <header>
        <Link to="/" className="header-link">
          <img src="/logo.svg" alt="Web Fundamentals Logo" />
          <h1 className="logo">Web Fundamentals</h1>
        </Link>
        <ThemeSwitcher />
      </header>
      <main>
        <Outlet />
      </main>
    </>
  );
}
