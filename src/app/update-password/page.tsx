"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { AppLogo } from "@/components/app-logo";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setReady(true);
      } else {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === "PASSWORD_RECOVERY" && session) {
            setReady(true);
            subscription.unsubscribe();
          }
        });
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError("Пароли не совпадают"); return; }
    if (password.length < 6) { setError("Минимум 6 символов"); return; }
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-background)", padding: "24px" }}>
      <div style={{ width: "100%", maxWidth: "400px" }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <AppLogo size={56} radius={16} margin="0 auto 16px" />
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--color-foreground)" }}>Новый пароль</h1>
          <p style={{ fontSize: "14px", color: "var(--color-muted)", marginTop: "6px" }}>Введите новый пароль для вашего аккаунта</p>
        </div>

        {!ready ? (
          <p style={{ textAlign: "center", color: "var(--color-muted)" }}>Проверка сессии...</p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-foreground)", display: "block", marginBottom: "6px" }}>Новый пароль</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Минимум 6 символов"
                style={{ width: "100%", padding: "12px 14px", borderRadius: "12px", border: "1.5px solid var(--color-card-border)", background: "var(--color-card)", color: "var(--color-foreground)", fontSize: "15px", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-foreground)", display: "block", marginBottom: "6px" }}>Повторите пароль</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required placeholder="Повторите пароль"
                style={{ width: "100%", padding: "12px 14px", borderRadius: "12px", border: "1.5px solid var(--color-card-border)", background: "var(--color-card)", color: "var(--color-foreground)", fontSize: "15px", boxSizing: "border-box" }} />
            </div>
            {error && <p style={{ color: "#ef4444", fontSize: "14px", textAlign: "center" }}>{error}</p>}
            <button type="submit" disabled={loading}
              style={{ padding: "13px", borderRadius: "12px", background: "var(--color-primary)", color: "white", fontWeight: 700, fontSize: "15px", border: "none", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
              {loading ? "Сохранение..." : "Сохранить пароль"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
