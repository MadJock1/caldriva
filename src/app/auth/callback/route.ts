import { NextResponse, type NextRequest } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const client = await serverSupabase();
  if (client && code && code.length < 2048) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) {
      const response = NextResponse.redirect(new URL("/dashboard/buildings", request.url));
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }
  }
  return new Response("Confirmation could not be completed. Return to /login and try signing in, or request a new confirmation email from your Supabase administrator.", { status: 400, headers: { "Cache-Control": "private, no-store", "Content-Type": "text/plain; charset=utf-8" } });
}
