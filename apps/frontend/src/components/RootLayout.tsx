import { Link, Outlet, useLocation, useNavigate } from "react-router";
import { useGoogleLogin } from "@react-oauth/google";
import { useEffect, useState } from "react";
import { Loader2, LogOut, Menu, X } from "lucide-react";
import "@/styles/root.css";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { useAuth } from "@/lib/ctx/useAuth";
import Modal from "@/components/Modal";
import { isGoogleAuthEnabled } from "@/lib/config/appMode";
import type { AuthData } from "@/lib/api/auth";

interface GoogleSignInButtonProps {
  onAuthenticated: (data: AuthData) => void;
  onError: (message: string) => void;
}

function GoogleSignInButton({
  onAuthenticated,
  onError,
}: GoogleSignInButtonProps) {
  const { loginWithGoogle } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);

  const finishLogin = async (accessToken: string) => {
    try {
      onError("");
      setIsSigningIn(true);

      const data = await loginWithGoogle({ accessToken });
      onAuthenticated(data);
    } catch (err) {
      if (err instanceof Error) {
        onError(err.message);
      } else {
        onError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const googleLogin = useGoogleLogin({
    onSuccess: ({ access_token }) => {
      void finishLogin(access_token);
    },
    onError: () => onError("Google Auth Failed"),
    onNonOAuthError: () => onError("Google Auth Failed"),
    scope: "openid email profile",
  });

  return (
    <button
      type="button"
      className="btn-ghost google-signin-button"
      onClick={() => {
        if (!isSigningIn) googleLogin();
      }}
      disabled={isSigningIn}
    >
      {isSigningIn ? (
        <Loader2 size={16} className="spin" aria-hidden="true" />
      ) : (
        <img
          src={`${import.meta.env.BASE_URL}google.svg`}
          alt=""
          className="google-signin-icon"
          aria-hidden="true"
        />
      )}
      <span>Sign in with Google</span>
    </button>
  );
}

export default function Root() {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(
    typeof window !== "undefined" ? window.innerWidth <= 768 : false,
  );

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

  const handleLogout = () => {
    logout();
    setIsMobileMenuOpen(false);
    navigate("/");
  };

  const handleAuthenticated = (data: AuthData) => {
    if (data.role === "admin") {
      navigate("/admin");
    } else {
      navigate("/");
    }
  };

  const handleAuthError = (message: string) => {
    setError(message || null);
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
              src={`${import.meta.env.BASE_URL}logo.svg`}
              alt="Web Design Academy logo"
              className="logo-image"
            />
            <span className="logo-text">Web Design Academy</span>
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
            <GoogleSignInButton
              onAuthenticated={handleAuthenticated}
              onError={handleAuthError}
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
              <GoogleSignInButton
                onAuthenticated={handleAuthenticated}
                onError={handleAuthError}
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

      <div className="app-content">
        <Outlet />
      </div>

      <footer className="app-footer">
        <span>&copy; {new Date().getFullYear()} Web Design Academy</span>
        <a href="mailto:support@webdesignacademy.org">
          support@webdesignacademy.org
        </a>
      </footer>
    </div>
  );
}
