const http = require("http");
global.WebSocket = require("ws");
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const WORKER_SECRET = process.env.WORKER_SECRET;
const PORT = process.env.PORT || 3001;

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

// ── Text splitting ────────────────────────────────────────────────────────────
function splitText(text, chunkSize = 2000, overlap = 200) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    let end = start + chunkSize;

    if (end < text.length) {
      const lastParagraph = text.lastIndexOf("\n\n", end);
      const lastSentence = text.lastIndexOf(".", end);
      const lastSpace = text.lastIndexOf(" ", end);

      if (lastParagraph > start + chunkSize * 0.5) end = lastParagraph + 2;
      else if (lastSentence > start + chunkSize * 0.5) end = lastSentence + 1;
      else if (lastSpace > start) end = lastSpace + 1;
    }

    const content = text.slice(start, end).trim();
    if (content.length > 50) chunks.push({ content, start });
    start = Math.max(start + 1, end - overlap);
  }

  return chunks;
}

// ── Page tracking ─────────────────────────────────────────────────────────────
// PDF extraction embeds "[[PAGE:n]]" markers before each page's text. Strip them
// out and remember where each page starts so chunks can be attributed to a page.
function stripPageMarkers(text) {
  const re = /\[\[PAGE:(\d+)\]\]\n?/g;
  const breaks = [];
  let result = "";
  let lastIndex = 0;
  let match;

  while ((match = re.exec(text))) {
    result += text.slice(lastIndex, match.index);
    breaks.push({ offset: result.length, page: parseInt(match[1], 10) });
    lastIndex = match.index + match[0].length;
  }
  result += text.slice(lastIndex);

  return { text: result, breaks };
}

function pageForOffset(breaks, offset) {
  if (breaks.length === 0) return null;
  let page = breaks[0].page;
  for (const b of breaks) {
    if (b.offset <= offset) page = b.page;
    else break;
  }
  return page;
}

// ── Batch embeddings (200 per request) ───────────────────────────────────────
async function batchEmbeddings(texts) {
  const BATCH = 200;
  const result = [];

  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "text-embedding-ada-002", input: batch }),
    });

    if (!res.ok) throw new Error("Embedding failed: " + (await res.text()));
    const data = await res.json();
    result.push(...data.data.map((d) => d.embedding));

    console.log(`Embeddings: ${Math.min(i + BATCH, texts.length)}/${texts.length}`);
  }

  return result;
}

// ── Main processing ───────────────────────────────────────────────────────────
async function processDocument({ document_id, collection_id, user_id, document_name }) {
  console.log(`[${new Date().toISOString()}] Processing: ${document_name} (${document_id})`);

  try {
    // 1. Fetch content
    const { data: doc, error } = await admin
      .from("kai_documents")
      .select("content")
      .eq("id", document_id)
      .eq("user_id", user_id)
      .single();

    if (error || !doc?.content?.trim()) {
      throw new Error("Document content not found in Supabase");
    }

    // 2. Clean and split
    const cleanText = doc.content
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();

    const { text: pageMarkedFreeText, breaks: pageBreaks } = stripPageMarkers(cleanText);
    const chunks = splitText(pageMarkedFreeText, 2000, 200);
    console.log(`Chunks: ${chunks.length}`);

    if (chunks.length === 0) throw new Error("No text content found");

    // 3. Batch embeddings
    const embeddings = await batchEmbeddings(chunks.map((c) => c.content));

    // 4. Delete old chunks
    await admin.from("kai_chunks").delete().eq("document_id", document_id);

    // 5. Bulk insert (200 per batch)
    const rows = chunks.map(({ content, start }, i) => {
      const page = pageForOffset(pageBreaks, start);
      return {
        document_id,
        collection_id,
        user_id,
        document_name: document_name || "Document",
        content,
        embedding: embeddings[i],
        chunk_index: i,
        metadata: page != null ? { page } : null,
      };
    });

    const INSERT_BATCH = 200;
    for (let i = 0; i < rows.length; i += INSERT_BATCH) {
      const { error: insertErr } = await admin
        .from("kai_chunks")
        .insert(rows.slice(i, i + INSERT_BATCH));
      if (insertErr) throw new Error("Insert failed: " + insertErr.message);
      console.log(`Inserted: ${Math.min(i + INSERT_BATCH, rows.length)}/${rows.length}`);
    }

    // 6. Mark ready
    await admin
      .from("kai_documents")
      .update({ status: "ready", processed_at: new Date().toISOString() })
      .eq("id", document_id);

    console.log(`Done: ${document_name} — ${chunks.length} chunks`);
  } catch (err) {
    console.error(`Error processing ${document_id}:`, err.message);
    await admin
      .from("kai_documents")
      .update({ status: "error", error_message: err.message })
      .eq("id", document_id);
  }
}

// ── HTTP Server ───────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  // Health check
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  // Process endpoint
  if (req.method === "POST" && req.url === "/process") {
    // Auth check
    if (req.headers["x-worker-secret"] !== WORKER_SECRET) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      let data;
      try {
        data = JSON.parse(body);
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON" }));
        return;
      }

      // Respond immediately, process in background
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, queued: true }));

      // Process without blocking
      processDocument(data);
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  console.log(`KnowledgeAI Worker running on port ${PORT}`);
  console.log(`SUPABASE_URL: ${SUPABASE_URL ? "✓" : "✗ NOT SET"}`);
  console.log(`SERVICE_KEY: ${SERVICE_KEY ? "✓" : "✗ NOT SET"}`);
  console.log(`OPENAI_KEY: ${OPENAI_KEY ? "✓" : "✗ NOT SET"}`);
  console.log(`WORKER_SECRET: ${WORKER_SECRET ? "✓" : "✗ NOT SET"}`);
});
