"use client";

import { useState, useEffect } from "react";

// Standard TWA-detection signal: when a site is launched from an installed
// Trusted Web Activity, document.referrer is "android-app://<package-name>".
// Used to hide billing UI inside the wrapped app (Google Play policy avoidance
// — subscriptions bought in-app generally must go through Google Play Billing;
// keeping payment reachable only via a normal browser tab sidesteps that).
export function useIsTwa(): boolean {
  const [isTwa, setIsTwa] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsTwa(document.referrer.startsWith("android-app://"));
  }, []);

  return isTwa;
}
