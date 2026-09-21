"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Brain, Plus, Trash2, Loader2, FileText, ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { LangToggle } from "@/components/lang-toggle";
import { useLang } from "@/context/lang-context";
import { t } from "@/lib/i18n";
import { translate } from "@/lib/translate";
import { supabase, type KaiTemplate } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { extractText } from "@/lib/extract-text";
import { detectPlaceholders } from "@/lib/detect-placeholders";
import { useAccessGate } from "@/hooks/useAccessGate";
import { Paywall } from "@/components/paywall";

export default function TemplatesPage() {
  const { lang } = useLang();
  const { user, loading: authLoading, signOut } = useAuth();
  const { loading: gateLoading, hasAccess } = useAccessGate(user);

  const [templates, setTemplates] = useState<KaiTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("kai_templates")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (data) setTemplates(data);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (file: File) => {
    if (!user) return;
    if (!file.name.toLowerCase().endsWith(".docx")) {
      setUploadError(translate(lang, "Пока поддерживаются только файлы .docx"));
      return;
    }

    setUploading(true);
    setUploadError("");
    try {
      const text = await extractText(file);
      const placeholders = detectPlaceholders(text);
      const mode = placeholders.length > 0 ? "placeholder" : "freeform";
      const id = crypto.randomUUID();
      const storagePath = `${user.id}/${id}/original.docx`;

      const { error: upErr } = await supabase.storage.from("templates").upload(storagePath, file, {
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      if (upErr) throw new Error(upErr.message);

      const { data, error: insErr } = await supabase
        .from("kai_templates")
        .insert({
          id,
          user_id: user.id,
          name: file.name.replace(/\.docx$/i, ""),
          original_filename: file.name,
          storage_path: storagePath,
          mode,
          placeholder_names: placeholders.length > 0 ? placeholders : null,
        })
        .select()
        .single();
      if (insErr || !data) throw new Error(insErr?.message || "Insert failed");

      setTemplates((prev) => [data, ...prev]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : translate(lang, "Ошибка загрузки шаблона"));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("kai_templates").delete().eq("id", id);
    setTemplates((prev) => prev.filter((tpl) => tpl.id !== id));
    setDeleteId(null);
  };

  if (authLoading || gateLoading) {
    return <div style={{ minHeight: "100vh", background: "var(--color-background)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-muted)", fontSize: "14px" }}>{t[lang].auth.loading}</div>;
  }

  if (!hasAccess) {
    return <Paywall />;
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-background)" }}>
      {deleteId && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={() => setDeleteId(null)} />
          <div style={{ position: "relative", width: "100%", maxWidth: "340px", borderRadius: "24px", padding: "28px", textAlign: "center", background: "var(--color-card)", border: "1px solid var(--color-card-border)", boxShadow: "0 25px 50px rgba(0,0,0,0.5)" }}>
            <div style={{ width: "56px", height: "56px", borderRadius: "16px", background: "#ef444422", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Trash2 size={24} color="#ef4444" />
            </div>
            <p style={{ fontSize: "18px", fontWeight: 700, color: "var(--color-foreground)", marginBottom: "8px" }}>{translate(lang, "Удалить шаблон?")}</p>
            <p style={{ fontSize: "14px", color: "var(--color-muted)", marginBottom: "24px" }}>{translate(lang, "Это действие нельзя отменить")}</p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setDeleteId(null)} style={{ flex: 1, padding: "12px", borderRadius: "12px", fontWeight: 600, fontSize: "14px", cursor: "pointer", background: "var(--color-background)", border: "1px solid var(--color-card-border)", color: "var(--color-foreground)" }}>{translate(lang, "Отмена")}</button>
              <button onClick={() => handleDelete(deleteId)} style={{ flex: 1, padding: "12px", borderRadius: "12px", fontWeight: 600, fontSize: "14px", cursor: "pointer", background: "#ef4444", color: "white", border: "none" }}>{translate(lang, "Удалить")}</button>
            </div>
          </div>
        </div>
      )}

      <nav style={{ position: "sticky", top: 0, zIndex: 100, borderBottom: "1px solid var(--color-card-border)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", background: "color-mix(in srgb, var(--color-background) 88%, transparent)" }}>
        <div className="nav-inner">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Link href="/dashboard" style={{ width: "34px", height: "34px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-card)", border: "1px solid var(--color-card-border)", color: "var(--color-muted)", textDecoration: "none" }}>
              <ArrowLeft size={18} />
            </Link>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "34px", height: "34px", borderRadius: "10px", background: "var(--color-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Brain size={18} color="white" />
              </div>
              <span style={{ fontWeight: 700, fontSize: "18px", color: "var(--color-foreground)" }}>{translate(lang, "Шаблоны")}</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <LangToggle />
            <ThemeToggle />
            <button onClick={signOut} style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-muted)", background: "none", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: "8px" }}>
              {t[lang].nav.logout}
            </button>
          </div>
        </div>
      </nav>

      <main className="page-container">
        <div style={{ marginBottom: "24px" }}>
          <h1 style={{ fontSize: "clamp(22px, 4vw, 28px)", fontWeight: 800, color: "var(--color-foreground)", marginBottom: "4px" }}>
            {translate(lang, "Документы и шаблоны")}
          </h1>
          <p style={{ color: "var(--color-muted)", fontSize: "14px" }}>
            {translate(lang, "Загрузите Word-шаблон, опишите что вставить — получите готовый PDF")}
          </p>
        </div>

        {uploading ? (
          <div style={{ border: "2px dashed var(--color-card-border)", borderRadius: "16px", padding: "40px 20px", textAlign: "center", background: "var(--color-card)", marginBottom: "24px" }}>
            <Loader2 size={32} style={{ color: "var(--color-primary)", margin: "0 auto 12px", animation: "spin 1s linear infinite" }} />
            <p style={{ fontWeight: 600, color: "var(--color-foreground)" }}>{translate(lang, "Загружаем и анализируем...")}</p>
          </div>
        ) : (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleUpload(f); }}
            onClick={() => fileRef.current?.click()}
            style={{ border: `2px dashed ${dragging ? "var(--color-primary)" : "var(--color-card-border)"}`, borderRadius: "16px", padding: "32px 20px", textAlign: "center", cursor: "pointer", background: dragging ? "var(--color-primary-light)" : "var(--color-card)", marginBottom: "24px", transition: "all 0.2s" }}
          >
            <input ref={fileRef} type="file" accept=".docx" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
            <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "var(--color-primary-light)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
              <Plus size={22} style={{ color: "var(--color-primary)" }} />
            </div>
            <p style={{ fontWeight: 600, color: "var(--color-foreground)", marginBottom: "4px" }}>
              {translate(lang, "Перетащите Word-шаблон (.docx) сюда или нажмите")}
            </p>
            <p style={{ fontSize: "13px", color: "var(--color-muted)" }}>
              {translate(lang, "Пока поддерживается только .docx")}
            </p>
          </div>
        )}

        {uploadError && (
          <div style={{ marginBottom: "24px", padding: "12px 16px", borderRadius: "10px", background: "#ef444418", border: "1px solid #ef444440", fontSize: "13px", color: "#ef4444" }}>
            {uploadError}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--color-muted)", fontSize: "14px" }}>
            {translate(lang, "Загрузка...")}
          </div>
        ) : templates.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <p style={{ fontSize: "48px", marginBottom: "16px" }}>📄</p>
            <p style={{ fontSize: "16px", fontWeight: 600, color: "var(--color-foreground)" }}>
              {translate(lang, "Шаблонов пока нет")}
            </p>
          </div>
        ) : (
          <div className="grid-collections">
            {templates.map((tpl) => (
              <Link key={tpl.id} href={`/templates/${tpl.id}`} className="card-lift" style={{ borderRadius: "20px", padding: "20px", background: "var(--color-card)", border: "1px solid var(--color-card-border)", textDecoration: "none", display: "block", position: "relative" }}>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteId(tpl.id); }}
                  style={{ position: "absolute", top: "16px", right: "16px", width: "30px", height: "30px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", color: "var(--color-muted)" }}
                >
                  <Trash2 size={15} />
                </button>
                <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "var(--color-primary-light)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "14px" }}>
                  <FileText size={22} style={{ color: "var(--color-primary)" }} />
                </div>
                <h3 style={{ fontWeight: 700, fontSize: "15px", color: "var(--color-foreground)", marginBottom: "6px", paddingRight: "24px" }}>{tpl.name}</h3>
                <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, background: "var(--color-primary-light)", color: "var(--color-primary)" }}>
                  {tpl.mode === "placeholder" ? translate(lang, "С плейсхолдерами") : translate(lang, "Свободный текст")}
                </span>
              </Link>
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
