export type UserRole = 'sposo' | 'organizzatore' | 'invitato' | 'admin';

export interface CoreUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tenant_id: string;
  event_id: string | null;
  created_at: string;
}

export interface AuthToken {
  id: string;
  event_id: string;
  token: string;
  expires_at: string;
  role: UserRole;
  created_at: string;
}

export interface Tenant {
  id: string;
  brand: 'fotosposi' | 'weddingmoments';
  locale: string;
  name: string;
  created_at: string;
}

export function createSupabaseClient(supabaseUrl: string, supabaseAnonKey: string) {
  const { createClient } = require('@supabase/supabase-js');
  return createClient(supabaseUrl, supabaseAnonKey);
}
