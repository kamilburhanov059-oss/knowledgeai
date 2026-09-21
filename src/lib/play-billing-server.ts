import { JWT } from "google-auth-library";

const PACKAGE_NAME = process.env.GOOGLE_PLAY_PACKAGE_NAME || "com.knowledgeai.app";
const CLIENT_EMAIL = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL || "";
const PRIVATE_KEY = (process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY || "").replace(/\\n/g, "\n");

let cachedClient: JWT | null = null;
function getClient(): JWT {
  if (!cachedClient) {
    cachedClient = new JWT({
      email: CLIENT_EMAIL,
      key: PRIVATE_KEY,
      scopes: ["https://www.googleapis.com/auth/androidpublisher"],
    });
  }
  return cachedClient;
}

export type SubscriptionPurchaseV2 = {
  subscriptionState: string;
  acknowledgementState: string;
  latestOrderId?: string;
  lineItems?: { productId: string; expiryTime: string }[];
};

const ACTIVE_STATES = new Set(["SUBSCRIPTION_STATE_ACTIVE", "SUBSCRIPTION_STATE_IN_GRACE_PERIOD"]);
export function isActiveState(state: string): boolean {
  return ACTIVE_STATES.has(state);
}

// https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2/get
export async function getSubscriptionPurchase(purchaseToken: string): Promise<SubscriptionPurchaseV2> {
  const client = getClient();
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;
  const res = await client.request<SubscriptionPurchaseV2>({ url });
  return res.data;
}

// Acknowledgement still goes through the v3 (non-v2) endpoint — subscriptionsv2
// has no acknowledge method of its own. Must happen within 3 days of purchase
// or Google auto-refunds the user.
// https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptions/acknowledge
export async function acknowledgeSubscriptionPurchase(purchaseToken: string, productId: string): Promise<void> {
  const client = getClient();
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`;
  await client.request({ url, method: "POST", data: {} });
}
