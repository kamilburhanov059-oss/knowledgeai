import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: { user }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { generation_id } = await req.json();
    if (!generation_id) return NextResponse.json({ error: "Missing generation_id" }, { status: 400 });

    const { data: generation, error: gErr } = await admin
      .from("kai_template_generations")
      .select("output_storage_path, status")
      .eq("id", generation_id)
      .eq("user_id", user.id)
      .single();
    if (gErr || !generation) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (generation.status !== "ready" || !generation.output_storage_path) {
      return NextResponse.json({ error: "Файл ещё не готов" }, { status: 400 });
    }

    const { data: signed, error: signErr } = await admin.storage
      .from("templates")
      .createSignedUrl(generation.output_storage_path, 300);
    if (signErr || !signed) throw new Error("Failed to sign URL: " + signErr?.message);

    return NextResponse.json({ url: signed.signedUrl });
  } catch (err) {
    console.error("download-generation error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
