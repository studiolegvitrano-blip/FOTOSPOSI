import { createBrowserClient } from '@supabase/ssr';
import { createServerClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

export function createServerSideClient(getAll: () => Promise<{ name: string; value: string }[] | null> | { name: string; value: string }[] | null, setAll?: (cookies: { name: string; value: string; options: Record<string, unknown> }[]) => Promise<void> | void) {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: { getAll, setAll },
  });
}

export function createServiceClient() {
  const { createClient } = require('@supabase/supabase-js');
  return createClient(supabaseUrl, supabaseServiceKey);
}
