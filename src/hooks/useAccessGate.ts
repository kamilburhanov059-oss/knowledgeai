"use client";

import { useState, useEffect } from "react";
import type { User } from "@supabase/supabase-js";
import { isTrialActive, isSubscriptionActive, PAYMENTS_ENABLED } from "@/lib/limits";

// Gate for the 3-day trial: full access while the trial is running, then
// blocked until an active subscription is found. Pass the `user` object from
// useAuth() — this hook doesn't fetch auth itself so pages keep their existing
// useAuth() call (for email display, signOut, etc.) untouched.
export function useAccessGate(user: User | null) {
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(true);

  useEffect(() => {
    if (!PAYMENTS_ENABLED) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }
    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }
    if (isTrialActive(user.created_at)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      setHasAccess(true);
      return;
    }
    isSubscriptionActive(user.id).then((active) => {
      setLoading(false);
      setHasAccess(active);
    });
  }, [user]);

  return { loading, hasAccess };
}
