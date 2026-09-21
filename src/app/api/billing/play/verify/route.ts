import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSubscriptionPurchase, acknowledgeSubscriptionPurchase, isActiveState } from "@/lib/play-billing-server";

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

    const { purchaseToken, productId } = await req.json();
    if (!purchaseToken || !productId) {
      return NextResponse.json({ error: "Missing purchaseToken or productId" }, { status: 400 });
    }

    const purchase = await getSubscriptionPurchase(purchaseToken);
    const lineItem = purchase.lineItems?.find((li) => li.productId === productId) ?? purchase.lineItems?.[0];
    const active = isActiveState(purchase.subscriptionState);
    const expiryTime = lineItem?.expiryTime ?? null;

    await admin.from("kai_play_purchases").upsert(
      { user_id: user.id, purchase_token: purchaseToken, product_id: productId, status: active ? "active" : "invalid", expiry_time: expiryTime },
      { onConflict: "purchase_token" }
    );

    if (!active) {
      return NextResponse.json({ error: "Subscription is not active" }, { status: 400 });
    }

    if (purchase.acknowledgementState !== "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED") {
      await acknowledgeSubscriptionPurchase(purchaseToken, productId);
    }

    await admin.from("kai_subscriptions").upsert(
      { user_id: user.id, status: "active", current_period_end: expiryTime, provider: "play" },
      { onConflict: "user_id" }
    );

    return NextResponse.json({ success: true, current_period_end: expiryTime });
  } catch (err) {
    console.error("billing/play/verify error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
