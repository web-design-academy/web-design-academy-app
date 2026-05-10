import { Link, Outlet, useLocation, useNavigate } from "react-router";
import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";
import { useEffect, useState } from "react";
import { LogOut, Menu, X } from "lucide-react";
import "@/styles/root.css";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { useAuth } from "@/lib/ctx/useAuth";
import Modal from "@/components/Modal";
import { useTheme } from "@/lib/ctx/useTheme";
import { isGoogleAuthEnabled } from "@/lib/config/appMode";

export default function Root() {
  const { user, logout, isAuthenticated, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(
    typeof window !== "undefined" ? window.innerWidth <= 768 : false,
  );
  const { theme } = useTheme();

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const closeOnWideScreen = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobileViewport(mobile);

      if (!mobile) {
        setIsMobileMenuOpen(false);
      }
    };

    closeOnWideScreen();
    window.addEventListener("resize", closeOnWideScreen);
    return () => window.removeEventListener("resize", closeOnWideScreen);
  }, []);

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return;
    }

    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [isMobileMenuOpen]);

  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

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
    setIsMobileMenuOpen(false);
    navigate("/");
  };

  const userIdentityContent = user ? (
    <>
      <span className="user-name-text">{user.name}</span>
      <span className="user-email">{user.email}</span>
    </>
  ) : null;

  const userIdentity = user ? (
    user.role === "admin" ? (
      <Link to="/admin" className="nav-link user-info-link">
        {userIdentityContent}
      </Link>
    ) : (
      <div className="user-info">{userIdentityContent}</div>
    )
  ) : null;

  const mobileUserIdentity = user ? (
    user.role === "admin" ? (
      <Link to="/admin" className="nav-link mobile-user-info user-info-link">
        {userIdentityContent}
      </Link>
    ) : (
      <div className="mobile-user-info">{userIdentityContent}</div>
    )
  ) : null;

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
            <img
              src="/logo.png"
              alt="Web Design Academy logo: Academic cap and letters WDA"
              className="logo-image"
            />
            <span className="logo-title">Web Design Academy</span>
          </Link>
        </div>

        <button
          className="icon-button hamburger-toggle"
          onClick={() => setIsMobileMenuOpen((prev) => !prev)}
          aria-label={
            isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"
          }
          aria-expanded={isMobileMenuOpen}
        >
          <Menu size={20} />
        </button>

        <div className="header-right">
          {isAuthenticated ? (
            <>
              {userIdentity}
              <button onClick={handleLogout} className="btn-ghost">
                Sign Out
              </button>
            </>
          ) : isGoogleAuthEnabled && !isMobileViewport ? (
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

      <aside className={`mobile-drawer ${isMobileMenuOpen ? "open" : ""}`}>
        <div className="mobile-drawer-header">
          <button
            className="icon-button"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="Close navigation menu"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mobile-drawer-content">
          {isAuthenticated ? (
            <div className="mobile-row">
              {mobileUserIdentity}
              <button
                onClick={handleLogout}
                className="icon-button mobile-row-icon"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : isGoogleAuthEnabled && isMobileViewport && isMobileMenuOpen ? (
            <div className="mobile-row">
              <span className="mobile-row-label">Sign in</span>
              <GoogleLogin
                onSuccess={handleSuccess}
                onError={() => setError("Google Auth Failed")}
                useOneTap={false}
                theme={theme === "light" ? "outline" : "filled_black"}
                type="icon"
                shape="circle"
                size="large"
              />
            </div>
          ) : null}

          <div className="mobile-row">
            <span className="mobile-row-label">Dark mode</span>
            <ThemeSwitcher />
          </div>
        </div>
      </aside>

      <button
        type="button"
        className={`mobile-menu-overlay ${isMobileMenuOpen ? "open" : ""}`}
        aria-label="Close menu overlay"
        onClick={() => setIsMobileMenuOpen(false)}
      />

      <Outlet />
    </div>
  );
}
