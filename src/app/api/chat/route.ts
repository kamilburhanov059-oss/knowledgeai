import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hasServerAccess } from "@/lib/limits";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OPENAI_KEY = process.env.OPENAI_API_KEY!;

export async function POST(req: NextRequest) {
  try {
    // Verify user from Authorization header
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: { user }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { question, collection_id } = await req.json();
    if (!question?.trim() || !collection_id) {
      return NextResponse.json({ error: "Missing question or collection_id" }, { status: 400 });
    }

    // 3-day trial, then requires an active subscription.
    if (!(await hasServerAccess(admin, user.id, user.created_at))) {
      return NextResponse.json(
        { error: "Пробный период закончился. Оформите подписку, чтобы продолжить пользоваться KnowledgeAI." },
        { status: 403 }
      );
    }

    // 1. Create embedding for the question
    const embRes = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "text-embedding-ada-002", input: question }),
      signal: AbortSignal.timeout(15000),
    });
    if (!embRes.ok) throw new Error("Embedding failed: " + await embRes.text());
    const { data: [{ embedding }] } = await embRes.json();

    // 2. Search similar chunks via Supabase RPC
    const { data: chunks, error: rpcErr } = await admin.rpc("match_chunks_v2", {
      query_embedding: embedding,
      collection_id_filter: collection_id,
      user_id_filter: user.id,
      match_count: 10,
      match_threshold: 0.3,
    });
    if (rpcErr) throw new Error("Search failed: " + rpcErr.message);

    if (!chunks || chunks.length === 0) {
      return NextResponse.json({
        success: true,
        answer: "Не нашёл релевантной информации в загруженных материалах. Попробуйте загрузить больше документов или перефразируйте вопрос.",
        sources: [],
        chunks_count: 0,
      });
    }

    // 3. Build context from chunks
    const context = chunks
      .map((c: { content: string; document_name: string; page_number: number | null }, i: number) =>
        `[Источник ${i + 1} — ${c.document_name}${c.page_number ? `, стр. ${c.page_number}` : ""}]\n${c.content}`)
      .join("\n\n---\n\n");

    // 4. Call OpenAI Chat
    const chatRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Ты AI-ассистент по книгам и документам. Отвечай ТОЛЬКО на основе предоставленного контекста. Если информации нет — скажи об этом честно. Отвечай на том же языке, на котором задан вопрос.",
          },
          {
            role: "user",
            content: `Контекст:\n\n${context}\n\n---\n\nВопрос: ${question}`,
          },
        ],
        max_tokens: 1000,
        temperature: 0.3,
      }),
    });
    if (!chatRes.ok) throw new Error("Chat failed: " + await chatRes.text());
    const chatData = await chatRes.json();
    const answer = chatData.choices[0].message.content;

    const sources = chunks.map((c: { document_name: string; content: string; page_number: number | null }) => ({
      book: c.document_name,
      page: c.page_number,
      excerpt: c.content.slice(0, 200) + (c.content.length > 200 ? "..." : ""),
    }));

    const { error: saveErr } = await admin.from("kai_chat_messages").insert([
      { collection_id, user_id: user.id, role: "user", content: question, sources: null },
      { collection_id, user_id: user.id, role: "assistant", content: answer, sources },
    ]);
    if (saveErr) console.error("Failed to save chat messages:", saveErr.message);

    return NextResponse.json({ success: true, answer, sources, chunks_count: chunks.length });
  } catch (err) {
    console.error("Chat API error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
