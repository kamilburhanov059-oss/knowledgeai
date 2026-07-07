"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Brain, Sparkles, ChevronRight, BookOpen, Shield, Zap, Globe } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { LangToggle } from "@/components/lang-toggle";
import { useLang } from "@/context/lang-context";
import { t } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

const featureIcons = [BookOpen, Brain, Globe, Shield, Zap, Sparkles];

export default function LandingPage() {
  const { lang } = useLang();
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.push("/dashboard");
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) router.push("/dashboard");
    });

    return () => subscription.unsubscribe();
  }, []);
  const T = t[lang];

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-background)", display: "flex", flexDirection: "column", position: "relative" }}>

      {/* Блобы */}
      <div style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "-160px", right: "-160px", width: "500px", height: "500px", borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.25), transparent 70%)", filter: "blur(40px)" }} />
        <div style={{ position: "absolute", top: "40%", left: "-160px", width: "400px", height: "400px", borderRadius: "50%", background: "radial-gradient(circle, rgba(168,85,247,0.15), transparent 70%)", filter: "blur(40px)" }} />
      </div>

      {/* Навбар */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, borderBottom: "1px solid var(--color-card-border)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", background: "color-mix(in srgb, var(--color-background) 88%, transparent)" }}>
        <div className="nav-inner">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "34px", height: "34px", borderRadius: "10px", background: "var(--color-primary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Brain size={18} color="white" />
            </div>
            <span style={{ fontWeight: 700, fontSize: "18px", color: "var(--color-foreground)" }}>KnowledgeAI</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <LangToggle />
            <ThemeToggle />
            <Link href="/dashboard" style={{ padding: "8px 16px", borderRadius: "10px", background: "var(--color-primary)", color: "white", fontWeight: 600, fontSize: "14px", textDecoration: "none", whiteSpace: "nowrap" }}>
              {T.nav.login}
            </Link>
          </div>
        </div>
      </nav>

      <main style={{ flex: 1, position: "relative", zIndex: 1 }}>

        {/* Герой */}
        <section className="hero-section">
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "8px 16px", borderRadius: "100px", background: "var(--color-primary-light)", color: "var(--color-primary)", fontSize: "13px", fontWeight: 600, marginBottom: "28px" }}>
            <Sparkles size={14} />
            {T.hero.badge}
          </div>

          <h1 style={{ fontSize: "clamp(36px, 6vw, 72px)", fontWeight: 800, lineHeight: 1.1, color: "var(--color-foreground)", marginBottom: "20px" }}>
            {T.hero.title1}<br />
            <span className="gradient-text">{T.hero.title2}</span>
          </h1>

          <p style={{ fontSize: "clamp(15px, 2vw, 18px)", color: "var(--color-muted)", maxWidth: "540px", margin: "0 auto 36px", lineHeight: 1.7 }}>
            {T.hero.subtitle}
          </p>

          <div className="hero-buttons">
            <Link href="/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "14px 28px", borderRadius: "14px", background: "linear-gradient(135deg, #7c3aed, #a855f7)", color: "white", fontWeight: 700, fontSize: "16px", textDecoration: "none", boxShadow: "0 0 30px rgba(124,58,237,0.4)" }}>
              {T.hero.startFree} <ChevronRight size={20} />
            </Link>
            <button style={{ padding: "14px 28px", borderRadius: "14px", background: "var(--color-card)", border: "1px solid var(--color-card-border)", color: "var(--color-foreground)", fontWeight: 600, fontSize: "16px", cursor: "pointer" }}>
              {T.hero.watchDemo}
            </button>
          </div>
        </section>

        {/* Превью */}
        <section className="preview-section">
          <div style={{ borderRadius: "20px", padding: "2px", background: "linear-gradient(135deg, rgba(124,58,237,0.4), rgba(168,85,247,0.2))" }}>
            <div style={{ borderRadius: "18px", background: "var(--color-card)", padding: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "18px" }}>
                <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#ef4444" }} />
                <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#f59e0b" }} />
                <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#10b981" }} />
                <div style={{ flex: 1, height: "24px", borderRadius: "6px", background: "var(--color-card-border)", marginLeft: "8px" }} />
              </div>
              <div className="grid-preview-cards">
                {[
                  { emoji: "📚", name: lang === "ru" ? "Война и Мир" : "Urush va Tinchlik", books: 4, color: "#7c3aed" },
                  { emoji: "📐", name: lang === "ru" ? "Математика" : "Matematika", books: 7, color: "#0ea5e9" },
                  { emoji: "⚖️", name: lang === "ru" ? "Конституция" : "Konstitutsiya", books: 2, color: "#10b981" },
                ].map((c) => (
                  <div key={c.name} style={{ borderRadius: "14px", padding: "14px", background: "var(--color-background)", border: "1px solid var(--color-card-border)" }}>
                    <div style={{ width: "44px", height: "44px", borderRadius: "10px", background: `${c.color}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", marginBottom: "10px" }}>{c.emoji}</div>
                    <p style={{ fontWeight: 700, fontSize: "13px", color: "var(--color-foreground)", marginBottom: "3px" }}>{c.name}</p>
                    <p style={{ fontSize: "11px", color: "var(--color-muted)", marginBottom: "10px" }}>{c.books} {lang === "ru" ? "книг" : "kitob"}</p>
                    <div style={{ height: "5px", borderRadius: "3px", background: `${c.color}33` }}>
                      <div style={{ height: "5px", borderRadius: "3px", background: c.color, width: "70%" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Фичи */}
        <section className="section-inner">
          <h2 style={{ fontSize: "clamp(24px, 4vw, 32px)", fontWeight: 700, textAlign: "center", color: "var(--color-foreground)", marginBottom: "12px" }}>{T.features.heading}</h2>
          <p style={{ textAlign: "center", color: "var(--color-muted)", marginBottom: "48px", fontSize: "15px" }}>{T.features.sub}</p>
          <div className="grid-features">
            {T.features.items.map((f, i) => {
              const Icon = featureIcons[i];
              return (
                <div key={f.title} className="card-lift" style={{ borderRadius: "18px", padding: "24px", background: "var(--color-card)", border: "1px solid var(--color-card-border)" }}>
                  <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "var(--color-primary-light)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
                    <Icon size={20} style={{ color: "var(--color-primary)" }} />
                  </div>
                  <h3 style={{ fontWeight: 700, fontSize: "16px", color: "var(--color-foreground)", marginBottom: "8px" }}>{f.title}</h3>
                  <p style={{ fontSize: "14px", color: "var(--color-muted)", lineHeight: 1.6 }}>{f.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Тарифы */}
        <section style={{ background: "var(--color-card)", borderTop: "1px solid var(--color-card-border)", padding: "80px 24px" }}>
          <div className="pricing-inner">
            <h2 style={{ fontSize: "clamp(24px, 4vw, 32px)", fontWeight: 700, textAlign: "center", color: "var(--color-foreground)", marginBottom: "12px" }}>{T.pricing.heading}</h2>
            <p style={{ textAlign: "center", color: "var(--color-muted)", marginBottom: "48px", fontSize: "15px" }}>{T.pricing.sub}</p>
            <div className="grid-pricing">
              {T.pricing.plans.map((plan, i) => {
                const accent = i === 1;
                const prices = ["0", "5", "12"];
                return (
                  <div key={plan.name} style={{ borderRadius: "20px", padding: "24px", background: accent ? "linear-gradient(135deg, #7c3aed, #a855f7)" : "var(--color-background)", border: accent ? "none" : "1px solid var(--color-card-border)", position: "relative" }}>
                    {accent && (
                      <div style={{ position: "absolute", top: "-13px", left: "50%", transform: "translateX(-50%)", background: "white", color: "#7c3aed", padding: "3px 14px", borderRadius: "100px", fontSize: "12px", fontWeight: 700, whiteSpace: "nowrap" }}>
                        {T.pricing.popular}
                      </div>
                    )}
                    <p style={{ fontWeight: 600, color: accent ? "rgba(255,255,255,0.8)" : "var(--color-muted)", marginBottom: "8px", fontSize: "14px" }}>{plan.name}</p>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", marginBottom: "20px" }}>
                      <span style={{ fontSize: "40px", fontWeight: 800, color: accent ? "#fff" : "var(--color-foreground)" }}>${prices[i]}</span>
                      <span style={{ fontSize: "13px", color: accent ? "rgba(255,255,255,0.7)" : "var(--color-muted)", marginBottom: "7px" }}>/мес</span>
                    </div>
                    <ul style={{ listStyle: "none", marginBottom: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
                      {plan.features.map((feat) => (
                        <li key={feat} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", color: accent ? "rgba(255,255,255,0.9)" : "var(--color-foreground)" }}>
                          <div style={{ width: "18px", height: "18px", borderRadius: "50%", background: accent ? "rgba(255,255,255,0.2)" : "var(--color-primary-light)", color: accent ? "#fff" : "var(--color-primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700, flexShrink: 0 }}>✓</div>
                          {feat}
                        </li>
                      ))}
                    </ul>
                    <Link href="/dashboard" style={{ display: "block", textAlign: "center", padding: "11px", borderRadius: "11px", background: accent ? "rgba(255,255,255,0.2)" : "var(--color-primary)", color: "#fff", fontWeight: 600, fontSize: "14px", textDecoration: "none" }}>
                      {T.pricing.start}
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      <footer style={{ borderTop: "1px solid var(--color-card-border)", position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: "1152px", margin: "0 auto", padding: "28px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "22px", height: "22px", borderRadius: "6px", background: "var(--color-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Brain size={11} color="white" />
            </div>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-muted)" }}>KnowledgeAI</span>
          </div>
          <p style={{ fontSize: "12px", color: "var(--color-muted)" }}>© 2025 KnowledgeAI. {T.footer}</p>
        </div>
      </footer>
    </div>
  );
}
