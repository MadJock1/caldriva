import { afterEach, describe, expect, it, vi } from "vitest";
import { callbackUrl, credentialsSchema } from "./auth-validation";
import { supabaseConfig } from "./supabase/config";
afterEach(() => vi.unstubAllEnvs());
describe("auth configuration boundaries", () => {
  it("disables account access without configuration", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", ""); vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    expect(supabaseConfig()).toBeNull();
  });
  it("rejects secret keys and remote insecure URLs", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_secret_example");
    expect(supabaseConfig()).toBeNull();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_example");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://example.com");
    expect(supabaseConfig()).toBeNull();
  });
  it("uses the configured origin and fixed callback path", () => {
    vi.stubEnv("SITE_URL", "https://example.com/arbitrary"); expect(callbackUrl()).toBe("https://example.com/auth/callback");
    vi.stubEnv("SITE_URL", "javascript:alert(1)"); expect(callbackUrl()).toBeNull();
    vi.stubEnv("SITE_URL", "http://localhost:3000"); expect(callbackUrl()).toBe("http://localhost:3000/auth/callback");
  });
  it("validates credentials without trimming passwords", () => {
    expect(credentialsSchema.safeParse({ email: "not-email", password: "short" }).success).toBe(false);
    expect(credentialsSchema.parse({ email: " alice@example.com ", password: " long password " }).password).toBe(" long password ");
  });
});
