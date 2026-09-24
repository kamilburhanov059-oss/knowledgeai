"use client";

import { useState, useEffect } from "react";

const TWA_FLAG_KEY = "kai_is_twa";

// A TWA launch sets document.referrer to "android-app://<package>", but only on
// the first page load — a reload or an OAuth round-trip replaces it. The flag is
// kept in sessionStorage (per-tab, so it never leaks into normal Chrome tabs that
// share storage with the TWA). getDigitalGoodsService is only exposed inside a
// TWA with Play Billing enabled, so its presence is an independent signal.
// Inside the Android app, subscriptions must go through Google Play Billing.
function detectTwa(): boolean {
  try {
    if (document.referrer.startsWith("android-app://")) {
      sessionStorage.setItem(TWA_FLAG_KEY, "1");
      return true;
    }
    if (sessionStorage.getItem(TWA_FLAG_KEY) === "1") return true;
  } catch {}
  return typeof window.getDigitalGoodsService === "function";
}

export function useIsTwa(): boolean {
  const [isTwa, setIsTwa] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsTwa(detectTwa());
  }, []);

  return isTwa;
}
