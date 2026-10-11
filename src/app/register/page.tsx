import { AuthForm } from "@/components/forms/auth-form";
import { supabaseConfig } from "@/lib/supabase/config";
export default function RegisterPage() { return <AuthForm mode="register" configured={!!supabaseConfig()} />; }
