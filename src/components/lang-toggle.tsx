"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, X } from "lucide-react";
import { useLang } from "@/context/lang-context";
import { LANGUAGES } from "@/lib/translate";

export function LangToggle() {
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);

  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Language"
        style={{
          display: "flex", alignItems: "center", gap: "6px", padding: "6px 10px", borderRadius: "10px",
          fontSize: "12px", fontWeight: 700, cursor: "pointer",
          background: "var(--color-card)", border: "1px solid var(--color-card-border)", color: "var(--color-foreground)",
        }}
      >
        {current.code.toUpperCase()}
        <ChevronDown size={13} style={{ color: "var(--color-muted)" }} />
      </button>

      {open && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={() => setOpen(false)} />
          <div
            style={{
              position: "relative", width: "100%", maxWidth: "360px", maxHeight: "min(560px, 80dvh)",
              display: "flex", flexDirection: "column", borderRadius: "20px",
              background: "var(--color-card)", border: "1px solid var(--color-card-border)",
              boxShadow: "0 25px 50px rgba(0,0,0,0.5)", overflow: "hidden",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 18px 12px", flexShrink: 0 }}>
              <span style={{ fontSize: "16px", fontWeight: 700, color: "var(--color-foreground)" }}>Language</span>
              <button onClick={() => setOpen(false)} style={{ color: "var(--color-muted)", background: "none", border: "none", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ overflowY: "auto", padding: "0 10px 10px" }}>
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  onClick={() => { setLang(l.code); setOpen(false); }}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px",
                    padding: "12px 12px", borderRadius: "12px", fontSize: "14px", fontWeight: l.code === lang ? 700 : 500,
                    cursor: "pointer", border: "none", textAlign: "left",
                    background: l.code === lang ? "var(--color-primary-light)" : "transparent",
                    color: l.code === lang ? "var(--color-primary)" : "var(--color-foreground)",
                  }}
                >
                  <span>{l.native}</span>
                  {l.code === lang && <Check size={16} />}
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
