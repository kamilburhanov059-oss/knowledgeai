"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Search, MoreVertical, MessageSquare, BookOpen, Trash2, X, TrendingUp, FileText, Sparkles } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { LangToggle } from "@/components/lang-toggle";
import { OnboardingTutorial } from "@/components/onboarding-tutorial";
import { Paywall } from "@/components/paywall";
import { useLang } from "@/context/lang-context";
import { t } from "@/lib/i18n";
import { translate } from "@/lib/translate";
import { supabase, type KaiCollection } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { isSubscriptionActive } from "@/lib/limits";
import { useIsTwa } from "@/hooks/useIsTwa";
import { useAccessGate } from "@/hooks/useAccessGate";
import { AppLogo } from "@/components/app-logo";

const EMOJIS = ["📚", "📐", "⚖️", "🧬", "💻", "🎭", "🌍", "🔬", "📊", "🏛️", "🧠", "✈️"];

function CreateModal({ onClose, onCreate, T }: {
  onClose: () => void;
  onCreate: (name: string, emoji: string, desc: string) => void;
  T: typeof t["ru"]["dashboard"]["create"];
}) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("📚");
  const [desc, setDesc] = useState("");

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={onClose} />
      <div style={{ position: "relative", width: "100%", maxWidth: "440px", borderRadius: "24px", padding: "28px", background: "var(--color-card)", border: "1px solid var(--color-card-border)", boxShadow: "0 25px 50px rgba(0,0,0,0.5)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 700, color: "var(--color-foreground)" }}>{T.title}</h2>
          <button onClick={onClose} style={{ color: "var(--color-muted)", background: "none", border: "none", cursor: "pointer" }}><X size={20} /></button>
        </div>

        <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-muted)", marginBottom: "10px" }}>{T.iconLabel}</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "8px", marginBottom: "20px" }}>
          {EMOJIS.map((e) => (
            <button key={e} onClick={() => setEmoji(e)} style={{ width: "40px", height: "40px", borderRadius: "10px", fontSize: "20px", display: "flex", alignItems: "center", justifyContent: "center", background: emoji === e ? "var(--color-primary-light)" : "var(--color-background)", border: `2px solid ${emoji === e ? "var(--color-primary)" : "transparent"}`, cursor: "pointer" }}>{e}</button>
          ))}
        </div>

        <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: "8px" }}>{T.nameLabel}</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={T.namePlaceholder}
          style={{ width: "100%", padding: "12px 16px", borderRadius: "12px", outline: "none", fontSize: "14px", background: "var(--color-background)", border: "1px solid var(--color-card-border)", color: "var(--color-foreground)", marginBottom: "16px", boxSizing: "border-box" }} />

        <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: "8px" }}>{T.descLabel}</label>
        <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={T.descPlaceholder}
          style={{ width: "100%", padding: "12px 16px", borderRadius: "12px", outline: "none", fontSize: "14px", background: "var(--color-background)", border: "1px solid var(--color-card-border)", color: "var(--color-foreground)", marginBottom: "24px", boxSizing: "border-box" }} />

        <div style={{ display: "flex", gap: "12px" }}>
          <button onClick={onClose} style={{ flex: 1, padding: "12px", borderRadius: "12px", fontWeight: 600, fontSize: "14px", cursor: "pointer", background: "var(--color-background)", border: "1px solid var(--color-card-border)", color: "var(--color-foreground)" }}>{T.cancel}</button>
          <button onClick={() => { if (name.trim()) { onCreate(name.trim(), emoji, desc.trim()); onClose(); } }} disabled={!name.trim()}
            style={{ flex: 1, padding: "12px", borderRadius: "12px", fontWeight: 600, fontSize: "14px", cursor: "pointer", background: "var(--color-primary)", color: "white", border: "none", opacity: name.trim() ? 1 : 0.4 }}>{T.create}</button>
        </div>
      </div>
    </div>
  );
}

const COLORS = ["#7c3aed", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444"];

export default function DashboardPage() {
  const { lang } = useLang();
  const T = t[lang].dashboard;
  const { user, loading: authLoading, signOut } = useAuth();

  const [collections, setCollections] = useState<KaiCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const isTwa = useIsTwa();
  const { loading: gateLoading, hasAccess } = useAccessGate(user);

  useEffect(() => {
    if (user) loadCollections();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    isSubscriptionActive(user.id).then((active) => {
      setIsPremium(active);
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (typeof window !== "undefined" && window.localStorage.getItem("kai_geo_tracked") === user.id) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      fetch("/api/track-geo", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } })
        .then(() => window.localStorage.setItem("kai_geo_tracked", user.id))
        .catch(() => {});
    });
  }, [user]);

  useEffect(() => {
    if (user && !user.user_metadata?.onboarded) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowOnboarding(true);
    }
  }, [user]);

  const handleOnboardingDone = async () => {
    setShowOnboarding(false);
    await supabase.auth.updateUser({ data: { onboarded: true } });
  };

  const withTimeout = <T,>(promise: PromiseLike<T>, ms: number): Promise<T> =>
    Promise.race([
      Promise.resolve(promise),
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)),
    ]);

  const loadCollections = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const { data, error } = await withTimeout(
        supabase
          .from("kai_collections")
          .select("*")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false }),
        15000
      );
      if (error) throw error;
      if (data) setCollections(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("loadCollections failed:", err);
      setLoadError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (name: string, emoji: string, desc: string) => {
    if (!user) return;
    setLoadError("");
    try {
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      const { data, error } = await withTimeout(
        supabase
          .from("kai_collections")
          .insert({ user_id: user.id, name, emoji, color, description: desc || "" })
          .select()
          .single(),
        15000
      );
      if (error) throw error;
      if (data) setCollections((prev) => [data, ...prev]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("handleCreate failed:", err);
      setLoadError(msg);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("kai_collections").delete().eq("id", id);
    setCollections((prev) => prev.filter((c) => c.id !== id));
    setMenuOpen(null);
  };

  const filtered = collections.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  const statIcons = [BookOpen, BookOpen, MessageSquare, TrendingUp];
  const statColors = ["#7c3aed", "#0ea5e9", "#10b981", "#f59e0b"];
  const statValues = [collections.length, 0, 0, 0];

  if (authLoading || gateLoading) {
    return <div style={{ minHeight: "100vh", background: "var(--color-background)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-muted)", fontSize: "14px" }}>{t[lang].auth.loading}</div>;
  }

  if (!hasAccess) {
    return <Paywall />;
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-background)" }}>
      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreate={handleCreate} T={T.create} />}
      {showOnboarding && <OnboardingTutorial onDone={handleOnboardingDone} />}

      <nav style={{ position: "sticky", top: 0, zIndex: 100, borderBottom: "1px solid var(--color-card-border)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", background: "color-mix(in srgb, var(--color-background) 88%, transparent)" }}>
        <div className="nav-inner">
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none" }}>
            <AppLogo size={34} radius={10} />
            <span style={{ fontWeight: 700, fontSize: "18px", color: "var(--color-foreground)" }}>KnowledgeAI</span>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Link href="/templates" style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "10px", fontSize: "13px", fontWeight: 600, textDecoration: "none", background: "var(--color-card)", border: "1px solid var(--color-card-border)", color: "var(--color-foreground)" }}>
              <FileText size={14} /> <span className="hide-mobile">{translate(lang, "Шаблоны")}</span>
            </Link>
            {!isTwa && (
              isPremium ? (
                <span style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "10px", fontSize: "13px", fontWeight: 700, background: "var(--color-primary-light)", color: "var(--color-primary)" }}>
                  <Sparkles size={14} /> <span className="hide-mobile">Premium</span>
                </span>
              ) : (
                <Link href="/billing" style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "10px", fontSize: "13px", fontWeight: 700, textDecoration: "none", background: "var(--color-primary)", color: "white" }}>
                  <Sparkles size={14} /> <span className="hide-mobile">{translate(lang, "Оформить подписку")}</span>
                </Link>
              )
            )}
            <LangToggle />
            <ThemeToggle />
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "var(--color-primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 700, color: "white" }}>
                {user?.email?.[0]?.toUpperCase() ?? "U"}
              </div>
              <span className="hide-mobile" style={{ fontSize: "13px", color: "var(--color-muted)", maxWidth: "140px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.email}</span>
              <button onClick={signOut} style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-muted)", background: "none", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: "8px" }}>
                {t[lang].nav.logout}
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="page-container">

        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ fontSize: "clamp(22px, 4vw, 28px)", fontWeight: 800, color: "var(--color-foreground)", marginBottom: "4px" }}>{T.title}</h1>
          <p style={{ color: "var(--color-muted)", fontSize: "14px" }}>
            {collections.length} {T.sections}
          </p>
        </div>

        <div className="grid-stats">
          {T.stats.map((label, i) => {
            const Icon = statIcons[i];
            return (
              <div key={label} style={{ borderRadius: "16px", padding: "18px", background: "var(--color-card)", border: "1px solid var(--color-card-border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                  <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: `${statColors[i]}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon size={14} style={{ color: statColors[i] }} />
                  </div>
                  <span style={{ fontSize: "12px", color: "var(--color-muted)" }}>{label}</span>
                </div>
                <p style={{ fontSize: "26px", fontWeight: 800, color: "var(--color-foreground)" }}>{statValues[i]}</p>
              </div>
            );
          })}
        </div>

        <div className="search-row">
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "12px", padding: "0 16px", borderRadius: "12px", background: "var(--color-card)", border: "1px solid var(--color-card-border)" }}>
            <Search size={16} style={{ color: "var(--color-muted)", flexShrink: 0 }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={T.search}
              style={{ flex: 1, padding: "12px 0", outline: "none", background: "transparent", fontSize: "14px", color: "var(--color-foreground)", border: "none" }} />
          </div>
          <button onPointerDown={(e) => { e.preventDefault(); setShowCreate(true); }} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "0 20px", borderRadius: "12px", background: "var(--color-primary)", color: "white", fontWeight: 600, fontSize: "14px", border: "none", cursor: "pointer", whiteSpace: "nowrap", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>
            <Plus size={18} /> {T.newSection}
          </button>
        </div>

        {loadError && (
          <div style={{ padding: "12px 16px", borderRadius: "12px", background: "#ef444418", border: "1px solid #ef444440", fontSize: "13px", color: "#ef4444", marginBottom: "16px", wordBreak: "break-word" }}>
            {loadError}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "var(--color-muted)", fontSize: "14px" }}>
            {translate(lang, "Загрузка...")}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <p style={{ fontSize: "48px", marginBottom: "16px" }}>📚</p>
            <p style={{ fontSize: "18px", fontWeight: 600, color: "var(--color-foreground)", marginBottom: "8px" }}>{T.empty.title}</p>
            <p style={{ fontSize: "14px", color: "var(--color-muted)", marginBottom: "24px" }}>{T.empty.sub}</p>
            <button onPointerDown={(e) => { e.preventDefault(); setShowCreate(true); }} style={{ padding: "12px 24px", borderRadius: "12px", background: "var(--color-primary)", color: "white", fontWeight: 600, border: "none", cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>{T.empty.btn}</button>
          </div>
        ) : (
          <div className="grid-collections">
            {filtered.map((c) => (
              <div key={c.id} className="card-lift" style={{ borderRadius: "20px", padding: "20px", background: "var(--color-card)", border: "1px solid var(--color-card-border)", position: "relative" }}>
                <div style={{ position: "absolute", top: "16px", right: "16px" }}>
                  <button onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === c.id ? null : c.id); }}
                    style={{ width: "30px", height: "30px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", color: "var(--color-muted)" }}>
                    <MoreVertical size={16} />
                  </button>
                  {menuOpen === c.id && (
                    <div style={{ position: "absolute", right: 0, top: "36px", width: "160px", borderRadius: "12px", padding: "6px", background: "var(--color-card)", border: "1px solid var(--color-card-border)", boxShadow: "0 10px 30px rgba(0,0,0,0.3)", zIndex: 50 }}>
                      <button onClick={() => handleDelete(c.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", borderRadius: "8px", fontSize: "13px", color: "#ef4444", background: "none", border: "none", cursor: "pointer" }}>
                        <Trash2 size={14} /> {T.delete}
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ width: "56px", height: "56px", borderRadius: "16px", background: `${c.color}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", marginBottom: "16px" }}>{c.emoji}</div>
                <h3 style={{ fontWeight: 700, fontSize: "16px", color: "var(--color-foreground)", marginBottom: "4px" }}>{c.name}</h3>
                <p style={{ fontSize: "12px", color: "var(--color-muted)", marginBottom: "16px" }}>{c.description || "—"}</p>

                <div style={{ display: "flex", gap: "8px" }}>
                  <Link href={`/collection/${c.id}?name=${encodeURIComponent(c.name)}&emoji=${encodeURIComponent(c.emoji)}&color=${encodeURIComponent(c.color)}&desc=${encodeURIComponent(c.description || "")}`} style={{ flex: 1, padding: "8px", borderRadius: "10px", textAlign: "center", fontSize: "13px", fontWeight: 600, textDecoration: "none", background: "var(--color-background)", border: "1px solid var(--color-card-border)", color: "var(--color-foreground)" }}>{T.open}</Link>
                  <Link href={`/collection/${c.id}/chat?name=${encodeURIComponent(c.name)}&emoji=${encodeURIComponent(c.emoji)}&color=${encodeURIComponent(c.color)}`} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "10px", fontSize: "13px", fontWeight: 600, textDecoration: "none", background: c.color, color: "white" }}>
                    <MessageSquare size={13} /> {T.chat}
                  </Link>
                </div>
              </div>
            ))}

            <button onPointerDown={(e) => { e.preventDefault(); setShowCreate(true); }} className="add-section-btn" style={{ borderRadius: "20px", padding: "20px", minHeight: "200px", background: "transparent", border: "2px dashed var(--color-card-border)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", cursor: "pointer", color: "var(--color-muted)", touchAction: "manipulation" }}>
              <div style={{ width: "56px", height: "56px", borderRadius: "16px", background: "var(--color-card)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Plus size={24} style={{ color: "var(--color-primary)" }} />
              </div>
              <span style={{ fontSize: "14px", fontWeight: 600 }}>{T.newSection}</span>
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
