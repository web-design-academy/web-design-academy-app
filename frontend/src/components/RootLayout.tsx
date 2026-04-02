import { Link, Outlet, useNavigate } from "react-router";
import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";
import { useState } from "react";
import "@/styles/root.css";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { useAuth } from "@/lib/ctx/useAuth";
import Modal from "@/components/Modal";
import { useTheme } from "@/lib/ctx/useTheme";

export default function Root() {
  const { user, logout, isAuthenticated, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme();
  const apiEnabled = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const handleSuccess = async (credentialResponse: CredentialResponse) => {
    try {
      if (!credentialResponse.credential) return;
      setError(null);

      const data = await loginWithGoogle(credentialResponse.credential);

      if (data.role === "admin") {
        navigate("/admin");
      } else {
        navigate("/");
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="app-container">
      <Modal
        title="Authentication Error"
        isOpen={!!error}
        onClose={() => setError(null)}
        actions={
          <button className="btn-primary" onClick={() => setError(null)}>
            Try Again
          </button>
        }
      >
        <p>{error}</p>
      </Modal>

      <header>
        <div className="header-left">
          <Link to="/" className="logo-link">
            <img src="/logo.svg" alt="Web Academy Icon" className="logo-image" />
            <span className="logo-title">Web Academy</span>
          </Link>
        </div>

        <div className="header-right">
          {isAuthenticated ? (
            <>
              {user?.role === "admin" ? (
                <Link to="/admin" className="nav-link">{user?.name}</Link>
              ) : (
                <span className="user-text">{user?.name}</span>
              )}
              <button onClick={handleLogout} className="btn-ghost">
                Sign Out
              </button>
            </>
          ) : apiEnabled ? (
            <GoogleLogin
              onSuccess={handleSuccess}
              onError={() => setError("Google Auth Failed")}
              useOneTap={false}
              theme={theme === "light" ? "outline" : "filled_black"}
              shape="pill"
              size="medium"
              text="signin_with"
            />
          ) : null}

          <ThemeSwitcher />
        </div>
      </header>

      <Outlet />
    </div>
  );
}
