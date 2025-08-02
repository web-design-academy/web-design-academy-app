import { useEffect, useState } from "react";
import sunIcon from "../assets/sun.svg";
import moonIcon from "../assets/moon.svg";

const THEME_KEY = "preferred-theme";

export default function ThemeSwitcher() {
  const getSystemTheme = () =>
    window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";

  const getInitialTheme = () => {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
    return getSystemTheme();
  };

  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    if (localStorage.getItem(THEME_KEY)) return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handler = (e: MediaQueryListEvent) => {
      setTheme(e.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem(THEME_KEY, newTheme);
  };

  return (
    <button
      onClick={toggleTheme}
      aria-label="Toggle light/dark theme"
      title="Toggle light/dark theme"
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 0,
      }}
    >
      <img
        src={theme === "light" ? sunIcon : moonIcon}
        alt={theme === "light" ? "Light mode" : "Dark mode"}
        width={24}
        height={24}
      />
    </button>
  );
}
