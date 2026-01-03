import { Link, Outlet, useNavigate } from "react-router";

import "@/styles/root.css";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { useAuth } from "@/lib/ctx/useAuth";

export default function Root() {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="app-container">
      <header>
        <div className="header-left">
          <Link to="/" className="logo-link">
            <img
              src="/logo.svg"
              alt="Web Academy Icon"
              className="logo-image"
            />
            <span className="logo-title">Web Academy</span>
          </Link>
        </div>

        <div className="header-right">
          {user?.role === "admin" && (
            <Link to="/admin" className="nav-link">
              Admin Panel
            </Link>
          )}

          {isAuthenticated ? (
            <>
              {user && user.role !== "admin" && (
                <span className="user-text">{user.name}</span>
              )}

              <button onClick={handleLogout} className="btn-ghost">
                Sign Out
              </button>
            </>
          ) : (
            <Link to="/login" className="btn-primary">
              Sign In
            </Link>
          )}

          <ThemeSwitcher />
        </div>
      </header>

      <Outlet />
    </div>
  );
}
