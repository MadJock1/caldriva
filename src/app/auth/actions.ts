"use server";
import { redirect } from "next/navigation";
import { serverSupabase } from "@/lib/supabase/server";
import { credentialsSchema, callbackUrl } from "@/lib/auth-validation";

export type AuthState = { message: string; error?: boolean };
export async function authenticate(mode: "login" | "register", _previous: AuthState, form: FormData): Promise<AuthState> {
  const client = await serverSupabase();
  if (!client) return { message: "Account access is not configured. You can still use the local studio.", error: true };
  const parsed = credentialsSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { message: "Enter a valid email and a password of 12–128 characters.", error: true };
  if (mode !== "login" && mode !== "register") return { message: "Invalid request.", error: true };
  if (mode === "register") {
    const emailRedirectTo = callbackUrl();
    if (!emailRedirectTo) return { message: "The account confirmation URL is not configured. Please try again later.", error: true };
    const { error } = await client.auth.signUp({ ...parsed.data, options: { emailRedirectTo } });
    if (error) return { message: "Registration could not be completed. Please check the details or try again later.", error: true };
    return { message: "If registration is available for this email, check your inbox to confirm your account. You can then sign in." };
  }
  const { error } = await client.auth.signInWithPassword(parsed.data);
  if (error) return { message: "Unable to sign in. Check your credentials and email confirmation, or try again later.", error: true };
  redirect("/dashboard/buildings");
}
export async function signOut() {
  const client = await serverSupabase();
  if (client) {
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) throw new Error("Sign out failed. Please retry.");
  }
  redirect("/login");
}
