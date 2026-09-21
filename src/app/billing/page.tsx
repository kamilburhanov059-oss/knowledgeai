"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { LangToggle } from "@/components/lang-toggle";
import { useLang } from "@/context/lang-context";
import { translate } from "@/lib/translate";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useIsTwa } from "@/hooks/useIsTwa";
import { purchasePlaySubscription } from "@/lib/play-billing-client";

const PLAY_PRODUCT_ID = process.env.NEXT_PUBLIC_GOOGLE_PLAY_PRODUCT_ID || "premium_monthly";

type Subscription = { status: "inactive" | "active"; current_period_end: string | null };

export default function BillingPage() {
  const { lang } = useLang();
  const { user, loading: authLoading } = useAuth();
  const isTwa = useIsTwa();

  const [sub, setSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const loadSub = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("kai_subscriptions").select("status, current_period_end").eq("user_id", user.id).maybeSingle();
    setSub(data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user) loadSub();
  }, [user, loadSub]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("status") === "pending") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPending(true);
      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        await loadSub();
        if (attempts >= 10) clearInterval(interval);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [loadSub]);

  const isActive = !!(sub?.status === "active" && sub.current_period_end && new Date(sub.current_period_end) > new Date());

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isActive && pending) setPending(false);
  }, [isActive, pending]);

  const handleCheckout = async () => {
    setCheckingOut(true);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Ошибка сервера");
      window.location.href = body.checkout_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неизвестная ошибка");
      setCheckingOut(false);
    }
  };

  const handlePlayCheckout = async () => {
    setCheckingOut(true);
    setError("");
    try {
      const { purchaseToken } = await purchasePlaySubscription(PLAY_PRODUCT_ID);
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/billing/play/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ purchaseToken, productId: PLAY_PRODUCT_ID }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Ошибка сервера");
      await loadSub();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неизвестная ошибка");
    } finally {
      setCheckingOut(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--color-background)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-muted)", fontSize: "14px" }}>
        {translate(lang, "Загрузка...")}
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-background)" }}>
      <nav style={{ position: "sticky", top: 0, zIndex: 100, borderBottom: "1px solid var(--color-card-border)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", background: "color-mix(in srgb, var(--color-background) 88%, transparent)" }}>
        <div className="nav-inner">
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Link href="/dashboard" style={{ width: "38px", height: "38px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-card)", border: "1px solid var(--color-card-border)", color: "var(--color-muted)", textDecoration: "none", flexShrink: 0 }}>
              <ArrowLeft size={18} />
            </Link>
            <span style={{ fontWeight: 700, fontSize: "15px", color: "var(--color-foreground)" }}>{translate(lang, "Подписка")}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <LangToggle />
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <main className="page-container" style={{ maxWidth: "560px" }}>
        {pending && !isActive && (
          <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "14px 16px", borderRadius: "12px", background: "#f59e0b18", border: "1px solid #f59e0b40", fontSize: "13px", color: "#f59e0b", marginBottom: "20px" }}>
            <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
            {translate(lang, "Обрабатываем оплату...")}
          </div>
        )}

        {isActive ? (
          <div style={{ borderRadius: "20px", padding: "28px", background: "var(--color-card)", border: "1px solid var(--color-card-border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
              <CheckCircle2 size={22} color="#10b981" />
              <h1 style={{ fontSize: "19px", fontWeight: 700, color: "var(--color-foreground)" }}>{translate(lang, "Premium подписка активна")}</h1>
            </div>
            <p style={{ fontSize: "14px", color: "var(--color-muted)" }}>
              {translate(lang, "Активна до")}: {sub?.current_period_end ? new Date(sub.current_period_end).toLocaleDateString() : "—"}
            </p>
          </div>
        ) : (
          <div style={{ borderRadius: "20px", padding: "28px", background: "var(--color-card)", border: "1px solid var(--color-card-border)" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "var(--color-primary-light)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
              <Sparkles size={22} style={{ color: "var(--color-primary)" }} />
            </div>
            <h1 style={{ fontSize: "20px", fontWeight: 800, color: "var(--color-foreground)", marginBottom: "6px" }}>$5<span style={{ fontSize: "14px", fontWeight: 500, color: "var(--color-muted)" }}>/{translate(lang, "мес")}</span></h1>
            <p style={{ fontSize: "14px", color: "var(--color-muted)", marginBottom: "20px" }}>{translate(lang, "Без ограничений на разделы, книги и вопросы")}</p>

            {error && (
              <div style={{ marginBottom: "14px", padding: "10px 14px", borderRadius: "10px", background: "#ef444418", border: "1px solid #ef444440", fontSize: "13px", color: "#ef4444" }}>
                {error}
              </div>
            )}

            <button onClick={isTwa ? handlePlayCheckout : handleCheckout} disabled={checkingOut}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "13px", borderRadius: "12px", fontWeight: 700, fontSize: "15px", border: "none", cursor: "pointer", background: "var(--color-primary)", color: "white", opacity: checkingOut ? 0.6 : 1 }}>
              {checkingOut && <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />}
              {translate(lang, isTwa ? "Оплатить через Google Play" : "Оплатить")}
            </button>
          </div>
        )}
      </main>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
