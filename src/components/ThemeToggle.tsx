"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  // Initialize theme based on document class on mount
  useEffect(() => {
    const isDarkTheme = document.documentElement.classList.contains("dark");
    setIsDark(isDarkTheme);
  }, []);

  const toggleTheme = () => {
    const newDark = !isDark;
    setIsDark(newDark);

    if (newDark) {
      document.documentElement.classList.add("dark");
      document.documentElement.style.colorScheme = "dark";
      document.cookie = "theme=dark; path=/; max-age=31536000; SameSite=Lax";
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.style.colorScheme = "light";
      document.cookie = "theme=light; path=/; max-age=31536000; SameSite=Lax";
    }
  };

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className="chrome-icon-button relative flex h-11 w-11 cursor-pointer select-none items-center justify-center rounded-xl backdrop-blur-xl backdrop-saturate-150 transition animate-in fade-in duration-200"
      title={isDark ? "Ubah ke mode terang" : "Ubah ke mode gelap"}
      aria-label="Toggle theme"
    >
      {isDark ? (
        <Sun size={20} className="text-amber-400" />
      ) : (
        <Moon size={20} className="text-slate-600 dark:text-slate-400" />
      )}
    </button>
  );
}
