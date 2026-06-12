import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/ctx/useTheme";

export default function ThemeSwitcher() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      aria-label="Toggle light/dark theme"
      title="Toggle light/dark theme"
      className="icon-button"
    >
      {theme === "light" ? (
        <Moon className="theme-icon" size={20} aria-hidden="true" />
      ) : (
        <Sun className="theme-icon" size={20} aria-hidden="true" />
      )}
    </button>
  );
}
