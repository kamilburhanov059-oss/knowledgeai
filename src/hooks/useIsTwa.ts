"use client";

import { useState, useEffect } from "react";

const TWA_FLAG_KEY = "kai_is_twa";

// True inside the Android app shell — whether that's the current Capacitor
// WebView build (window.Capacitor.isNativePlatform()) or an older TWA build
// (document.referrer is "android-app://<package>" on first load only, so it's
// latched into sessionStorage; getDigitalGoodsService is TWA's own signal).
// Inside the Android app, subscriptions must go through Google Play Billing
// instead of the regular web checkout.
function detectTwa(): boolean {
  try {
    if (window.Capacitor?.isNativePlatform?.()) return true;
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
