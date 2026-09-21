import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hasServerAccess } from "@/lib/limits";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const VPS_WORKER_URL = process.env.VPS_WORKER_URL || "http://116.203.44.46:3001";
const VPS_WORKER_SECRET = process.env.VPS_WORKER_SECRET || "";

export async function POST(req: NextRequest) {
  let generation_id = "";

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

    const { template_id, instruction } = await req.json();
    if (!template_id || !instruction?.trim()) {
      return NextResponse.json({ error: "Missing template_id or instruction" }, { status: 400 });
    }

    const { data: template, error: tErr } = await admin
      .from("kai_templates")
      .select("id")
      .eq("id", template_id)
      .eq("user_id", user.id)
      .single();
    if (tErr || !template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

    const { data: generation, error: insErr } = await admin
      .from("kai_template_generations")
      .insert({ template_id, user_id: user.id, instruction: instruction.trim(), status: "processing" })
      .select()
      .single();
    if (insErr || !generation) throw new Error("Failed to create generation: " + insErr?.message);
    generation_id = generation.id;

    if (!VPS_WORKER_SECRET) throw new Error("Template generation is not configured (no VPS worker)");

    const vpsRes = await fetch(`${VPS_WORKER_URL}/generate-template`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-worker-secret": VPS_WORKER_SECRET },
      body: JSON.stringify({ generation_id, template_id, instruction: instruction.trim() }),
      signal: AbortSignal.timeout(10000),
    });
    if (!vpsRes.ok) throw new Error(`VPS worker error: ${vpsRes.status}`);

    return NextResponse.json({ success: true, generation_id });
  } catch (err) {
    console.error("generate-template error:", err);

    if (generation_id) {
      try {
        const admin = createClient(SUPABASE_URL, SERVICE_KEY);
        await admin
          .from("kai_template_generations")
          .update({ status: "error", error_message: String(err) })
          .eq("id", generation_id);
      } catch {}
    }

    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
