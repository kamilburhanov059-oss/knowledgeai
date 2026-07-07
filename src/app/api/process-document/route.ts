import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const n8nUrl = process.env.N8N_PROCESS_DOCUMENT_WEBHOOK_URL;
    if (!n8nUrl) {
      return NextResponse.json({ error: "N8N URL not configured" }, { status: 500 });
    }

    const res = await fetch(n8nUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("N8N webhook error:", res.status, text);
      return NextResponse.json({ error: "Webhook failed" }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Process document error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
