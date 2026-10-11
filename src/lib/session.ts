import "server-only";
import { serverSupabase } from "@/lib/supabase/server";

export type Outcome<T> = { data: T; error?: never } | { error: string; data?: never };

export async function authenticatedSession() {
  const client = await serverSupabase();
  if (!client) return null;
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return { client, userId: data.user.id };
}