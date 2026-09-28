import React, { useEffect, useState } from "react";
import { Palette } from "lucide-react";

const THEMES = [
  ["classic", "Classic"],
  ["daylight", "Daylight"],
  ["violet", "Violet"],
  ["ocean", "Ocean"],
];
const STORAGE_KEY = "dexlab-theme-v1";
function savedTheme() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (THEMES.some(([id]) => id === value)) return value;
  } catch { /* Theme selection still works when storage is unavailable. */ }
  return "classic";
}
const initialTheme = savedTheme();
document.documentElement.dataset.theme = initialTheme;

export function ThemeSelector() {
  const [theme, setTheme] = useState(initialTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* Session only. */ }
  }, [theme]);
  return (
    <label className="theme-picker">
      <Palette size={16} aria-hidden="true" />
      <span className="sr-only">Theme</span>
      <select value={theme} onChange={(e) => setTheme(e.target.value)}>
        {THEMES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select>
    </label>
  );
}
