import { createServiceClient } from '@fotosposi/core';

export interface MarketplaceSupplier {
  id: string;
  name: string;
  category: string;
  description: string | null;
  city: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  approved: boolean;
  slug: string | null;
  photo_url: string | null;
  discount_offer: string | null;
  is_partner: boolean;
  qr_scan_count: number;
  confirmed_sales: number;
  lat: number | null;
  lng: number | null;
  affiliate_link: string | null;
  commission_info: string | null;
  created_at: string;
}

export interface PartnerVisit {
  id: string;
  supplier_id: string;
  event_id: string | null;
  user_id: string | null;
  source: string;
  confirmed: boolean;
  created_at: string;
}

export interface MarketplaceReview {
  id: string;
  supplier_id: string;
  event_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export async function getSuppliers(category?: string): Promise<{ suppliers?: MarketplaceSupplier[]; error?: string }> {
  const supabase = createServiceClient();
  let query = supabase.from('marketplace_suppliers').select('*').eq('approved', true).order('name');
  if (category) query = query.eq('category', category);
  const { data, error } = await query;
  if (error) return { error: error.message };
  return { suppliers: data ?? [] };
}

export async function getSupplierById(id: string): Promise<{ supplier?: MarketplaceSupplier; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('marketplace_suppliers').select('*').eq('id', id).single();
  if (error) return { error: error.message };
  return { supplier: data };
}

export async function createReview(params: { supplier_id: string; event_id: string; rating: number; comment?: string }): Promise<{ error?: string }> {
  const supabase = createServiceClient();
  const { error } = await supabase.from('marketplace_reviews').insert(params);
  if (error) return { error: error.message };
  return {};
}

export async function getReviews(supplierId: string): Promise<{ reviews?: MarketplaceReview[]; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('marketplace_reviews').select('*').eq('supplier_id', supplierId).order('created_at', { ascending: false });
  if (error) return { error: error.message };
  return { reviews: data ?? [] };
}

export async function getAvgRating(supplierId: string): Promise<{ avg: number; count: number }> {
  const supabase = createServiceClient();
  const { data } = await supabase.from('marketplace_reviews').select('rating').eq('supplier_id', supplierId);
  const ratings = (data ?? []).map((r: any) => r.rating);
  if (ratings.length === 0) return { avg: 0, count: 0 };
  return { avg: ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length, count: ratings.length };
}

export async function getAllSuppliers(): Promise<{ suppliers?: MarketplaceSupplier[]; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('marketplace_suppliers').select('*').order('created_at', { ascending: false });
  if (error) return { error: error.message };
  return { suppliers: data ?? [] };
}

export async function approveSupplier(id: string, approved: boolean): Promise<{ error?: string }> {
  const supabase = createServiceClient();
  const { error } = await supabase.from('marketplace_suppliers').update({ approved }).eq('id', id);
  if (error) return { error: error.message };
  return {};
}

export async function deleteSupplier(id: string): Promise<{ error?: string }> {
  const supabase = createServiceClient();
  const { error } = await supabase.from('marketplace_suppliers').delete().eq('id', id);
  if (error) return { error: error.message };
  return {};
}

export async function getPartnerBySlug(slug: string): Promise<{ supplier?: MarketplaceSupplier; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('marketplace_suppliers').select('*').eq('slug', slug).eq('is_partner', true).eq('approved', true).single();
  if (error) return { error: error.message };
  return { supplier: data };
}

export async function getPartners(category?: string): Promise<{ suppliers?: MarketplaceSupplier[]; error?: string }> {
  const supabase = createServiceClient();
  let query = supabase.from('marketplace_suppliers').select('*').eq('is_partner', true).eq('approved', true).order('name');
  if (category) query = query.eq('category', category);
  const { data, error } = await query;
  if (error) return { error: error.message };
  return { suppliers: data ?? [] };
}

export async function logPartnerVisit(params: {
  supplier_id: string;
  event_id?: string;
  user_id?: string;
  source?: string;
}): Promise<{ visit?: PartnerVisit; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('partner_visits').insert({
    supplier_id: params.supplier_id,
    event_id: params.event_id ?? null,
    user_id: params.user_id ?? null,
    source: params.source ?? 'qr',
  }).select().single();
  if (error) return { error: error.message };

  await supabase.rpc('increment_partner_qr', { supplier_id: params.supplier_id });

  return { visit: data };
}

export async function confirmPartnerSale(visitId: string): Promise<{ error?: string }> {
  const supabase = createServiceClient();
  const { data: visit } = await supabase.from('partner_visits').select('supplier_id').eq('id', visitId).single();
  if (!visit) return { error: 'Visita non trovata' };
  await supabase.from('partner_visits').update({ confirmed: true }).eq('id', visitId);
  await supabase.rpc('increment_partner_sales', { supplier_id: visit.supplier_id });
  return {};
}

export async function getPartnerVisits(supplierId: string): Promise<{ visits?: PartnerVisit[]; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('partner_visits').select('*').eq('supplier_id', supplierId).order('created_at', { ascending: false });
  if (error) return { error: error.message };
  return { visits: data ?? [] };
}
