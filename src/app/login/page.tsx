"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Brain } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ThemeToggle } from "@/components/theme-toggle";
import { LangToggle } from "@/components/lang-toggle";
import { useLang } from "@/context/lang-context";
import { t } from "@/lib/i18n";
import { translate } from "@/lib/translate";

export default function LoginPage() {
  const { lang } = useLang();
  const TA = t[lang].auth;
  const router = useRouter();

  const [tab, setTab] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.push("/dashboard");
    });
  }, []);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    setError("");
    setSuccess("");

    const isASCII = (s: string) => /^[\x00-\x7F]*$/.test(s);
    if (!isASCII(email)) {
      setError(translate(lang, "Email должен содержать только латинские символы. Проверьте раскладку клавиатуры."));
      setLoading(false);
      return;
    }
    if (!isASCII(password)) {
      setError(translate(lang, "Пароль должен содержать только латинские символы и цифры."));
      setLoading(false);
      return;
    }

    if (tab === "in") {
      const { error: e } = await supabase.auth.signInWithPassword({ email, password });
      if (e) { setError(e.message); setLoading(false); return; }
      router.push("/dashboard");
    } else {
      const { data, error: e } = await supabase.auth.signUp({ email, password });
      if (e) { setError(e.message); setLoading(false); return; }
      if (data.session) {
        router.push("/dashboard");
        return;
      }
      setSuccess(TA.checkEmail);
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError(translate(lang, "Введите email, на который зарегистрирован аккаунт"));
      return;
    }
    setLoading(true);
    setError("");
    setSuccess("");
    const { error: e } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    setLoading(false);
    if (e) { setError(e.message); return; }
    setSuccess(translate(lang, "Письмо со ссылкой для сброса пароля отправлено на почту"));
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--color-background)" }}>
      <nav style={{ padding: "0 24px", height: "60px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--color-card-border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "32px", height: "32px", borderRadius: "10px", background: "var(--color-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Brain size={16} color="white" />
          </div>
          <span style={{ fontWeight: 700, fontSize: "17px", color: "var(--color-foreground)" }}>KnowledgeAI</span>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <LangToggle />
          <ThemeToggle />
        </div>
      </nav>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <div style={{ width: "100%", maxWidth: "400px" }}>

          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <div style={{ width: "64px", height: "64px", borderRadius: "20px", background: "var(--color-primary)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Brain size={30} color="white" />
            </div>
            <h1 style={{ fontSize: "24px", fontWeight: 800, color: "var(--color-foreground)", marginBottom: "6px" }}>KnowledgeAI</h1>
            <p style={{ fontSize: "14px", color: "var(--color-muted)" }}>
              {translate(lang, "Персональный AI-ассистент")}
            </p>
          </div>

          <div style={{ borderRadius: "20px", padding: "28px", background: "var(--color-card)", border: "1px solid var(--color-card-border)", boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}>

            <div style={{ display: "flex", gap: "6px", marginBottom: "24px", background: "var(--color-background)", borderRadius: "12px", padding: "4px" }}>
              {(["in", "up"] as const).map((tb) => (
                <button key={tb} onClick={() => { setTab(tb); setError(""); setSuccess(""); }}
                  style={{ flex: 1, padding: "10px", borderRadius: "10px", fontSize: "14px", fontWeight: 600, border: "none", cursor: "pointer", background: tab === tb ? "var(--color-card)" : "transparent", color: tab === tb ? "var(--color-foreground)" : "var(--color-muted)", boxShadow: tab === tb ? "0 1px 4px rgba(0,0,0,0.2)" : "none", transition: "all 0.2s" }}>
                  {tb === "in" ? TA.signIn : TA.signUp}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: "6px" }}>{TA.email}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  placeholder={TA.enterEmail}
                  style={{ width: "100%", padding: "12px 16px", borderRadius: "12px", outline: "none", fontSize: "14px", background: "var(--color-background)", border: "1px solid var(--color-card-border)", color: "var(--color-foreground)", boxSizing: "border-box" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: "6px" }}>{TA.password}</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  placeholder={TA.enterPassword}
                  style={{ width: "100%", padding: "12px 16px", borderRadius: "12px", outline: "none", fontSize: "14px", background: "var(--color-background)", border: "1px solid var(--color-card-border)", color: "var(--color-foreground)", boxSizing: "border-box" }}
                />
                {tab === "in" && (
                  <button type="button" onClick={handleForgotPassword} disabled={loading}
                    style={{ marginTop: "8px", background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: "13px", color: "var(--color-primary)", fontWeight: 600 }}>
                    {translate(lang, "Забыли пароль?")}
                  </button>
                )}
              </div>

              {error && (
                <div style={{ padding: "10px 14px", borderRadius: "10px", background: "#ef444418", border: "1px solid #ef444440", fontSize: "13px", color: "#ef4444" }}>
                  {error}
                </div>
              )}

              {success && (
                <div style={{ padding: "10px 14px", borderRadius: "10px", background: "#10b98118", border: "1px solid #10b98140", fontSize: "13px", color: "#10b981" }}>
                  {success}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={loading || !email.trim() || !password.trim()}
                style={{ width: "100%", padding: "13px", borderRadius: "12px", fontWeight: 700, fontSize: "15px", border: "none", cursor: "pointer", background: "var(--color-primary)", color: "white", opacity: loading || !email.trim() || !password.trim() ? 0.5 : 1, marginTop: "4px" }}>
                {loading ? TA.loading : tab === "in" ? TA.signIn : TA.register}
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "4px 0" }}>
                <div style={{ flex: 1, height: "1px", background: "var(--color-card-border)" }} />
                <span style={{ fontSize: "12px", color: "var(--color-muted)" }}>{translate(lang, "или")}</span>
                <div style={{ flex: 1, height: "1px", background: "var(--color-card-border)" }} />
              </div>

              <button
                onClick={handleGoogle}
                style={{ width: "100%", padding: "12px", borderRadius: "12px", fontWeight: 600, fontSize: "14px", border: "1px solid var(--color-card-border)", cursor: "pointer", background: "var(--color-background)", color: "var(--color-foreground)", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                {TA.google}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
