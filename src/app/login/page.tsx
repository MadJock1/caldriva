import { AuthForm } from "@/components/forms/auth-form";
import { supabaseConfig } from "@/lib/supabase/config";
export default function LoginPage() { return <AuthForm mode="login" configured={!!supabaseConfig()} />; }
