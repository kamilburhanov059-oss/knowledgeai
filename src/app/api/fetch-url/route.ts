import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { lookup } from "dns/promises";
import { isIP } from "net";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const MAX_BYTES = 5 * 1024 * 1024; // 5MB of HTML is plenty for an article
const MAX_REDIRECTS = 5;

function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::") return true;
    if (v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80")) return true;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivateAddress(mapped[1]) : false;
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

async function assertPublicHost(url: URL): Promise<void> {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((r) => r.address);
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new Error("Ссылка ведёт на недоступный адрес");
  }
}

// Follows redirects manually so every hop is checked against private/internal
// addresses — otherwise a public URL could redirect the server into the VPS
// worker or cloud metadata endpoints.
async function fetchPublic(start: URL): Promise<Response> {
  let current = start;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    if (current.protocol !== "http:" && current.protocol !== "https:") {
      throw new Error("Поддерживаются только http/https ссылки");
    }
    await assertPublicHost(current);
    const res = await fetch(current.toString(), {
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; KnowledgeAI/1.0; +https://knowledgeai-seven.vercel.app)" },
    });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      current = new URL(location, current);
      continue;
    }
    return res;
  }
  throw new Error("Слишком много перенаправлений");
}

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
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: { user }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

    const res = await fetchPublic(parsed);
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
