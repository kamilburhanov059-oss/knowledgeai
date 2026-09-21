"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Brain, Send, Loader2, Download, CheckCircle, XCircle, Clock } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { LangToggle } from "@/components/lang-toggle";
import { useLang } from "@/context/lang-context";
import { t } from "@/lib/i18n";
import { translate, formatSkippedWarning } from "@/lib/translate";
import { supabase, type KaiTemplate, type KaiTemplateGeneration } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

export default function TemplateDetailPage() {
  const params = useParams();
  const templateId = params.id as string;
  const { lang } = useLang();
  const { user, loading: authLoading } = useAuth();

  const [template, setTemplate] = useState<KaiTemplate | null>(null);
  const [generations, setGenerations] = useState<KaiTemplateGeneration[]>([]);
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const pollTimers = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  const startPolling = (genId: string) => {
    if (pollTimers.current.has(genId)) return;
    const timer = setInterval(async () => {
      const { data } = await supabase
        .from("kai_template_generations")
        .select("*")
        .eq("id", genId)
        .single();
      if (data) {
        setGenerations((prev) => prev.map((g) => (g.id === genId ? data : g)));
        if (data.status === "ready" || data.status === "error") {
          clearInterval(timer);
          pollTimers.current.delete(genId);
        }
      }
    }, 2500);
    pollTimers.current.set(genId, timer);
  };

  useEffect(() => {
    if (user) load();
    const timers = pollTimers.current;
    return () => {
      timers.forEach((tm) => clearInterval(tm));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const load = async () => {
    setLoading(true);
    const [{ data: tpl }, { data: gens }] = await Promise.all([
      supabase.from("kai_templates").select("*").eq("id", templateId).single(),
      supabase.from("kai_template_generations").select("*").eq("template_id", templateId).order("created_at", { ascending: false }),
    ]);
    if (tpl) setTemplate(tpl);
    if (gens) {
      setGenerations(gens);
      gens.forEach((g) => {
        if (g.status === "processing") startPolling(g.id);
      });
    }
    setLoading(false);
  };

  const handleGenerate = async () => {
    if (!instruction.trim() || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch("/api/generate-template", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ template_id: templateId, instruction: instruction.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка запуска генерации");

      setGenerations((prev) => [
        { id: data.generation_id, template_id: templateId, user_id: user!.id, instruction: instruction.trim(), status: "processing", output_storage_path: null, applied_count: null, skipped: null, error_message: null, created_at: new Date().toISOString() },
        ...prev,
      ]);
      startPolling(data.generation_id);
      setInstruction("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка запуска генерации");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = async (generationId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const res = await fetch("/api/download-generation", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ generation_id: generationId }),
    });
    const data = await res.json();
    if (res.ok && data.url) window.open(data.url, "_blank");
  };

  if (authLoading || loading) {
    return <div style={{ minHeight: "100vh", background: "var(--color-background)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-muted)", fontSize: "14px" }}>{t[lang].auth.loading}</div>;
  }

  if (!template) {
    return <div style={{ minHeight: "100vh", background: "var(--color-background)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-muted)", fontSize: "14px" }}>{translate(lang, "Шаблон не найден")}</div>;
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-background)" }}>
      <nav style={{ position: "sticky", top: 0, zIndex: 100, borderBottom: "1px solid var(--color-card-border)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", background: "color-mix(in srgb, var(--color-background) 88%, transparent)" }}>
        <div className="nav-inner">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Link href="/templates" style={{ width: "34px", height: "34px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-card)", border: "1px solid var(--color-card-border)", color: "var(--color-muted)", textDecoration: "none" }}>
              <ArrowLeft size={18} />
            </Link>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "34px", height: "34px", borderRadius: "10px", background: "var(--color-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Brain size={18} color="white" />
              </div>
              <span style={{ fontWeight: 700, fontSize: "16px", color: "var(--color-foreground)" }}>{template.name}</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <LangToggle />
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <main className="page-container" style={{ maxWidth: "720px" }}>
        {template.mode === "placeholder" && template.placeholder_names && template.placeholder_names.length > 0 && (
          <div style={{ marginBottom: "20px", padding: "14px 16px", borderRadius: "12px", background: "var(--color-card)", border: "1px solid var(--color-card-border)" }}>
            <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-muted)", marginBottom: "8px" }}>
              {translate(lang, "Поля в шаблоне:")}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {template.placeholder_names.map((name) => (
                <span key={name} style={{ padding: "4px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: 600, background: "var(--color-primary-light)", color: "var(--color-primary)" }}>{`{{${name}}}`}</span>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginBottom: "24px" }}>
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder={template.mode === "placeholder"
              ? translate(lang, "Например: ФИО — Иванов Иван, Дата — 15.07.2026")
              : translate(lang, "Опишите, что нужно изменить в документе...")}
            rows={4}
            style={{ width: "100%", padding: "14px 16px", borderRadius: "14px", outline: "none", fontSize: "14px", resize: "none", background: "var(--color-card)", border: "1px solid var(--color-card-border)", color: "var(--color-foreground)", boxSizing: "border-box", marginBottom: "10px", fontFamily: "inherit" }}
          />
          {error && (
            <div style={{ marginBottom: "10px", padding: "10px 14px", borderRadius: "10px", background: "#ef444418", border: "1px solid #ef444440", fontSize: "13px", color: "#ef4444" }}>
              {error}
            </div>
          )}
          <button
            onClick={handleGenerate}
            disabled={!instruction.trim() || submitting}
            style={{ display: "flex", alignItems: "center", gap: "8px", padding: "12px 22px", borderRadius: "12px", fontWeight: 600, fontSize: "14px", border: "none", cursor: instruction.trim() ? "pointer" : "default", background: instruction.trim() && !submitting ? "var(--color-primary)" : "var(--color-card-border)", color: "white", opacity: submitting ? 0.7 : 1 }}
          >
            {submitting ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={16} />}
            {translate(lang, "Сгенерировать")}
          </button>
        </div>

        <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-muted)", marginBottom: "12px" }}>
          {translate(lang, "История генераций")}
        </p>

        {generations.length === 0 ? (
          <p style={{ fontSize: "13px", color: "var(--color-muted)" }}>{translate(lang, "Пока ничего не сгенерировано")}</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {generations.map((g) => (
              <div key={g.id} style={{ padding: "14px 16px", borderRadius: "12px", background: "var(--color-card)", border: "1px solid var(--color-card-border)" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                  <p style={{ fontSize: "13px", color: "var(--color-foreground)", flex: 1 }}>{g.instruction}</p>
                  {g.status === "processing" && <Clock size={16} style={{ color: "var(--color-muted)", flexShrink: 0 }} />}
                  {g.status === "ready" && <CheckCircle size={16} style={{ color: "#10b981", flexShrink: 0 }} />}
                  {g.status === "error" && <XCircle size={16} style={{ color: "#ef4444", flexShrink: 0 }} />}
                </div>

                {g.status === "processing" && (
                  <p style={{ fontSize: "12px", color: "var(--color-muted)", marginTop: "8px" }}>{translate(lang, "Готовим документ...")}</p>
                )}

                {g.status === "error" && (
                  <p style={{ fontSize: "12px", color: "#ef4444", marginTop: "8px" }}>{g.error_message || translate(lang, "Ошибка")}</p>
                )}

                {g.status === "ready" && (
                  <div style={{ marginTop: "10px" }}>
                    {g.skipped && g.skipped.length > 0 && (
                      <p style={{ fontSize: "12px", color: "#f59e0b", marginBottom: "8px" }}>
                        {formatSkippedWarning(lang, g.skipped.length)}
                      </p>
                    )}
                    <button
                      onClick={() => handleDownload(g.id)}
                      style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "10px", fontSize: "13px", fontWeight: 600, border: "none", cursor: "pointer", background: "var(--color-primary)", color: "white" }}
                    >
                      <Download size={14} /> {translate(lang, "Скачать PDF")}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
