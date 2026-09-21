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

export type KaiTemplate = {
  id: string;
  user_id: string;
  name: string;
  original_filename: string;
  storage_path: string;
  mode: "placeholder" | "freeform";
  placeholder_names: string[] | null;
  created_at: string;
};

export type KaiTemplateGeneration = {
  id: string;
  template_id: string;
  user_id: string;
  instruction: string;
  status: "processing" | "ready" | "error";
  output_storage_path: string | null;
  applied_count: number | null;
  skipped: { oldText: string; reason: string }[] | null;
  error_message: string | null;
  created_at: string;
};

export type KaiTest = {
  id: string;
  user_id: string;
  collection_id: string;
  document_id: string | null;
  title: string;
  format: "multiple_choice" | "open_ended";
  question_count: number;
  status: "processing" | "ready" | "error";
  error_message: string | null;
  created_at: string;
};

export type KaiTestQuestion = {
  id: string;
  test_id: string;
  order_index: number;
  question: string;
  options: { key: string; text: string }[] | null;
  correct_answer: string;
  explanation: string | null;
};

export type KaiTestAttempt = {
  id: string;
  test_id: string;
  user_id: string;
  status: "in_progress" | "grading" | "completed";
  score: number | null;
  answers: { question_id: string; user_answer: string; is_correct: boolean; partial?: boolean; feedback?: string }[] | null;
  created_at: string;
  completed_at: string | null;
};
