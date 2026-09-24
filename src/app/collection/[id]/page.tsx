"use client";

import { Suspense, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Brain, ArrowLeft, Upload, Trash2, MessageSquare, CheckCircle, XCircle, X, Plus, Loader2, HelpCircle } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { LangToggle } from "@/components/lang-toggle";
import { useLang, type Lang } from "@/context/lang-context";
import { t } from "@/lib/i18n";
import { translate } from "@/lib/translate";
import { supabase, type KaiDocument } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { extractText } from "@/lib/extract-text";
import { useAccessGate } from "@/hooks/useAccessGate";
import { Paywall } from "@/components/paywall";

const ACCEPTED = ".pdf,.docx,.doc,.txt,.md";
const FORMAT_LABELS: Record<string, string> = { pdf: "PDF", docx: "Word", doc: "Word", txt: "TXT", md: "MD" };

function cleanName(name: string) {
  return name.replace(/\.(pdf|docx|doc|txt|epub|md)$/i, "");
}

type Tab = "file" | "text" | "url";

function UploadModal({ onClose, onAdd, T, lang }: {
  onClose: () => void;
  onAdd: (name: string, type: string, size: number, content: string) => Promise<void>;
  T: typeof t["ru"]["collection"]["upload"];
  lang: Lang;
}) {
  const [tab, setTab] = useState<Tab>("file");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [urlTitle, setUrlTitle] = useState("");
  const [dragging, setDragging] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setExtracting(true);
    setExtractError("");
    try {
      const content = await extractText(file);
      if (!content.trim()) {
        setExtractError(translate(lang, "Файл пустой или текст не найден"));
        setExtracting(false);
        return;
      }
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "txt";
      const label = FORMAT_LABELS[ext] || ext.toUpperCase();
      await onAdd(`[${label}] ${cleanName(file.name)}`, ext, file.size, content);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setExtractError(msg || translate(lang, "Ошибка при чтении файла"));
      setExtracting(false);
    }
  };

  const handleUrl = async () => {
    if (!url.trim()) return;
    setExtracting(true);
    setExtractError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/fetch-url", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Не удалось загрузить страницу");
      await onAdd(urlTitle.trim() || data.title || url.trim(), "url", data.content.length, data.content);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setExtractError(msg || translate(lang, "Ошибка при загрузке ссылки"));
      setExtracting(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={extracting ? undefined : onClose} />
      <div style={{ position: "relative", width: "100%", maxWidth: "480px", borderRadius: "24px", background: "var(--color-card)", border: "1px solid var(--color-card-border)", boxShadow: "0 25px 50px rgba(0,0,0,0.5)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 20px 0" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--color-foreground)" }}>{T.title}</h2>
          {!extracting && (
            <button onClick={onClose} className="btn-icon" style={{ width: "32px", height: "32px", borderRadius: "8px", background: "none", color: "var(--color-muted)" }}>
              <X size={18} />
            </button>
          )}
        </div>

        <div style={{ display: "flex", gap: "6px", padding: "16px 20px" }}>
          {(["file", "text", "url"] as Tab[]).map((tb) => (
            <button key={tb} onClick={() => { if (!extracting) setTab(tb); }}
              style={{ flex: 1, padding: "10px", borderRadius: "10px", fontSize: "13px", fontWeight: 600, border: "none", cursor: extracting ? "not-allowed" : "pointer", background: tab === tb ? "var(--color-primary)" : "var(--color-background)", color: tab === tb ? "#fff" : "var(--color-muted)", opacity: extracting ? 0.6 : 1 }}>
              {tb === "file" ? T.file : tb === "text" ? T.text : T.url}
            </button>
          ))}
        </div>

        <div style={{ padding: "0 20px 20px" }}>
          {tab === "file" && (
            <div>
              {extracting ? (
                <div style={{ border: "2px dashed var(--color-card-border)", borderRadius: "16px", padding: "40px 20px", textAlign: "center", background: "var(--color-background)" }}>
                  <Loader2 size={36} style={{ color: "var(--color-primary)", margin: "0 auto 14px", animation: "spin 1s linear infinite" }} />
                  <p style={{ fontWeight: 600, color: "var(--color-foreground)", marginBottom: "4px" }}>
                    {translate(lang, "Извлекаем текст...")}
                  </p>
                  <p style={{ fontSize: "13px", color: "var(--color-muted)" }}>
                    {translate(lang, "Подождите немного")}
                  </p>
                </div>
              ) : (
                <div style={{ border: `2px dashed ${dragging ? "var(--color-primary)" : "var(--color-card-border)"}`, borderRadius: "16px", padding: "32px 20px", textAlign: "center", cursor: "pointer", background: dragging ? "var(--color-primary-light)" : "var(--color-background)", transition: "all 0.2s" }}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                  onClick={() => fileRef.current?.click()}
                >
                  <input ref={fileRef} type="file" accept={ACCEPTED} style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                  <div style={{ width: "56px", height: "56px", borderRadius: "16px", background: "var(--color-primary-light)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                    <Upload size={24} style={{ color: "var(--color-primary)" }} />
                  </div>
                  <p style={{ fontWeight: 600, color: "var(--color-foreground)", marginBottom: "6px" }}>{T.dropHere}</p>
                  <p style={{ fontSize: "13px", color: "var(--color-muted)", marginBottom: "10px" }}>{T.clickToSelect}</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", justifyContent: "center" }}>
                    {["PDF", "DOCX", "TXT"].map((f) => (
                      <span key={f} style={{ padding: "3px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, background: "var(--color-primary-light)", color: "var(--color-primary)" }}>{f}</span>
                    ))}
                  </div>
                </div>
              )}
              {extractError && (
                <div style={{ marginTop: "10px", padding: "10px 14px", borderRadius: "10px", background: "#ef444418", border: "1px solid #ef444440", fontSize: "13px", color: "#ef4444" }}>
                  {extractError}
                </div>
              )}
              <p style={{ fontSize: "11px", color: "var(--color-muted)", textAlign: "center", marginTop: "8px" }}>{T.maxSize}</p>
            </div>
          )}

          {tab === "text" && (
            <div>
              <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={T.textPlaceholder} rows={8}
                style={{ width: "100%", padding: "12px", borderRadius: "12px", outline: "none", fontSize: "14px", resize: "none", background: "var(--color-background)", border: "1px solid var(--color-card-border)", color: "var(--color-foreground)", boxSizing: "border-box", marginBottom: "8px" }} />
              <p style={{ fontSize: "12px", color: "var(--color-muted)", marginBottom: "14px" }}>{text.length} {T.chars}</p>
              <button disabled={!text.trim()} onClick={async () => {
                if (!text.trim()) return;
                await onAdd(text.slice(0, 60) + "...", "text", text.length, text);
                onClose();
              }}
                style={{ width: "100%", padding: "12px", borderRadius: "12px", fontWeight: 600, fontSize: "14px", border: "none", cursor: "pointer", background: "var(--color-primary)", color: "white", opacity: text.trim() ? 1 : 0.4 }}>
                {T.addText}
              </button>
            </div>
          )}

          {tab === "url" && (
            extracting ? (
              <div style={{ border: "2px dashed var(--color-card-border)", borderRadius: "16px", padding: "40px 20px", textAlign: "center", background: "var(--color-background)" }}>
                <Loader2 size={36} style={{ color: "var(--color-primary)", margin: "0 auto 14px", animation: "spin 1s linear infinite" }} />
                <p style={{ fontWeight: 600, color: "var(--color-foreground)", marginBottom: "4px" }}>
                  {translate(lang, "Загружаем страницу...")}
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={T.urlPlaceholder}
                  style={{ width: "100%", padding: "12px 16px", borderRadius: "12px", outline: "none", fontSize: "14px", background: "var(--color-background)", border: "1px solid var(--color-card-border)", color: "var(--color-foreground)", boxSizing: "border-box" }} />
                <input value={urlTitle} onChange={(e) => setUrlTitle(e.target.value)} placeholder={T.titlePlaceholder}
                  style={{ width: "100%", padding: "12px 16px", borderRadius: "12px", outline: "none", fontSize: "14px", background: "var(--color-background)", border: "1px solid var(--color-card-border)", color: "var(--color-foreground)", boxSizing: "border-box" }} />
                <button disabled={!url.trim()} onClick={handleUrl}
                  style={{ width: "100%", padding: "12px", borderRadius: "12px", fontWeight: 600, fontSize: "14px", border: "none", cursor: "pointer", background: "var(--color-primary)", color: "white", opacity: url.trim() ? 1 : 0.4 }}>
                  {T.loadUrl}
                </button>
                {extractError && (
                  <div style={{ padding: "10px 14px", borderRadius: "10px", background: "#ef444418", border: "1px solid #ef444440", fontSize: "13px", color: "#ef4444" }}>
                    {extractError}
                  </div>
                )}
              </div>
            )
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function typeIcon(type: string | null) {
  if (type === "text") return "📝";
  if (type === "url") return "🔗";
  return "📄";
}

function formatSize(size: number | null, type: string | null) {
  if (!size) return "—";
  if (type === "text") return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function StatusIcon({ status }: { status: KaiDocument["status"] }) {
  if (status === "ready") return <CheckCircle size={18} color="#10b981" />;
  if (status === "error") return <XCircle size={18} color="#ef4444" />;
  return <Loader2 size={18} style={{ color: "#f59e0b", animation: "spin 1s linear infinite" }} />;
}

function TestConfigModal({ onClose, onGenerate, generating, error, lang }: {
  onClose: () => void;
  onGenerate: (format: "multiple_choice" | "open_ended", count: number) => void;
  generating: boolean;
  error: string;
  lang: Lang;
}) {
  const [format, setFormat] = useState<"multiple_choice" | "open_ended">("multiple_choice");
  const [count, setCount] = useState(5);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={generating ? undefined : onClose} />
      <div style={{ position: "relative", width: "100%", maxWidth: "400px", borderRadius: "24px", padding: "24px", background: "var(--color-card)", border: "1px solid var(--color-card-border)", boxShadow: "0 25px 50px rgba(0,0,0,0.5)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--color-foreground)" }}>{translate(lang, "Создать тест")}</h2>
          {!generating && (
            <button onClick={onClose} style={{ color: "var(--color-muted)", background: "none", border: "none", cursor: "pointer" }}><X size={20} /></button>
          )}
        </div>

        {generating ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <Loader2 size={32} style={{ color: "var(--color-primary)", margin: "0 auto 14px", animation: "spin 1s linear infinite" }} />
            <p style={{ fontSize: "14px", color: "var(--color-foreground)", fontWeight: 600 }}>{translate(lang, "Готовим вопросы...")}</p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-muted)", marginBottom: "10px" }}>{translate(lang, "Формат")}</p>
            <div style={{ display: "flex", gap: "8px", marginBottom: "18px" }}>
              {(["multiple_choice", "open_ended"] as const).map((f) => (
                <button key={f} onClick={() => setFormat(f)}
                  style={{ flex: 1, padding: "12px 10px", borderRadius: "12px", fontSize: "13px", fontWeight: 600, border: `2px solid ${format === f ? "var(--color-primary)" : "transparent"}`, cursor: "pointer", background: format === f ? "var(--color-primary-light)" : "var(--color-background)", color: "var(--color-foreground)" }}>
                  {f === "multiple_choice" ? translate(lang, "С вариантами") : translate(lang, "Открытые вопросы")}
                </button>
              ))}
            </div>

            <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-muted)", marginBottom: "10px" }}>{translate(lang, "Количество вопросов")}</p>
            <div style={{ display: "flex", gap: "8px", marginBottom: "22px" }}>
              {[5, 10, 15].map((n) => (
                <button key={n} onClick={() => setCount(n)}
                  style={{ flex: 1, padding: "10px", borderRadius: "12px", fontSize: "13px", fontWeight: 600, border: `2px solid ${count === n ? "var(--color-primary)" : "transparent"}`, cursor: "pointer", background: count === n ? "var(--color-primary-light)" : "var(--color-background)", color: "var(--color-foreground)" }}>
                  {n}
                </button>
              ))}
            </div>

            {error && (
              <div style={{ marginBottom: "16px", padding: "10px 14px", borderRadius: "10px", background: "#ef444418", border: "1px solid #ef444440", fontSize: "13px", color: "#ef4444" }}>
                {error}
              </div>
            )}

            <button onClick={() => onGenerate(format, count)}
              style={{ width: "100%", padding: "13px", borderRadius: "12px", fontWeight: 700, fontSize: "15px", border: "none", cursor: "pointer", background: "var(--color-primary)", color: "white" }}>
              {translate(lang, "Сгенерировать")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function statusLabel(status: KaiDocument["status"], lang: Lang) {
  if (status === "ready") return translate(lang, "Готово");
  if (status === "error") return translate(lang, "Ошибка");
  return translate(lang, "Обрабатывается...");
}

function CollectionPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { lang } = useLang();
  const T = t[lang].collection;
  const { user } = useAuth();

  const collection = {
    id: params.id as string,
    emoji: searchParams.get("emoji") || "📚",
    name: searchParams.get("name") || translate(lang, "Раздел"),
    description: searchParams.get("desc") || "",
    color: searchParams.get("color") || "#7c3aed",
  };

  const [docs, setDocs] = useState<KaiDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [testDocId, setTestDocId] = useState<string | null>(null);
  const [testGenerating, setTestGenerating] = useState(false);
  const [testError, setTestError] = useState("");
  const pollTimers = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const { loading: gateLoading, hasAccess } = useAccessGate(user);

  useEffect(() => {
    loadDocs();
    return () => {
      pollTimers.current.forEach((t) => clearInterval(t));
    };
  }, [collection.id]);

  const loadDocs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("kai_documents")
      .select("*")
      .eq("collection_id", collection.id)
      .order("created_at", { ascending: false });
    if (data) {
      setDocs(data);
      data.forEach((d: KaiDocument) => {
        if (d.status === "uploaded" || d.status === "processing") startPolling(d.id);
      });
    }
    setLoading(false);
  };

  const startPolling = (docId: string) => {
    if (pollTimers.current.has(docId)) return;
    const timer = setInterval(async () => {
      const { data } = await supabase
        .from("kai_documents")
        .select("status, error_message, processed_at")
        .eq("id", docId)
        .single();
      if (data) {
        setDocs((prev) => prev.map((d) => d.id === docId ? { ...d, ...data } : d));
        if (data.status === "ready" || data.status === "error") {
          clearInterval(timer);
          pollTimers.current.delete(docId);
        }
      }
    }, 2500);
    pollTimers.current.set(docId, timer);
  };

  const handleAdd = async (name: string, type: string, size: number, content: string) => {
    if (!user) return;

    const { data: doc, error } = await supabase
      .from("kai_documents")
      .insert({
        user_id: user.id,
        collection_id: collection.id,
        name,
        type,
        size,
        status: "uploaded",
      })
      .select()
      .single();

    if (error || !doc) return;

    // Save content directly to Supabase to avoid API body size limits
    const { error: contentErr } = await supabase.from("kai_documents").update({ content }).eq("id", doc.id);
    if (contentErr) console.error("Failed to save content to Supabase:", contentErr.message);

    setDocs((prev) => [doc, ...prev]);
    startPolling(doc.id);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/process-document", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({
          document_id: doc.id,
          collection_id: collection.id,
          document_name: name,
          type,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        console.error("process-document failed:", res.status, errText);
        throw new Error(`Webhook ${res.status}: ${errText}`);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Ошибка отправки в обработку";
      console.error("handleAdd error:", errMsg);
      await supabase
        .from("kai_documents")
        .update({ status: "error", error_message: errMsg })
        .eq("id", doc.id);
      setDocs((prev) => prev.map((d) => d.id === doc.id ? { ...d, status: "error", error_message: "Ошибка отправки в обработку" } : d));
      clearInterval(pollTimers.current.get(doc.id));
      pollTimers.current.delete(doc.id);
    }
  };

  const handleDelete = async (id: string) => {
    clearInterval(pollTimers.current.get(id));
    pollTimers.current.delete(id);
    await supabase.from("kai_documents").delete().eq("id", id);
    setDocs((prev) => prev.filter((d) => d.id !== id));
    setDeleteId(null);
  };

  const handleGenerateTest = async (format: "multiple_choice" | "open_ended", count: number) => {
    if (!testDocId) return;
    setTestGenerating(true);
    setTestError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/generate-test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ collection_id: collection.id, document_id: testDocId, format, question_count: count, lang }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `Ошибка сервера: ${res.status}`);
      router.push(`/collection/${collection.id}/test/${body.test_id}?name=${encodeURIComponent(collection.name)}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Неизвестная ошибка";
      setTestError(msg);
      setTestGenerating(false);
    }
  };

  const chatHref = `/collection/${collection.id}/chat?name=${encodeURIComponent(collection.name)}&emoji=${encodeURIComponent(collection.emoji)}&color=${encodeURIComponent(collection.color)}`;

  if (gateLoading) {
    return <div style={{ minHeight: "100vh", background: "var(--color-background)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-muted)", fontSize: "14px" }}>{translate(lang, "Загрузка...")}</div>;
  }

  if (!hasAccess) {
    return <Paywall />;
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-background)" }}>
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onAdd={handleAdd}
          T={T.upload}
          lang={lang}
        />
      )}

      {testDocId && (
        <TestConfigModal
          onClose={() => { setTestDocId(null); setTestError(""); }}
          onGenerate={handleGenerateTest}
          generating={testGenerating}
          error={testError}
          lang={lang}
        />
      )}

      {deleteId && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={() => setDeleteId(null)} />
          <div style={{ position: "relative", width: "100%", maxWidth: "340px", borderRadius: "24px", padding: "28px", textAlign: "center", background: "var(--color-card)", border: "1px solid var(--color-card-border)", boxShadow: "0 25px 50px rgba(0,0,0,0.5)" }}>
            <div style={{ width: "56px", height: "56px", borderRadius: "16px", background: "#ef444422", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Trash2 size={24} color="#ef4444" />
            </div>
            <p style={{ fontSize: "18px", fontWeight: 700, color: "var(--color-foreground)", marginBottom: "8px" }}>{T.deleteTitle}</p>
            <p style={{ fontSize: "14px", color: "var(--color-muted)", marginBottom: "24px" }}>{T.deleteDesc}</p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setDeleteId(null)} style={{ flex: 1, padding: "12px", borderRadius: "12px", fontWeight: 600, fontSize: "14px", cursor: "pointer", background: "var(--color-background)", border: "1px solid var(--color-card-border)", color: "var(--color-foreground)" }}>{T.cancel}</button>
              <button onClick={() => handleDelete(deleteId)} style={{ flex: 1, padding: "12px", borderRadius: "12px", fontWeight: 600, fontSize: "14px", cursor: "pointer", background: "#ef4444", color: "white", border: "none" }}>{T.delete}</button>
            </div>
          </div>
        </div>
      )}

      <nav style={{ position: "sticky", top: 0, zIndex: 100, borderBottom: "1px solid var(--color-card-border)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", background: "color-mix(in srgb, var(--color-background) 88%, transparent)" }}>
        <div className="nav-inner">
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Link href="/dashboard" style={{ width: "38px", height: "38px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-card)", border: "1px solid var(--color-card-border)", color: "var(--color-muted)", textDecoration: "none", flexShrink: 0 }}>
              <ArrowLeft size={18} />
            </Link>
            <div style={{ width: "30px", height: "30px", borderRadius: "8px", background: "var(--color-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Brain size={14} color="white" />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <LangToggle />
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <main className="page-container">
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", marginBottom: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{ width: "60px", height: "60px", borderRadius: "18px", background: `${collection.color}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", flexShrink: 0 }}>
              {collection.emoji}
            </div>
            <div>
              <h1 style={{ fontSize: "22px", fontWeight: 800, color: "var(--color-foreground)", marginBottom: "2px" }}>{collection.name}</h1>
              {collection.description && <p style={{ fontSize: "13px", color: "var(--color-muted)" }}>{collection.description}</p>}
            </div>
          </div>
          <Link href={chatHref} style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "12px 20px", borderRadius: "12px", background: collection.color, color: "white", fontWeight: 600, fontSize: "14px", textDecoration: "none", flexShrink: 0 }}>
            <MessageSquare size={16} /> {T.openChat}
          </Link>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "28px" }}>
          {T.stats.map((label, i) => {
            const value = i === 0 ? docs.length
              : i === 1 ? docs.filter(d => d.status === "ready").length
              : docs.filter(d => d.status === "uploaded" || d.status === "processing").length;
            return (
              <div key={label} style={{ borderRadius: "14px", padding: "16px", textAlign: "center", background: "var(--color-card)", border: "1px solid var(--color-card-border)" }}>
                <p style={{ fontSize: "24px", fontWeight: 800, color: "var(--color-foreground)" }}>{value}</p>
                <p style={{ fontSize: "12px", color: "var(--color-muted)", marginTop: "2px" }}>{label}</p>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--color-foreground)" }}>{T.materials}</h2>
          <button onPointerDown={(e) => { e.preventDefault(); setShowUpload(true); }}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 16px", borderRadius: "10px", background: "var(--color-primary)", color: "white", fontWeight: 600, fontSize: "13px", border: "none", cursor: "pointer", touchAction: "manipulation" }}>
            <Plus size={15} /> {T.add}
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--color-muted)", fontSize: "14px" }}>
            {translate(lang, "Загрузка...")}
          </div>
        ) : docs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <p style={{ fontSize: "40px", marginBottom: "12px" }}>📂</p>
            <p style={{ fontSize: "16px", fontWeight: 600, color: "var(--color-foreground)", marginBottom: "6px" }}>{T.empty.title}</p>
            <p style={{ fontSize: "14px", color: "var(--color-muted)", marginBottom: "20px" }}>{T.empty.sub}</p>
            <button onPointerDown={(e) => { e.preventDefault(); setShowUpload(true); }}
              style={{ padding: "10px 20px", borderRadius: "10px", background: "var(--color-primary)", color: "white", fontWeight: 600, fontSize: "14px", border: "none", cursor: "pointer", touchAction: "manipulation" }}>
              {T.empty.btn}
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {docs.map((doc) => (
              <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px", borderRadius: "16px", background: "var(--color-card)", border: `1px solid ${doc.status === "error" ? "#ef444440" : "var(--color-card-border)"}` }}>
                <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "var(--color-background)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", flexShrink: 0 }}>
                  {typeIcon(doc.type)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: "14px", color: "var(--color-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{doc.name}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "3px" }}>
                    <p style={{ fontSize: "12px", color: "var(--color-muted)" }}>
                      {formatSize(doc.size, doc.type)} · {new Date(doc.created_at).toLocaleDateString()}
                    </p>
                    <span style={{ fontSize: "11px", fontWeight: 600, color: doc.status === "ready" ? "#10b981" : doc.status === "error" ? "#ef4444" : "#f59e0b" }}>
                      {statusLabel(doc.status, lang)}
                    </span>
                  </div>
                  {doc.status === "error" && doc.error_message && (
                    <p style={{ fontSize: "11px", color: "#ef4444", marginTop: "2px" }}>{doc.error_message}</p>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                  <StatusIcon status={doc.status} />
                  {doc.status === "ready" && (
                    <button onClick={() => setTestDocId(doc.id)} className="btn-icon" title={translate(lang, "Тест")} style={{ width: "34px", height: "34px", borderRadius: "8px", background: "none", color: "var(--color-muted)" }}>
                      <HelpCircle size={15} />
                    </button>
                  )}
                  <button onClick={() => setDeleteId(doc.id)} className="btn-icon" style={{ width: "34px", height: "34px", borderRadius: "8px", background: "none", color: "var(--color-muted)" }}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {docs.length > 0 && (
          <button onPointerDown={(e) => { e.preventDefault(); setShowUpload(true); }}
            style={{ marginTop: "16px", width: "100%", borderRadius: "16px", padding: "24px", textAlign: "center", border: "2px dashed var(--color-card-border)", cursor: "pointer", touchAction: "manipulation", background: "transparent" }}>
            <Upload size={20} style={{ color: "var(--color-muted)", margin: "0 auto 8px" }} />
            <p style={{ fontSize: "13px", color: "var(--color-muted)" }}>{T.uploadZone}</p>
          </button>
        )}
      </main>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function CollectionPage() {
  return (
    <Suspense fallback={null}>
      <CollectionPageInner />
    </Suspense>
  );
}
