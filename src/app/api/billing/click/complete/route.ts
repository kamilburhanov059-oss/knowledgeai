import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyCompleteSign } from "@/lib/click";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

async function parseClickBody(req: NextRequest): Promise<Record<string, string>> {
  const text = await req.text();
  const params = new URLSearchParams(text);
  const fields: Record<string, string> = {};
  params.forEach((value, key) => (fields[key] = value));
  return fields;
}

export async function POST(req: NextRequest) {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const f = await parseClickBody(req);

  const clickTransId = f.click_trans_id || "";
  const merchantTransId = f.merchant_trans_id || "";
  const merchantPrepareId = f.merchant_prepare_id || "";

  const respond = (error: number, error_note: string, extra: Record<string, unknown> = {}) =>
    NextResponse.json({
      click_trans_id: clickTransId,
      merchant_trans_id: merchantTransId,
      error,
      error_note,
      ...extra,
    });

  try {
    if (
      !verifyCompleteSign({
        click_trans_id: clickTransId,
        service_id: f.service_id || "",
        merchant_trans_id: merchantTransId,
        merchant_prepare_id: merchantPrepareId,
        amount: f.amount || "",
        action: f.action || "",
        sign_time: f.sign_time || "",
        sign_string: f.sign_string || "",
      })
    ) {
      return respond(-1, "SIGN CHECK FAILED!");
    }

    if (f.action !== "1") return respond(-3, "Action not found");

    const { data: payment, error: findErr } = await admin
      .from("kai_payments")
      .select("*")
      .eq("merchant_trans_id", merchantTransId)
      .eq("id", merchantPrepareId)
      .single();
    if (findErr || !payment) return respond(-6, "Transaction does not exist");

    // Click reports its own failure via a negative error field on the request.
    if (Number(f.error) < 0) {
      await admin.from("kai_payments").update({ status: "failed", error_note: f.error_note || null }).eq("id", payment.id);
      return respond(-9, "Transaction cancelled");
    }

    await admin.from("kai_payments").update({ status: "paid" }).eq("id", payment.id);

    const { data: sub } = await admin
      .from("kai_subscriptions")
      .select("current_period_end")
      .eq("user_id", payment.user_id)
      .maybeSingle();

    const base = sub?.current_period_end && new Date(sub.current_period_end).getTime() > Date.now()
      ? new Date(sub.current_period_end).getTime()
      : Date.now();
    const newPeriodEnd = new Date(base + THIRTY_DAYS_MS).toISOString();

    const { error: upsertErr } = await admin
      .from("kai_subscriptions")
      .upsert({ user_id: payment.user_id, status: "active", current_period_end: newPeriodEnd }, { onConflict: "user_id" });
    if (upsertErr) throw new Error(upsertErr.message);

    return respond(0, "Success", { merchant_confirm_id: payment.id });
  } catch (err) {
    console.error("billing/click/complete error:", err);
    return respond(-8, "Error in request from Click");
  }
}
