import { createServiceClient } from '@fotosposi/core';
import type { BrandConfig, B2BLead, EngagementTriage, ContentPerformance } from './index';

export async function getBrandConfig(slug: string): Promise<{ config?: BrandConfig; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('brand_config').select('*').eq('slug', slug).single();
  if (error) return { error: error.message };
  return { config: data };
}

export async function recordEngagement(input: {
  brand_id: string;
  platform: string;
  platform_message_id?: string;
  platform_user_id?: string;
  platform_account_id?: string;
  user_name?: string;
  user_profile_url?: string;
  message_text: string;
  language?: string;
  intent?: string;
  risk?: string;
  confidence?: number;
  needs_review?: boolean;
  suggested_auto_reply?: string;
}): Promise<{ record?: EngagementTriage; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('engagement_triage').insert(input).select().single();
  if (error) return { error: error.message };
  return { record: data };
}

export async function getB2BLeads(options?: {
  status?: string;
  category?: string;
  limit?: number;
}): Promise<{ leads?: B2BLead[]; error?: string }> {
  const supabase = createServiceClient();
  let query = supabase.from('b2b_leads').select('*').order('created_at', { ascending: false });
  if (options?.status) query = query.eq('contact_status', options.status);
  if (options?.category) query = query.eq('ai_category', options.category);
  if (options?.limit) query = query.limit(options.limit);
  const { data, error } = await query;
  if (error) return { error: error.message };
  return { leads: data ?? [] };
}

export async function updateLeadStatus(
  leadId: string,
  status: string,
  notes?: string,
): Promise<{ lead?: B2BLead; error?: string }> {
  const supabase = createServiceClient();
  const update: Record<string, unknown> = { contact_status: status };
  if (notes) update.crm_notes = notes;
  const { data, error } = await supabase.from('b2b_leads').update(update).eq('id', leadId).select().single();
  if (error) return { error: error.message };
  return { lead: data };
}

export async function getUGCForPipeline(options?: {
  limit?: number;
  since?: string;
}): Promise<{ ugc?: any[]; error?: string }> {
  const supabase = createServiceClient();
  let query = supabase
    .from('media_uploads')
    .select('id, event_id, file_type, r2_key, metadata, created_at, events(couple_name, date, location)')
    .order('created_at', { ascending: false });
  if (options?.since) query = query.gt('created_at', options.since);
  if (options?.limit) query = query.limit(options.limit);
  else query = query.limit(50);
  const { data, error } = await query;
  if (error) return { error: error.message };
  return { ugc: data ?? [] };
}

export async function recordPerformance(input: {
  brand_id: string;
  content_id?: string;
  platform: string;
  impressions?: number;
  engagements?: number;
  engagement_rate?: number;
  clicks?: number;
  conversions?: number;
  revenue?: number;
  metadata?: Record<string, unknown>;
}): Promise<{ record?: ContentPerformance; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('content_performance').insert(input).select().single();
  if (error) return { error: error.message };
  return { record: data };
}
