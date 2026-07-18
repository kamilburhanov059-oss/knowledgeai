import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB of HTML is plenty for an article

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", nbsp: " ",
  mdash: "—", ndash: "–", hellip: "…", laquo: "«", raquo: "»",
};

function decodeEntities(s: string): string {
  return s.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (match, code) => {
    if (code[0] === "#") {
      const num = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isNaN(num) ? match : String.fromCodePoint(num);
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

const YOUTUBE_ID_RE = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

function extractYouTubeId(url: string): string | null {
  const m = url.match(YOUTUBE_ID_RE);
  return m ? m[1] : null;
}

// Fetching YouTube's own pages directly gets blocked by bot detection
// (confirmed: datacenter IPs get a captcha redirect, and even yt-dlp from a
// non-blocked IP hits "Sign in to confirm you're not a bot"). Supadata is a
// paid transcript API that handles that on their end.
async function fetchYouTubeTranscript(url: string): Promise<{ title: string; text: string }> {
  const apiKey = process.env.SUPADATA_API_KEY;
  if (!apiKey) throw new Error("Транскрипция YouTube временно недоступна (не настроен API-ключ)");

  const [transcriptRes, oembedRes] = await Promise.all([
    fetch(`https://api.supadata.ai/v1/transcript?url=${encodeURIComponent(url)}`, {
      headers: { "x-api-key": apiKey },
      signal: AbortSignal.timeout(20000),
    }),
    fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, {
      signal: AbortSignal.timeout(10000),
    }).catch(() => null),
  ]);

  if (!transcriptRes.ok) {
    const body = await transcriptRes.text().catch(() => "");
    throw new Error(`Не удалось получить субтитры (${transcriptRes.status}): ${body.slice(0, 200)}`);
  }

  const data = await transcriptRes.json();
  const segments = data.content as { text: string }[] | undefined;
  const text = (segments || [])
    .map((s) => s.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) throw new Error("Субтитры оказались пустыми");

  let title = "";
  if (oembedRes && oembedRes.ok) {
    const oembed = await oembedRes.json().catch(() => null);
    title = oembed?.title || "";
  }

  return { title, text };
}

function htmlToText(html: string): { title: string; text: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1]).trim() : "";

  const body = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|nav|footer|header)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(p|div|br|li|h[1-6]|tr|section|article)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  const text = decodeEntities(body)
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();

  return { title, text };
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (typeof url !== "string" || !url.trim()) {
      return NextResponse.json({ error: "Missing url" }, { status: 400 });
    }

    let parsed: URL;
    try {
      parsed = new URL(url.trim());
    } catch {
      return NextResponse.json({ error: "Некорректная ссылка" }, { status: 400 });
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return NextResponse.json({ error: "Поддерживаются только http/https ссылки" }, { status: 400 });
    }

    if (extractYouTubeId(parsed.toString())) {
      const { title, text } = await fetchYouTubeTranscript(parsed.toString());
      return NextResponse.json({ title, content: text });
    }

    const res = await fetch(parsed.toString(), {
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; KnowledgeAI/1.0; +https://knowledgeai-seven.vercel.app)" },
    });
    if (!res.ok) {
      return NextResponse.json({ error: `Не удалось загрузить страницу (${res.status})` }, { status: 400 });
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("text")) {
      return NextResponse.json({ error: "Ссылка ведёт не на HTML-страницу" }, { status: 400 });
    }

    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "Страница слишком большая" }, { status: 400 });
    }

    const html = new TextDecoder("utf-8").decode(buf);
    const { title, text } = htmlToText(html);

    if (!text.trim()) {
      return NextResponse.json({ error: "Не удалось извлечь текст со страницы" }, { status: 400 });
    }

    return NextResponse.json({ title, content: text });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Ошибка загрузки страницы: ${msg}` }, { status: 500 });
  }
}
