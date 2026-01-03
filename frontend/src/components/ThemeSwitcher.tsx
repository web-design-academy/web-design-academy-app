import sunIcon from "@/assets/sun.svg";
import moonIcon from "@/assets/moon.svg";
import { useTheme } from "@/lib/ctx/useTheme";

export default function ThemeSwitcher() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      aria-label="Toggle light/dark theme"
      title="Toggle light/dark theme"
      style={{
        background: "transparent",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
        cursor: "pointer",
        padding: "6px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "36px",
        height: "36px",
      }}
    >
      <img
        src={theme === "light" ? moonIcon : sunIcon}
        alt={theme === "light" ? "Change to dark mode" : "Change to light mode"}
        className="theme-switcher"
        style={{ width: "20px", height: "20px" }}
      />
    </button>
  );
}
