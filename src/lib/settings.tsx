import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Settings = {
  rememberGameFolder: boolean;
};

const DEFAULTS: Settings = {
  rememberGameFolder: true,
};

const KEY = "skin-fixer-settings";

function loadFromStorage(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return { ...DEFAULTS };
  }
}

type SettingsValue = {
  settings: Settings;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
};

const SettingsContext = createContext<SettingsValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadFromStorage);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(settings));
  }, [settings]);

  function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings(cur => ({ ...cur, [key]: value }));
  }

  return (
    <SettingsContext.Provider value={{ settings, setSetting }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const value = useContext(SettingsContext);
  if (!value) throw new Error("useSettings outside provider");
  return value;
}

/** Read a setting once outside React (e.g. on mount before provider). */
export function getSetting<K extends keyof Settings>(key: K): Settings[K] {
  return loadFromStorage()[key];
}
