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

    // Vercel sets this at the edge from the request's IP — no external geo-IP service needed.
    const country = req.headers.get("x-vercel-ip-country") || "unknown";

    await admin.from("kai_user_geo").upsert({ user_id: user.id, country, updated_at: new Date().toISOString() }, { onConflict: "user_id" });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("track-geo error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
