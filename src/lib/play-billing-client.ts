"use client";

// Client-side Google Play Billing purchase flow via the Digital Goods API +
// Payment Request API. Only works inside a Trusted Web Activity backed by a
// Play Store listing that has this product configured — see useIsTwa().
// https://developer.chrome.com/docs/android/trusted-web-activity/receive-payments-play-billing

declare global {
  interface Window {
    getDigitalGoodsService?: (paymentMethod: string) => Promise<unknown>;
  }
}

export async function isPlayBillingSupported(): Promise<boolean> {
  if (typeof window === "undefined" || !window.getDigitalGoodsService) return false;
  try {
    await window.getDigitalGoodsService("https://play.google.com/billing");
    return true;
  } catch {
    return false;
  }
}

export async function purchasePlaySubscription(productId: string): Promise<{ purchaseToken: string }> {
  const paymentMethods = [{ supportedMethods: "https://play.google.com/billing", data: { sku: productId } }] as PaymentMethodData[];
  const paymentDetails: PaymentDetailsInit = { total: { label: "Total", amount: { currency: "USD", value: "0" } } };

  const request = new PaymentRequest(paymentMethods, paymentDetails);
  const response = await request.show();
  const { purchaseToken } = response.details as { purchaseToken: string };
  await response.complete("success");

  if (!purchaseToken) throw new Error("Google Play did not return a purchase token");
  return { purchaseToken };
}
