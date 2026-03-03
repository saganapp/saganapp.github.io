import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { en } from "./en";
import { es } from "./es";
import type { Locale, TranslationParams } from "./types";

const dictionaries: Record<Locale, Record<string, string>> = { en, es };

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: TranslationParams) => string;
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

function detectLocale(): Locale {
  const hl = new URLSearchParams(window.location.search).get("hl");
  if (hl === "en" || hl === "es") return hl;
  const stored = localStorage.getItem("sagan-locale");
  if (stored === "en" || stored === "es") return stored;
  if (navigator.language.startsWith("es")) return "es";
  return "en";
}

function translate(
  dict: Record<string, string>,
  fallback: Record<string, string>,
  key: string,
  params?: TranslationParams,
): string {
  let resolvedKey = key;

  // Handle _one/_other pluralization
  if (params && "count" in params) {
    const count = Number(params.count);
    const pluralKey = count === 1 ? `${key}_one` : `${key}_other`;
    if (pluralKey in dict || pluralKey in fallback) {
      resolvedKey = pluralKey;
    }
  }

  let value = dict[resolvedKey] ?? fallback[resolvedKey] ?? key;

  // Replace {{placeholder}} tokens
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      value = value.replaceAll(`{{${k}}}`, String(v));
    }
  }

  return value;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = (next: Locale) => {
    localStorage.setItem("sagan-locale", next);
    setLocaleState(next);
  };

  const t = useCallback(
    (key: string, params?: TranslationParams) =>
      translate(dictionaries[locale], en, key, params),
    [locale],
  );

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within I18nProvider");
  return ctx;
}
