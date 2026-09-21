const http = require("http");
global.WebSocket = require("ws");
const { createClient } = require("@supabase/supabase-js");
const { loadDocx, readXml, writeXml, toBuffer } = require("./lib/docx-zip");
const { extractFlatText, applyReplacements, applyPlaceholders, findBlanks, applyBlankFills } = require("./lib/docx-splice");
const { convertDocxToPdf } = require("./lib/libreoffice");

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

// ── Template generation ──────────────────────────────────────────────────────
// Asks the model for the concrete edits to make, then hands them to the splice
// engine. Placeholder-mode gets a name->value map (matched against the actual
// {{...}} spans in the XML); freeform-mode gets old_text/new_text pairs, where
// old_text must be an exact copy from the document — applyReplacements() itself
// verifies each one is actually found before touching anything, so a
// hallucinated snippet is silently skipped rather than corrupting the document.
async function getReplacements({ mode, flatText, instruction, placeholderNames, blanks }) {
  const isPlaceholder = mode === "placeholder" && placeholderNames && placeholderNames.length > 0;
  const hasBlanks = !isPlaceholder && blanks && blanks.length > 0;

  let system;
  let user;

  if (isPlaceholder) {
    system = `Ты помогаешь заполнять шаблон документа. В документе есть плейсхолдеры: ${placeholderNames.map((n) => `{{${n}}}`).join(", ")}. По инструкции пользователя определи значение для каждого плейсхолдера, который можно уверенно заполнить. Верни JSON вида {"replacements":[{"placeholder":"ИМЯ","value":"значение"}]}. Не включай плейсхолдеры, для которых в инструкции нет данных.`;
    user = `Инструкция пользователя: ${instruction}`;
  } else if (hasBlanks) {
    // Blank runs ("__________") are located programmatically (exact offsets), not
    // by asking the model to reproduce a long underscore run character-for-character
    // — that's fragile (easy to miscount) and was the root cause of values landing
    // next to the wrong blank or not replacing it at all. The model only has to
    // pick a blank by its numeric id from a labeled, context-annotated list.
    const blanksList = blanks.map((b) => `#${b.id}: ...${b.before}[ПРОПУСК]${b.after}...`).join("\n");
    system = `Ты заполняешь пустые поля (пропуски) в документе и, если нужно, редактируешь остальной текст по инструкции пользователя.

Ниже — пронумерованный список пропусков, найденных в документе. Каждый показан с окружающим текстом, [ПРОПУСК] обозначает место самого пропуска. По инструкции пользователя определи, какое значение подходит для каждого пропуска, ориентируясь на текст РЯДОМ с ним (например пропуск сразу после "ИП «" — это название/имя ИП; пропуск после "директора" — имя директора; и т.д.). Указывай fill ТОЛЬКО для тех пропусков, где по контексту и инструкции есть однозначное соответствие. Не путай название ИП с названием ООО, а имя человека с названием компании. Если для пропуска нет подходящих данных в инструкции — не включай его, не угадывай.

Если инструкция также описывает изменение обычного (не пропущенного) текста документа — добавь такие правки в replacements: old_text должен быть дословной копией фрагмента (символ в символ, включая пробелы и пунктуацию) и встречаться в тексте документа РОВНО ОДИН РАЗ.

Верни JSON вида {"fills":[{"id":0,"value":"значение"}],"replacements":[{"old_text":"...","new_text":"..."}]}.`;
    user = `Пропуски в документе:\n${blanksList}\n\n---\n\nПолный текст документа (для контекста):\n${flatText}\n\n---\n\nИнструкция пользователя: ${instruction}`;
  } else {
    system = `Ты редактируешь документ по инструкции пользователя. Ниже дан полный текст документа. Определи, какие фрагменты нужно заменить и на что. old_text ДОЛЖЕН быть дословной копией фрагмента из текста документа (символ в символ, включая пробелы и пунктуацию) — не перефразируй и не сокращай его. old_text должен встречаться в тексте документа РОВНО ОДИН РАЗ. Если для инструкции нет подходящего места в документе — не включай такую замену.

Верни JSON вида {"replacements":[{"old_text":"...","new_text":"..."}]}.`;
    user = `Текст документа:\n${flatText}\n\n---\n\nИнструкция пользователя: ${instruction}`;
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    }),
  });
  if (!res.ok) throw new Error("OpenAI request failed: " + (await res.text()));

  const data = await res.json();
  let parsed;
  try {
    parsed = JSON.parse(data.choices[0].message.content);
  } catch {
    throw new Error("Failed to parse AI response as JSON");
  }
  const raw = Array.isArray(parsed.replacements) ? parsed.replacements : [];
  const rawFills = Array.isArray(parsed.fills) ? parsed.fills : [];

  return { isPlaceholder, raw, rawFills };
}

async function processTemplateGeneration({ generation_id, template_id, instruction }) {
  console.log(`[${new Date().toISOString()}] Generating: ${generation_id} (template ${template_id})`);

  try {
    const { data: template, error: tErr } = await admin
      .from("kai_templates")
      .select("*")
      .eq("id", template_id)
      .single();
    if (tErr || !template) throw new Error("Template not found");

    const { data: fileData, error: dlErr } = await admin.storage.from("templates").download(template.storage_path);
    if (dlErr || !fileData) throw new Error("Failed to download template: " + (dlErr?.message || "unknown"));
    const docxBuffer = Buffer.from(await fileData.arrayBuffer());

    const zip = loadDocx(docxBuffer);
    const documentXml = readXml(zip, "word/document.xml");
    if (!documentXml) throw new Error("Invalid .docx: word/document.xml not found");

    const flatText = extractFlatText(documentXml);
    const willUsePlaceholders = template.mode === "placeholder" && (template.placeholder_names || []).length > 0;
    const blanks = willUsePlaceholders ? [] : findBlanks(documentXml);

    const { isPlaceholder, raw, rawFills } = await getReplacements({
      mode: template.mode,
      flatText,
      instruction,
      placeholderNames: template.placeholder_names || [],
      blanks,
    });

    let result;
    if (isPlaceholder) {
      const valueMap = {};
      for (const r of raw) {
        if (r.placeholder && r.value != null) valueMap[String(r.placeholder).trim()] = r.value;
      }
      result = applyPlaceholders(documentXml, valueMap);
    } else {
      const blankById = new Map(blanks.map((b) => [b.id, b]));
      const fillList = rawFills
        .filter((f) => f && f.id != null && f.value != null && blankById.has(f.id))
        .map((f) => ({ id: f.id, ...blankById.get(f.id), value: String(f.value) }));

      const fillResult = applyBlankFills(documentXml, fillList);

      const replacements = raw
        .filter((r) => r.old_text && r.new_text != null)
        .map((r) => ({ oldText: r.old_text, newText: String(r.new_text), replaceAll: false }));
      const replaceResult = applyReplacements(fillResult.xml, replacements);

      result = {
        xml: replaceResult.xml,
        applied: [
          ...fillResult.applied.map((a) => ({ oldText: `[пропуск #${a.id}]`, newText: a.value, count: 1 })),
          ...replaceResult.applied,
        ],
        skipped: replaceResult.skipped,
      };
    }

    writeXml(zip, "word/document.xml", result.xml);
    const filledDocx = toBuffer(zip);

    const pdfBuffer = await convertDocxToPdf(filledDocx, generation_id);

    const outputPath = `${template.user_id}/${template_id}/generations/${generation_id}.pdf`;
    const { error: upErr } = await admin.storage
      .from("templates")
      .upload(outputPath, pdfBuffer, { contentType: "application/pdf", upsert: true });
    if (upErr) throw new Error("Failed to upload result: " + upErr.message);

    await admin
      .from("kai_template_generations")
      .update({
        status: "ready",
        output_storage_path: outputPath,
        applied_count: result.applied.length,
        skipped: result.skipped.length ? result.skipped : null,
      })
      .eq("id", generation_id);

    console.log(`Done: generation ${generation_id} — applied ${result.applied.length}, skipped ${result.skipped.length}`);
  } catch (err) {
    console.error(`Error generating ${generation_id}:`, err.message);
    await admin
      .from("kai_template_generations")
      .update({ status: "error", error_message: err.message })
      .eq("id", generation_id);
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

  // Template generation endpoint
  if (req.method === "POST" && req.url === "/generate-template") {
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

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, queued: true }));

      processTemplateGeneration(data);
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
