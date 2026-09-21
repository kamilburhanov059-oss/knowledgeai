import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyPrepareSign } from "@/lib/click";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Click posts application/x-www-form-urlencoded, not JSON.
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
      !verifyPrepareSign({
        click_trans_id: clickTransId,
        service_id: f.service_id || "",
        merchant_trans_id: merchantTransId,
        amount: f.amount || "",
        action: f.action || "",
        sign_time: f.sign_time || "",
        sign_string: f.sign_string || "",
      })
    ) {
      return respond(-1, "SIGN CHECK FAILED!");
    }

    if (f.action !== "0") return respond(-3, "Action not found");

    const { data: payment, error: findErr } = await admin
      .from("kai_payments")
      .select("*")
      .eq("merchant_trans_id", merchantTransId)
      .single();
    if (findErr || !payment) return respond(-5, "User does not exist");

    if (Math.abs(Number(f.amount) - Number(payment.amount)) > 0.01) {
      return respond(-2, "Incorrect parameter amount");
    }

    const { error: updErr } = await admin
      .from("kai_payments")
      .update({ status: "prepared", click_trans_id: clickTransId })
      .eq("id", payment.id);
    if (updErr) throw new Error(updErr.message);

    return respond(0, "Success", { merchant_prepare_id: payment.id });
  } catch (err) {
    console.error("billing/click/prepare error:", err);
    return respond(-8, "Error in request from Click");
  }
}
