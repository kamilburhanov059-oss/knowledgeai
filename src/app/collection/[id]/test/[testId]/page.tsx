"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, XCircle, Loader2, RotateCcw } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { LangToggle } from "@/components/lang-toggle";
import { useLang } from "@/context/lang-context";
import { translate } from "@/lib/translate";
import { supabase, type KaiTest, type KaiTestQuestion, type KaiTestAttempt } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

type GradedAnswer = NonNullable<KaiTestAttempt["answers"]>[number];

export default function TestPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { lang } = useLang();
  useAuth();

  const collectionId = params.id as string;
  const testId = params.testId as string;
  const collectionName = searchParams.get("name") || translate(lang, "Раздел");

  const [test, setTest] = useState<KaiTest | null>(null);
  const [questions, setQuestions] = useState<KaiTestQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [result, setResult] = useState<{ score: number; answers: GradedAnswer[] } | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: testRow } = await supabase.from("kai_tests").select("*").eq("id", testId).single();
    if (testRow) setTest(testRow);
    const { data: qRows } = await supabase
      .from("kai_test_questions")
      .select("*")
      .eq("test_id", testId)
      .order("order_index", { ascending: true });
    if (qRows) setQuestions(qRows);
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId]);

  const allAnswered = questions.length > 0 && questions.every((q) => answers[q.id]?.trim());

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/submit-test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          test_id: testId,
          answers: questions.map((q) => ({ question_id: q.id, user_answer: answers[q.id] || "" })),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `Ошибка сервера: ${res.status}`);
      setResult({ score: body.score, answers: body.answers });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Неизвестная ошибка");
    } finally {
      setSubmitting(false);
    }
  };

  const collectionHref = `/collection/${collectionId}?name=${encodeURIComponent(collectionName)}`;

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-background)" }}>
      <nav style={{ position: "sticky", top: 0, zIndex: 100, borderBottom: "1px solid var(--color-card-border)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", background: "color-mix(in srgb, var(--color-background) 88%, transparent)" }}>
        <div className="nav-inner">
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Link href={collectionHref} style={{ width: "38px", height: "38px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-card)", border: "1px solid var(--color-card-border)", color: "var(--color-muted)", textDecoration: "none", flexShrink: 0 }}>
              <ArrowLeft size={18} />
            </Link>
            <span style={{ fontWeight: 700, fontSize: "15px", color: "var(--color-foreground)" }}>{test?.title || translate(lang, "Тест")}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <LangToggle />
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <main className="page-container" style={{ maxWidth: "720px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "var(--color-muted)", fontSize: "14px" }}>
            {translate(lang, "Загрузка...")}
          </div>
        ) : test?.status === "error" ? (
          <div style={{ padding: "16px", borderRadius: "12px", background: "#ef444418", border: "1px solid #ef444440", color: "#ef4444", fontSize: "14px" }}>
            {test.error_message || translate(lang, "Ошибка при создании теста")}
          </div>
        ) : questions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "var(--color-muted)", fontSize: "14px" }}>
            {translate(lang, "Вопросы не найдены")}
          </div>
        ) : result ? (
          <div>
            <div style={{ textAlign: "center", padding: "28px 0", marginBottom: "20px" }}>
              <p style={{ fontSize: "48px", fontWeight: 800, color: result.score >= 70 ? "#10b981" : result.score >= 40 ? "#f59e0b" : "#ef4444" }}>{result.score}%</p>
              <p style={{ fontSize: "14px", color: "var(--color-muted)" }}>
                {translate(lang, "Результат")}
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
              {questions.map((q, i) => {
                const a = result.answers.find((r) => r.question_id === q.id);
                const ok = a?.is_correct;
                return (
                  <div key={q.id} style={{ borderRadius: "16px", padding: "16px", background: "var(--color-card)", border: `1px solid ${ok ? "#10b98140" : "#ef444440"}` }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "8px" }}>
                      {ok ? <CheckCircle2 size={18} color="#10b981" style={{ flexShrink: 0, marginTop: "1px" }} /> : <XCircle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: "1px" }} />}
                      <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-foreground)" }}>{i + 1}. {q.question}</p>
                    </div>
                    <p style={{ fontSize: "13px", color: "var(--color-muted)", marginLeft: "28px" }}>
                      {translate(lang, "Ваш ответ")}: {q.options?.find((o) => o.key === a?.user_answer)?.text || a?.user_answer || "—"}
                    </p>
                    {!ok && (
                      <p style={{ fontSize: "13px", color: "var(--color-muted)", marginLeft: "28px", marginTop: "2px" }}>
                        {translate(lang, "Правильный ответ")}: {q.options?.find((o) => o.key === q.correct_answer)?.text || q.correct_answer}
                      </p>
                    )}
                    {(a?.feedback || q.explanation) && (
                      <p style={{ fontSize: "12px", color: "var(--color-muted)", marginLeft: "28px", marginTop: "6px", fontStyle: "italic" }}>{a?.feedback || q.explanation}</p>
                    )}
                  </div>
                );
              })}
            </div>

            <Link href={collectionHref} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "13px", borderRadius: "12px", background: "var(--color-primary)", color: "white", fontWeight: 700, fontSize: "14px", textDecoration: "none" }}>
              <RotateCcw size={16} /> {translate(lang, "Вернуться к разделу")}
            </Link>
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "20px" }}>
              {questions.map((q, i) => (
                <div key={q.id} style={{ borderRadius: "16px", padding: "16px", background: "var(--color-card)", border: "1px solid var(--color-card-border)" }}>
                  <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-foreground)", marginBottom: "12px" }}>{i + 1}. {q.question}</p>
                  {q.options ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {q.options.map((opt) => (
                        <button key={opt.key} onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: opt.key }))}
                          style={{ textAlign: "left", padding: "10px 14px", borderRadius: "10px", fontSize: "13px", border: `2px solid ${answers[q.id] === opt.key ? "var(--color-primary)" : "transparent"}`, cursor: "pointer", background: answers[q.id] === opt.key ? "var(--color-primary-light)" : "var(--color-background)", color: "var(--color-foreground)" }}>
                          <strong>{opt.key}.</strong> {opt.text}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <textarea
                      value={answers[q.id] || ""}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                      placeholder={translate(lang, "Напишите ваш ответ...")}
                      rows={3}
                      style={{ width: "100%", padding: "12px", borderRadius: "10px", outline: "none", fontSize: "13px", resize: "vertical", background: "var(--color-background)", border: "1px solid var(--color-card-border)", color: "var(--color-foreground)", boxSizing: "border-box", fontFamily: "inherit" }}
                    />
                  )}
                </div>
              ))}
            </div>

            {submitError && (
              <div style={{ marginBottom: "16px", padding: "10px 14px", borderRadius: "10px", background: "#ef444418", border: "1px solid #ef444440", fontSize: "13px", color: "#ef4444" }}>
                {submitError}
              </div>
            )}

            <button onClick={handleSubmit} disabled={!allAnswered || submitting}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "14px", borderRadius: "12px", fontWeight: 700, fontSize: "15px", border: "none", cursor: allAnswered ? "pointer" : "default", background: "var(--color-primary)", color: "white", opacity: allAnswered && !submitting ? 1 : 0.5 }}>
              {submitting && <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />}
              {submitting ? translate(lang, "Проверяем...") : translate(lang, "Завершить тест")}
            </button>
          </div>
        )}
      </main>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
