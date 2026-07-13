"use client";

import { Suspense, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Brain, ArrowLeft, Send, ChevronRight, Sparkles, Copy, FileText, RotateCcw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { ThemeToggle } from "@/components/theme-toggle";
import { LangToggle } from "@/components/lang-toggle";
import { useLang } from "@/context/lang-context";
import { t } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

interface Source { book: string; excerpt: string; page?: number | null; }
interface Message { id: string; role: "user" | "assistant"; content: string; sources?: Source[]; }


function SourceCard({ source }: { source: Source }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderRadius: "10px", overflow: "hidden", background: "var(--color-background)", border: "1px solid var(--color-card-border)" }}>
      <button onClick={() => setOpen(!open)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "none", border: "none", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
          <FileText size={13} style={{ color: "var(--color-primary)", flexShrink: 0 }} />
          <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-foreground)", textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {source.book}
          </span>
          {source.page != null && (
            <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-primary)", background: "var(--color-primary-light)", borderRadius: "6px", padding: "1px 6px", flexShrink: 0 }}>
              стр. {source.page}
            </span>
          )}
        </div>
        <ChevronRight size={13} style={{ color: "var(--color-muted)", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }} />
      </button>
      {open && (
        <div style={{ padding: "0 12px 10px", borderTop: "1px solid var(--color-card-border)" }}>
          <p style={{ fontSize: "12px", color: "var(--color-muted)", marginTop: "8px", lineHeight: 1.5, fontStyle: "italic" }}>«{source.excerpt}»</p>
        </div>
      )}
    </div>
  );
}

function ChatPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { lang } = useLang();
  const TC = t[lang].chat;

  const collection = {
    id: params.id as string,
    emoji: searchParams.get("emoji") || "📚",
    name: searchParams.get("name") || (lang === "uz" ? "Bo'lim" : "Раздел"),
    color: searchParams.get("color") || "#7c3aed",
  };

  const collectionHref = `/collection/${collection.id}?name=${encodeURIComponent(collection.name)}&emoji=${encodeURIComponent(collection.emoji)}&color=${encodeURIComponent(collection.color)}`;

  const makeWelcome = (): Message => ({
    id: "welcome",
    role: "assistant",
    content: TC.welcome(collection.name),
  });

  const [messages, setMessages] = useState<Message[]>([makeWelcome()]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) window.location.href = "/login";
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (question: string) => {
    if (!question.trim() || loading) return;
    const q = question.trim();
    setInput("");
    setMessages((p) => [...p, { id: Date.now().toString(), role: "user", content: q }]);
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ question: q, collection_id: collection.id }),
      });

      const resBody = await res.text();
      console.log("n8n response status:", res.status);
      console.log("n8n response body:", resBody);

      if (!res.ok) {
        throw new Error(resBody || `Ошибка сервера: ${res.status}`);
      }

      let data: { success: boolean; answer: string; sources?: Source[]; chunks_count?: number; message?: string; error?: string };
      try {
        data = JSON.parse(resBody);
      } catch {
        throw new Error("Сервер вернул некорректный ответ");
      }

      if (!data.success) {
        throw new Error(data.message || data.error || "Ошибка AI-чата");
      }

      setMessages((p) => [...p, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.answer,
        sources: data.sources,
      }]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Неизвестная ошибка";
      console.error("Chat error:", err);
      setMessages((p) => [...p, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: lang === "uz" ? `Xatolik: ${msg}` : `Ошибка: ${msg}`,
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "var(--color-background)", overflow: "hidden" }}>

      {/* Навбар */}
      <nav style={{ flexShrink: 0, borderBottom: "1px solid var(--color-card-border)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", background: "color-mix(in srgb, var(--color-background) 88%, transparent)", zIndex: 50 }}>
        <div className="nav-inner">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Link href={collectionHref} style={{ width: "38px", height: "38px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-card)", border: "1px solid var(--color-card-border)", color: "var(--color-muted)", textDecoration: "none", flexShrink: 0, WebkitTapHighlightColor: "transparent" }}>
              <ArrowLeft size={18} />
            </Link>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: `${collection.color}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 }}>
                {collection.emoji}
              </div>
              <div>
                <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--color-foreground)", lineHeight: 1.2 }}>{collection.name}</p>
                <p style={{ fontSize: "11px", color: "var(--color-muted)" }}>{TC.aiLabel}</p>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button onClick={() => setMessages([makeWelcome()])} className="btn-icon" style={{ width: "36px", height: "36px", borderRadius: "10px", background: "var(--color-card)", border: "1px solid var(--color-card-border)", color: "var(--color-muted)" }} title="New chat">
              <RotateCcw size={15} />
            </button>
            <LangToggle />
            <ThemeToggle />
          </div>
        </div>
      </nav>

      {/* Сообщения */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
        {messages.map((msg) => (
          <div key={msg.id}>
            {msg.role === "user" ? (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div style={{ maxWidth: "80%", padding: "12px 16px", borderRadius: "18px", borderBottomRightRadius: "4px", background: "linear-gradient(135deg, #7c3aed, #a855f7)", color: "white", fontSize: "14px", lineHeight: 1.5 }}>
                  {msg.content}
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: "10px" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "10px", background: "var(--color-primary-light)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "2px" }}>
                  <Brain size={16} style={{ color: "var(--color-primary)" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ padding: "12px 16px", borderRadius: "18px", borderTopLeftRadius: "4px", background: "var(--color-card)", border: "1px solid var(--color-card-border)", fontSize: "14px", lineHeight: 1.6, color: "var(--color-foreground)" }} className="md-content">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                  {msg.sources && msg.sources.length > 0 && (
                    <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
                      <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-muted)", marginBottom: "2px" }}>{TC.sources}</p>
                      {msg.sources.map((s, i) => <SourceCard key={i} source={s} />)}
                    </div>
                  )}
                  <button onClick={() => navigator.clipboard?.writeText(msg.content)} className="btn-icon" style={{ marginTop: "6px", padding: "4px 8px", borderRadius: "8px", background: "none", color: "var(--color-muted)", fontSize: "12px", gap: "4px" }}>
                    <Copy size={11} /> {TC.copy}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", gap: "10px" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "10px", background: "var(--color-primary-light)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Brain size={16} style={{ color: "var(--color-primary)" }} />
            </div>
            <div style={{ padding: "14px 16px", borderRadius: "18px", borderTopLeftRadius: "4px", background: "var(--color-card)", border: "1px solid var(--color-card-border)" }}>
              <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{ width: "7px", height: "7px", borderRadius: "50%", background: "var(--color-primary)", animation: `bounce 1s ${i * 0.15}s ease-in-out infinite` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Инпут */}
      <div style={{ flexShrink: 0, padding: "12px 16px", borderTop: "1px solid var(--color-card-border)", background: "var(--color-background)" }}>
        {messages.length <= 1 && (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
            {TC.suggestions.map((s) => (
              <button key={s} onPointerDown={() => send(s)} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 12px", borderRadius: "10px", fontSize: "12px", fontWeight: 600, background: "var(--color-card)", border: "1px solid var(--color-card-border)", color: "var(--color-foreground)", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
                <Sparkles size={11} style={{ color: "var(--color-primary)", flexShrink: 0 }} />
                {s}
              </button>
            ))}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "flex-end", gap: "10px", padding: "10px 14px", borderRadius: "18px", background: "var(--color-card)", border: "1px solid var(--color-card-border)" }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder={TC.placeholder}
            rows={1}
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", resize: "none", fontSize: "15px", lineHeight: 1.5, color: "var(--color-foreground)", maxHeight: "100px", fontFamily: "inherit" }}
          />
          <button
            onPointerDown={() => send(input)}
            disabled={!input.trim() || loading}
            style={{ width: "38px", height: "38px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", background: input.trim() && !loading ? "var(--color-primary)" : "var(--color-card-border)", border: "none", cursor: input.trim() ? "pointer" : "default", flexShrink: 0, WebkitTapHighlightColor: "transparent", transition: "background 0.2s" }}
          >
            <Send size={16} color="white" />
          </button>
        </div>
        <p style={{ fontSize: "11px", textAlign: "center", color: "var(--color-muted)", marginTop: "6px" }}>{TC.hint}</p>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        .md-content p { margin: 0 0 8px 0; }
        .md-content p:last-child { margin-bottom: 0; }
        .md-content strong { font-weight: 700; }
        .md-content em { font-style: italic; }
        .md-content ul, .md-content ol { margin: 6px 0 8px 0; padding-left: 20px; }
        .md-content li { margin-bottom: 4px; }
        .md-content h1, .md-content h2, .md-content h3 { font-weight: 700; margin: 10px 0 6px 0; }
        .md-content h1 { font-size: 16px; }
        .md-content h2 { font-size: 15px; }
        .md-content h3 { font-size: 14px; }
        .md-content code { background: var(--color-card-border); padding: 1px 5px; border-radius: 4px; font-size: 13px; font-family: monospace; }
        .md-content blockquote { border-left: 3px solid var(--color-primary); padding-left: 10px; margin: 6px 0; color: var(--color-muted); font-style: italic; }
      `}</style>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatPageInner />
    </Suspense>
  );
}
