import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { languageName, LANGUAGES, type Lang } from "@/lib/translate";
import { hasServerAccess } from "@/lib/limits";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OPENAI_KEY = process.env.OPENAI_API_KEY!;

const MAX_SOURCE_CHARS = 14000;

type RawQuestion = {
  question?: string;
  options?: { key?: string; text?: string }[];
  correct_answer?: string;
  explanation?: string;
};

export async function POST(req: NextRequest) {
  let test_id = "";

  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: { user }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!(await hasServerAccess(admin, user.id, user.created_at))) {
      return NextResponse.json(
        { error: "Пробный период закончился. Оформите подписку, чтобы продолжить пользоваться KnowledgeAI." },
        { status: 403 }
      );
    }

    const { collection_id, document_id, format, question_count, title, lang } = await req.json();
    const targetLanguage = languageName((lang as Lang) || "ru");
    const targetLanguageNative = LANGUAGES.find((l) => l.code === lang)?.native || targetLanguage;
    if (!collection_id || !format || !question_count) {
      return NextResponse.json({ error: "Missing collection_id, format or question_count" }, { status: 400 });
    }
    if (!["multiple_choice", "open_ended"].includes(format)) {
      return NextResponse.json({ error: "Invalid format" }, { status: 400 });
    }
    const count = Math.min(Math.max(parseInt(question_count, 10) || 5, 1), 20);

    // Gather source text: a single document, or every document in the collection.
    let sourceText = "";
    let defaultTitle = "";
    if (document_id) {
      const { data: doc, error: docErr } = await admin
        .from("kai_documents")
        .select("name, content")
        .eq("id", document_id)
        .eq("user_id", user.id)
        .single();
      if (docErr || !doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
      sourceText = doc.content || "";
      defaultTitle = `Тест: ${doc.name}`;
    } else {
      const { data: docs, error: docsErr } = await admin
        .from("kai_documents")
        .select("name, content")
        .eq("collection_id", collection_id)
        .eq("user_id", user.id)
        .eq("status", "ready");
      if (docsErr) throw new Error(docsErr.message);
      sourceText = (docs || []).map((d) => d.content || "").join("\n\n");
      defaultTitle = "Тест по разделу";
    }

    sourceText = sourceText.trim().slice(0, MAX_SOURCE_CHARS);
    if (!sourceText) {
      return NextResponse.json({ error: "Нет текста для генерации теста — загрузите материалы" }, { status: 400 });
    }

    const { data: test, error: insErr } = await admin
      .from("kai_tests")
      .insert({
        user_id: user.id,
        collection_id,
        document_id: document_id || null,
        title: title?.trim() || defaultTitle,
        format,
        question_count: count,
        status: "processing",
      })
      .select()
      .single();
    if (insErr || !test) throw new Error("Failed to create test: " + insErr?.message);
    test_id = test.id;

    const formatInstructions =
      format === "multiple_choice"
        ? `Каждый вопрос — с 4 вариантами ответа (options: [{"key":"A","text":"..."}, ...]). correct_answer — ключ правильного варианта (например "B").`
        : `Открытые вопросы, без вариантов ответа (options не нужен). correct_answer — эталонный правильный ответ, по которому позже будет оцениваться ответ пользователя.`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(45000),
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `ЯЗЫК ОТВЕТА: ${targetLanguage} (${targetLanguageNative}). Это главное требование этого задания и оно важнее всего остального ниже. ВЕСЬ твой ответ — question, options, correct_answer, explanation, буквально каждое слово — должен быть написан на языке ${targetLanguage}. Текст ниже, из которого ты берёшь материал, почти наверняка написан на ДРУГОМ языке — это нормально и ожидаемо: ты должен прочитать его, понять смысл и написать вопросы С НУЛЯ на языке ${targetLanguage}, а не копировать и не оставлять формулировки на языке оригинала. Если исходный текст уже на языке ${targetLanguage} — просто пиши на нём как обычно.

Ты составляешь тест для проверки понимания смысла и содержания прочитанного текста. Составь ровно ${count} вопрос(ов) по СУТИ текста: ключевые идеи, мысли автора, аргументы, события, выводы, факты из основного содержания. Не придумывай факты, которых там нет.

Строго ЗАПРЕЩЕНО составлять вопросы про: переводчика, издательство, год издания/публикации, ISBN, тираж, оформление обложки, содержание/оглавление, номера страниц, посвящения, копирайт и любые другие данные титульного листа и выходных данных — даже если такая информация есть в тексте. Игнорируй такие фрагменты текста при составлении вопросов, как будто их не существует.

${formatInstructions} Для каждого вопроса добавь короткое explanation — почему ответ правильный.

НАПОМИНАНИЕ: question, options, correct_answer и explanation — ВСЁ должно быть на языке ${targetLanguage} (${targetLanguageNative}), независимо от языка исходного текста ниже. Верни JSON: {"questions":[{"question":"...","options":[...] ,"correct_answer":"...","explanation":"..."}]}.`,
          },
          { role: "user", content: `Текст:\n\n${sourceText}` },
        ],
        response_format: { type: "json_object" },
        temperature: 0.4,
      }),
    });
    if (!res.ok) throw new Error("OpenAI request failed: " + (await res.text()));

    const data = await res.json();
    let parsed: { questions?: RawQuestion[] };
    try {
      parsed = JSON.parse(data.choices[0].message.content);
    } catch {
      throw new Error("Failed to parse AI response as JSON");
    }
    const questions = (parsed.questions || []).filter((q) => q.question && q.correct_answer);
    if (questions.length === 0) throw new Error("AI не вернул ни одного вопроса");

    const rows = questions.map((q, i) => ({
      test_id,
      order_index: i,
      question: q.question,
      options: format === "multiple_choice" ? q.options || null : null,
      correct_answer: q.correct_answer,
      explanation: q.explanation || null,
    }));
    const { error: qErr } = await admin.from("kai_test_questions").insert(rows);
    if (qErr) throw new Error("Failed to save questions: " + qErr.message);

    await admin.from("kai_tests").update({ status: "ready", question_count: rows.length }).eq("id", test_id);

    return NextResponse.json({ success: true, test_id });
  } catch (err) {
    console.error("generate-test error:", err);
    if (test_id) {
      try {
        const admin = createClient(SUPABASE_URL, SERVICE_KEY);
        await admin.from("kai_tests").update({ status: "error", error_message: String(err) }).eq("id", test_id);
      } catch {}
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
