import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OPENAI_KEY = process.env.OPENAI_API_KEY!;

function splitText(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + chunkSize;

    if (end < text.length) {
      const lastParagraph = text.lastIndexOf("\n\n", end);
      const lastSentence = text.lastIndexOf(".", end);
      const lastSpace = text.lastIndexOf(" ", end);

      if (lastParagraph > start + chunkSize * 0.5) {
        end = lastParagraph + 2;
      } else if (lastSentence > start + chunkSize * 0.5) {
        end = lastSentence + 1;
      } else if (lastSpace > start) {
        end = lastSpace + 1;
      }
    }

    const chunk = text.slice(start, end).trim();
    if (chunk.length > 50) chunks.push(chunk);

    start = Math.max(start + 1, end - overlap);
  }

  return chunks;
}

async function batchEmbeddings(texts: string[]): Promise<number[][]> {
  const BATCH = 200;
  const result: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "text-embedding-ada-002", input: batch }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error("Embedding failed: " + (await res.text()));
    const data = await res.json();
    result.push(...data.data.map((d: { embedding: number[] }) => d.embedding));
  }

  return result;
}

export async function POST(req: NextRequest) {
  let document_id = "";

  try {
    const body = await req.json();
    document_id = body.document_id;
    const { collection_id, user_id, document_name } = body;

    if (!document_id || !collection_id || !user_id) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. Fetch content from Supabase
    const { data: doc } = await admin
      .from("kai_documents")
      .select("content")
      .eq("id", document_id)
      .eq("user_id", user_id)
      .single();

    if (!doc?.content?.trim()) {
      await admin
        .from("kai_documents")
        .update({ status: "error", error_message: "Контент документа не найден в базе" })
        .eq("id", document_id);
      return NextResponse.json({ error: "No content" }, { status: 404 });
    }

    // 2. Clean and split into chunks
    const cleanText = doc.content
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();

    const chunks = splitText(cleanText, 2000, 200);

    if (chunks.length === 0) {
      await admin
        .from("kai_documents")
        .update({ status: "error", error_message: "Не удалось извлечь текст из документа" })
        .eq("id", document_id);
      return NextResponse.json({ error: "No chunks" }, { status: 400 });
    }

    // 3. Batch create embeddings (200 per request)
    const embeddings = await batchEmbeddings(chunks);

    // 4. Delete old chunks for this document
    await admin.from("kai_chunks").delete().eq("document_id", document_id);

    // 5. Bulk insert (200 per batch to stay within Supabase limits)
    const rows = chunks.map((content, i) => ({
      document_id,
      collection_id,
      user_id,
      document_name: document_name || "Document",
      content,
      embedding: embeddings[i],
      chunk_index: i,
    }));

    const INSERT_BATCH = 200;
    for (let i = 0; i < rows.length; i += INSERT_BATCH) {
      const { error: insertErr } = await admin
        .from("kai_chunks")
        .insert(rows.slice(i, i + INSERT_BATCH));
      if (insertErr) throw new Error("Insert failed: " + insertErr.message);
    }

    // 6. Mark document as ready
    await admin
      .from("kai_documents")
      .update({ status: "ready", processed_at: new Date().toISOString() })
      .eq("id", document_id);

    return NextResponse.json({ success: true, chunks_count: chunks.length });
  } catch (err) {
    console.error("process-chunks error:", err);

    if (document_id) {
      try {
        const admin = createClient(SUPABASE_URL, SERVICE_KEY);
        await admin
          .from("kai_documents")
          .update({ status: "error", error_message: String(err) })
          .eq("id", document_id);
      } catch {}
    }

    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
