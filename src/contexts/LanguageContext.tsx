import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type AppLanguage = "en" | "es";

const LANGUAGE_STORAGE_KEY = "pya_language";

const resolveInitialLanguage = (): AppLanguage => {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (stored === "en" || stored === "es") return stored;
  return window.navigator.language.toLowerCase().startsWith("es") ? "es" : "en";
};

type LanguageContextType = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(resolveInitialLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  const setLanguage = useCallback((nextLanguage: AppLanguage) => {
    setLanguageState(nextLanguage);
  }, []);

  const value = useMemo(() => ({ language, setLanguage }), [language, setLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}

