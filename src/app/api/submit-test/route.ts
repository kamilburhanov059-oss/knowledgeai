import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 45;
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OPENAI_KEY = process.env.OPENAI_API_KEY!;

type SubmittedAnswer = { question_id: string; user_answer: string };
type GradedAnswer = {
  question_id: string;
  user_answer: string;
  is_correct: boolean;
  partial?: boolean;
  feedback?: string;
};

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: { user }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { test_id, answers } = (await req.json()) as { test_id: string; answers: SubmittedAnswer[] };
    if (!test_id || !Array.isArray(answers) || answers.length === 0) {
      return NextResponse.json({ error: "Missing test_id or answers" }, { status: 400 });
    }

    const { data: test, error: testErr } = await admin
      .from("kai_tests")
      .select("id, format, user_id")
      .eq("id", test_id)
      .eq("user_id", user.id)
      .single();
    if (testErr || !test) return NextResponse.json({ error: "Test not found" }, { status: 404 });

    const { data: questions, error: qErr } = await admin
      .from("kai_test_questions")
      .select("id, question, correct_answer, explanation")
      .eq("test_id", test_id);
    if (qErr || !questions) throw new Error("Failed to load questions: " + qErr?.message);

    const byId = new Map(questions.map((q) => [q.id, q]));
    let graded: GradedAnswer[];

    if (test.format === "multiple_choice") {
      graded = answers.map((a) => {
        const q = byId.get(a.question_id);
        const is_correct = !!q && a.user_answer?.trim().toUpperCase() === q.correct_answer?.trim().toUpperCase();
        return { question_id: a.question_id, user_answer: a.user_answer, is_correct };
      });
    } else {
      // Open-ended: one batched OpenAI call grades every answer at once.
      const gradingInput = answers
        .map((a, i) => {
          const q = byId.get(a.question_id);
          return `${i + 1}) Вопрос: ${q?.question}\nЭталонный ответ: ${q?.correct_answer}\nОтвет пользователя: ${a.user_answer || "(пусто)"}`;
        })
        .join("\n\n");

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(30000),
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `Ты проверяешь ответы пользователя на открытые вопросы теста, сравнивая с эталонным ответом. Для каждого вопроса по номеру верни: is_correct (true если ответ по сути верный, даже другими словами), partial (true если ответ частично верный/неполный), и короткий feedback на языке вопроса. Верни JSON: {"results":[{"index":1,"is_correct":true,"partial":false,"feedback":"..."}]}.`,
            },
            { role: "user", content: gradingInput },
          ],
          response_format: { type: "json_object" },
          temperature: 0,
        }),
      });
      if (!res.ok) throw new Error("Grading request failed: " + (await res.text()));
      const data = await res.json();
      let parsed: { results?: { index?: number; is_correct?: boolean; partial?: boolean; feedback?: string }[] };
      try {
        parsed = JSON.parse(data.choices[0].message.content);
      } catch {
        throw new Error("Failed to parse grading response");
      }
      const results = parsed.results || [];
      graded = answers.map((a, i) => {
        const r = results.find((r) => r.index === i + 1) || results[i];
        return {
          question_id: a.question_id,
          user_answer: a.user_answer,
          is_correct: !!r?.is_correct,
          partial: !!r?.partial,
          feedback: r?.feedback,
        };
      });
    }

    const points = graded.reduce((sum, g) => sum + (g.is_correct ? 1 : g.partial ? 0.5 : 0), 0);
    const score = Math.round((points / graded.length) * 100);

    const { data: attempt, error: attErr } = await admin
      .from("kai_test_attempts")
      .insert({
        test_id,
        user_id: user.id,
        status: "completed",
        score,
        answers: graded,
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (attErr || !attempt) throw new Error("Failed to save attempt: " + attErr?.message);

    return NextResponse.json({ success: true, attempt_id: attempt.id, score, answers: graded });
  } catch (err) {
    console.error("submit-test error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
