import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, key);

export type KaiCollection = {
  id: string;
  user_id: string;
  name: string;
  emoji: string;
  color: string;
  description: string;
  created_at: string;
};

export type KaiDocument = {
  id: string;
  collection_id: string;
  user_id: string | null;
  name: string;
  type: string | null;
  size: number | null;
  status: "uploaded" | "processing" | "ready" | "error";
  error_message: string | null;
  processed_at: string | null;
  created_at: string;
};
