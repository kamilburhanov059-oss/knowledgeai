import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { signInternalRequest } from "@/lib/internal-auth";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const VPS_WORKER_URL = process.env.VPS_WORKER_URL || "http://116.203.44.46:3001";
const VPS_WORKER_SECRET = process.env.VPS_WORKER_SECRET || "";

export async function POST(req: NextRequest) {
  let document_id = "";

  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: { user }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { collection_id, document_name } = body;
    const user_id = user.id;

    if (!body.document_id || !collection_id) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { data: owned } = await admin
      .from("kai_documents")
      .select("id")
      .eq("id", body.document_id)
      .eq("user_id", user_id)
      .eq("collection_id", collection_id)
      .maybeSingle();
    if (!owned) return NextResponse.json({ error: "Document not found" }, { status: 404 });
    document_id = body.document_id;

    // Mark as processing
    await admin
      .from("kai_documents")
      .update({ status: "processing" })
      .eq("id", document_id);

    // Use VPS worker if configured, otherwise fall back to local worker
    if (VPS_WORKER_SECRET) {
      // Call VPS worker (external server — truly fire-and-forget, no Vercel timeout)
      const vpsRes = await fetch(`${VPS_WORKER_URL}/process`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-worker-secret": VPS_WORKER_SECRET,
        },
        body: JSON.stringify({ document_id, collection_id, user_id, document_name }),
        signal: AbortSignal.timeout(10000),
      });

      if (!vpsRes.ok) throw new Error(`VPS worker error: ${vpsRes.status}`);
      return NextResponse.json({ success: true });
    }

    // Fallback: local Vercel worker (for small files)
    const origin =
      process.env.NEXT_PUBLIC_APP_URL || "https://knowledgeai-seven.vercel.app";

    const workerRes = await fetch(`${origin}/api/process-chunks`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-signature": signInternalRequest(document_id) },
      body: JSON.stringify({ document_id, collection_id, user_id, document_name }),
      signal: AbortSignal.timeout(55000),
    });

    if (!workerRes.ok) {
      const errText = await workerRes.text().catch(() => "");
      throw new Error(`Worker failed ${workerRes.status}: ${errText}`);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("process-document error:", err);

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
