"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

export function useAuth(redirect = true) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const resolved = useRef(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      resolved.current = true;

      if (!session?.user && redirect) {
        router.push("/login");
      }
    });

    // Fallback if onAuthStateChange is slow (e.g. first load)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!resolved.current) {
        setUser(session?.user ?? null);
        setLoading(false);
        if (!session?.user && redirect) {
          router.push("/login");
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return { user, loading, signOut };
}
