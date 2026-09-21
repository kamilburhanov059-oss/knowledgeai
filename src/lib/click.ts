import crypto from "crypto";

// $5/mo, fixed in so'm since Click settles in UZS regardless of how the price
// is advertised in the UI (~12,000 UZS/USD at the time this was set).
export const PRICE_UZS = 60000;

const SERVICE_ID = process.env.CLICK_SERVICE_ID || "";
const MERCHANT_ID = process.env.CLICK_MERCHANT_ID || "";
const SECRET_KEY = process.env.CLICK_SECRET_KEY || "";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://knowledgeai-seven.vercel.app";

export function buildCheckoutUrl(merchantTransId: string): string {
  const params = new URLSearchParams({
    service_id: SERVICE_ID,
    merchant_id: MERCHANT_ID,
    amount: String(PRICE_UZS),
    transaction_param: merchantTransId,
    return_url: `${SITE_URL}/billing?status=pending`,
  });
  return `https://my.click.uz/services/pay?${params.toString()}`;
}

function md5(input: string): string {
  return crypto.createHash("md5").update(input).digest("hex");
}

// Prepare: sign_string = md5(click_trans_id + service_id + SECRET_KEY + merchant_trans_id + amount + action + sign_time)
export function verifyPrepareSign(fields: {
  click_trans_id: string;
  service_id: string;
  merchant_trans_id: string;
  amount: string;
  action: string;
  sign_time: string;
  sign_string: string;
}): boolean {
  const expected = md5(
    fields.click_trans_id + fields.service_id + SECRET_KEY + fields.merchant_trans_id + fields.amount + fields.action + fields.sign_time
  );
  return expected === fields.sign_string;
}

// Complete: same as Prepare but with merchant_prepare_id inserted before amount.
export function verifyCompleteSign(fields: {
  click_trans_id: string;
  service_id: string;
  merchant_trans_id: string;
  merchant_prepare_id: string;
  amount: string;
  action: string;
  sign_time: string;
  sign_string: string;
}): boolean {
  const expected = md5(
    fields.click_trans_id +
      fields.service_id +
      SECRET_KEY +
      fields.merchant_trans_id +
      fields.merchant_prepare_id +
      fields.amount +
      fields.action +
      fields.sign_time
  );
  return expected === fields.sign_string;
}
