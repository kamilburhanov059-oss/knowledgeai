"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { LANGS, isRtl, type Lang } from "@/lib/translate";

export type { Lang };

const STORAGE_KEY = "kai_lang";
const LANG_SET = new Set<string>(LANGS);

function detectFromBrowser(): Lang | null {
  // navigator.language gives e.g. "uz-UZ" or "en-US" — match on the primary subtag.
  const primary = navigator.language?.toLowerCase().split("-")[0];
  return primary && LANG_SET.has(primary) ? (primary as Lang) : null;
}

const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({
  lang: "ru",
  setLang: () => {},
});

export function LangProvider({ children }: { children: ReactNode }) {
  // Starts at "ru" to match the server-rendered markup (avoids a hydration
  // mismatch), then immediately swaps to the saved/detected language client-side.
  const [lang, setLangState] = useState<Lang>("ru");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && LANG_SET.has(saved)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLangState(saved as Lang);
    } else {
      const detected = detectFromBrowser();
      if (detected) setLangState(detected);
    }
  }, []);

  useEffect(() => {
    document.documentElement.dir = isRtl(lang) ? "rtl" : "ltr";
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    window.localStorage.setItem(STORAGE_KEY, l);
  };

  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}
