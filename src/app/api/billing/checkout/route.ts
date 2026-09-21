import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildCheckoutUrl, PRICE_UZS } from "@/lib/click";

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

    const merchantTransId = crypto.randomUUID();
    const { error: insErr } = await admin.from("kai_payments").insert({
      user_id: user.id,
      merchant_trans_id: merchantTransId,
      amount: PRICE_UZS,
      status: "pending",
    });
    if (insErr) throw new Error("Failed to create payment: " + insErr.message);

    return NextResponse.json({ checkout_url: buildCheckoutUrl(merchantTransId) });
  } catch (err) {
    console.error("billing/checkout error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
