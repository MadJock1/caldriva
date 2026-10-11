"use client";
import { useActionState } from "react";
import Link from "next/link";
import { authenticate, type AuthState } from "@/app/auth/actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";

export function AuthForm({ mode, configured }: { mode: "login" | "register"; configured: boolean }) {
  const [state, action, pending] = useActionState(authenticate.bind(null, mode), { message: "" } as AuthState);
  return <section className="container max-w-lg py-20"><Logo variant="stacked" size="lg" className="mb-10" /><h1 className="text-4xl font-semibold">{mode === "login" ? "Welcome back" : "Create your account"}</h1><p className="mt-4 text-text-muted">Save building drafts across devices. Solar calculations remain available without an account.</p>{!configured ? <p role="status" className="mt-8 border rounded-xl p-5 bg-surface">Account access is not configured on this installation. Use the local studio, or configure Supabase to enable accounts.</p> : <form action={action} className="grid gap-5 mt-8"><Input label="Email" name="email" type="email" autoComplete="email" required maxLength={254} /><Input label="Password" name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={12} maxLength={128} required helperText="12–128 characters" /><Button type="submit" loading={pending}>{mode === "login" ? "Sign in" : "Register"}</Button><p role={state.error ? "alert" : "status"} aria-live="polite">{state.message}</p></form>}<nav className="mt-7 flex flex-wrap gap-5 text-sm"><Link className="underline" href={mode === "login" ? "/register" : "/login"}>{mode === "login" ? "Create account" : "Sign in"}</Link><Link className="underline" href="/tools/solar">Continue without an account</Link></nav></section>;
}
