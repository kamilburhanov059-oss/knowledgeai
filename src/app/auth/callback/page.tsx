"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const token_hash = params.get("token_hash");
    const type = params.get("type") as "recovery" | "magiclink" | "signup" | "email" | null;

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ data }) => {
        router.push(data?.session ? "/dashboard" : "/login");
      });
    } else if (token_hash && type) {
      supabase.auth.verifyOtp({ token_hash, type }).then(({ data, error }) => {
        if (type === "recovery") {
          router.push(data?.session ? "/update-password" : "/login");
        } else {
          router.push(data?.session ? "/dashboard" : "/login");
        }
      });
    } else {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          router.push("/dashboard");
        } else {
          supabase.auth.onAuthStateChange((event, s) => {
            if (event === "PASSWORD_RECOVERY") {
              router.push("/update-password");
            } else if (s) {
              router.push("/dashboard");
            } else {
              router.push("/login");
            }
          });
        }
      });
    }
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-background)" }}>
      <div style={{ fontSize: "16px", color: "var(--color-muted)" }}>Вход...</div>
    </div>
  );
}
