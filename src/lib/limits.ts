import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export const TRIAL_DAYS = 3;

// Kill switch: while false, everyone has full access regardless of trial/subscription
// status. Flip back to true to re-enable the paywall.
export const PAYMENTS_ENABLED = false;

// Pure date math — safe to call from both client components and server routes.
export function isTrialActive(createdAt: string): boolean {
  return Date.now() < new Date(createdAt).getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000;
}

// Client-side check: reads via the anon key + the browser's own auth session
// (relies on the "Users manage own subscription" RLS policy).
export async function isSubscriptionActive(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("kai_subscriptions")
    .select("status, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  return !!(data?.status === "active" && data.current_period_end && new Date(data.current_period_end) > new Date());
}

// Server-side check for API routes: takes the already-constructed service-role
// client (which bypasses RLS, same as every other server route in this app)
// plus the JWT-verified user's id/created_at.
export async function hasServerAccess(admin: SupabaseClient, userId: string, createdAt: string): Promise<boolean> {
  if (!PAYMENTS_ENABLED) return true;
  if (isTrialActive(createdAt)) return true;
  const { data } = await admin
    .from("kai_subscriptions")
    .select("status, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  return !!(data?.status === "active" && data.current_period_end && new Date(data.current_period_end) > new Date());
}
