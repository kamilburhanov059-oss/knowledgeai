"use client";

// Client-side Google Play Billing purchase flow.
//
// The Android app is a Capacitor WebView shell (see /android in the
// knowledgeai-capacitor project) with a native PlayBillingPlugin that bridges
// to the Play Billing Library directly — accessed here via the global
// Capacitor runtime, with no npm package needed for a native-only plugin.
//
// Older builds were a Trusted Web Activity and used the Digital Goods API
// (window.getDigitalGoodsService) instead; that's kept as a fallback in case
// a TWA build is ever revived, but the Capacitor plugin is tried first.
// https://developer.chrome.com/docs/android/trusted-web-activity/receive-payments-play-billing

declare global {
  interface Window {
    getDigitalGoodsService?: (paymentMethod: string) => Promise<unknown>;
    Capacitor?: {
      isNativePlatform?: () => boolean;
      Plugins?: {
        PlayBilling?: {
          isSupported: () => Promise<{ supported: boolean }>;
          purchase: (opts: { productId: string }) => Promise<{ purchaseToken: string; productId: string }>;
        };
      };
    };
  }
}

export async function isPlayBillingSupported(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  if (window.Capacitor?.isNativePlatform?.() && window.Capacitor.Plugins?.PlayBilling) {
    try {
      const { supported } = await window.Capacitor.Plugins.PlayBilling.isSupported();
      return supported;
    } catch {
      return false;
    }
  }

  if (!window.getDigitalGoodsService) return false;
  try {
    await window.getDigitalGoodsService("https://play.google.com/billing");
    return true;
  } catch {
    return false;
  }
}

export async function purchasePlaySubscription(productId: string): Promise<{ purchaseToken: string }> {
  if (window.Capacitor?.isNativePlatform?.() && window.Capacitor.Plugins?.PlayBilling) {
    const { purchaseToken } = await window.Capacitor.Plugins.PlayBilling.purchase({ productId });
    if (!purchaseToken) throw new Error("Google Play did not return a purchase token");
    return { purchaseToken };
  }

  const paymentMethods = [{ supportedMethods: "https://play.google.com/billing", data: { sku: productId } }] as PaymentMethodData[];
  const paymentDetails: PaymentDetailsInit = { total: { label: "Total", amount: { currency: "USD", value: "0" } } };

  const request = new PaymentRequest(paymentMethods, paymentDetails);
  const response = await request.show();
  const { purchaseToken } = response.details as { purchaseToken: string };
  await response.complete("success");

  if (!purchaseToken) throw new Error("Google Play did not return a purchase token");
  return { purchaseToken };
}
