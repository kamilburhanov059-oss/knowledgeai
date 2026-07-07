"use client";

import { useLang } from "@/context/lang-context";

export function LangToggle() {
  const { lang, setLang } = useLang();

  return (
    <div style={{
      display: "flex", borderRadius: "12px", padding: "4px", gap: "4px",
      background: "var(--color-card)", border: "1px solid var(--color-card-border)",
    }}>
      {(["ru", "uz"] as const).map((l) => (
        <button key={l} onClick={() => setLang(l)} style={{
          padding: "4px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 700,
          cursor: "pointer", border: "none", transition: "all 0.2s",
          background: lang === l ? "var(--color-primary)" : "transparent",
          color: lang === l ? "#fff" : "var(--color-muted)",
        }}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
