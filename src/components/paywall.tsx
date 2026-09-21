"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { useLang } from "@/context/lang-context";
import { translate } from "@/lib/translate";

export function Paywall() {
  const { lang } = useLang();

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", textAlign: "center", background: "var(--color-background)" }}>
      <div style={{ width: "64px", height: "64px", borderRadius: "20px", background: "var(--color-primary-light)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "20px" }}>
        <Lock size={28} style={{ color: "var(--color-primary)" }} />
      </div>
      <h1 style={{ fontSize: "22px", fontWeight: 800, color: "var(--color-foreground)", marginBottom: "8px" }}>
        {translate(lang, "Пробный период закончился")}
      </h1>
      <p style={{ fontSize: "14px", color: "var(--color-muted)", marginBottom: "24px", maxWidth: "360px" }}>
        {translate(lang, "Чтобы продолжить пользоваться KnowledgeAI, оформите подписку — $5/мес.")}
      </p>
      <Link href="/billing" style={{ padding: "13px 28px", borderRadius: "12px", background: "var(--color-primary)", color: "white", fontWeight: 700, fontSize: "15px", textDecoration: "none" }}>
        {translate(lang, "Оформить подписку")}
      </Link>
    </div>
  );
}
