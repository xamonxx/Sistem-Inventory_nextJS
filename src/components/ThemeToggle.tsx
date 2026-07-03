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
      className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card dark:bg-card text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 hover:text-foreground dark:hover:text-slate-200 transition cursor-pointer select-none animate-in fade-in duration-200"
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
