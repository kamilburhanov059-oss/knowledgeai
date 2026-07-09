import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { document_id, collection_id, user_id, document_name } = body;

    if (!document_id || !collection_id || !user_id) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Mark as processing
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    await admin
      .from("kai_documents")
      .update({ status: "processing" })
      .eq("id", document_id);

    // Fire and forget — spawn independent worker function
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      req.headers.get("origin") ||
      "https://knowledgeai-seven.vercel.app";

    fetch(`${origin}/api/process-chunks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document_id, collection_id, user_id, document_name }),
    }).catch((err) => console.error("Worker spawn failed:", err));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("process-document error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
