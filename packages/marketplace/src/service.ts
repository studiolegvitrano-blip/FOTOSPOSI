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
  account_type: 'commerciale' | 'privato';
  full_name: string | null;
  business_name: string | null;
  address: string | null;
  vat_number: string | null;
  region: string | null;
  country: string;
  instagram: string | null;
  years_experience: number | null;
  pricing_from: number | null;
  agreed_terms: boolean;
  marketing_consent: boolean;
  submitted_at: string;
  submission_source: string;
  created_at: string;
}

export type SupplierAccountType = 'commerciale' | 'privato';

export const SUPPLIER_CATEGORIES = [
  'fotografo',
  'video',
  'catering',
  'location',
  'fiori',
  'musica',
  'abiti',
  'torte',
  'parrucchiere',
  'estetista',
  'makeup',
  'autonoleggio',
  'wedding_planner',
  'animazione',
  'servizio_consigliato',
  'altro',
] as const;
export type SupplierCategory = typeof SUPPLIER_CATEGORIES[number];

export interface SubmitSupplierApplicationParams {
  account_type: SupplierAccountType;
  category: SupplierCategory;
  full_name?: string | null;
  business_name?: string | null;
  email: string;
  phone?: string | null;
  address?: string | null;
  vat_number?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string;
  website?: string | null;
  instagram?: string | null;
  description?: string | null;
  years_experience?: number | null;
  pricing_from?: number | null;
  agreed_terms: boolean;
  marketing_consent: boolean;
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

export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function getPartnerVisits(supplierId: string): Promise<{ visits?: PartnerVisit[]; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('partner_visits').select('*').eq('supplier_id', supplierId).order('created_at', { ascending: false });
  if (error) return { error: error.message };
  return { visits: data ?? [] };
}

export async function submitSupplierApplication(
  params: SubmitSupplierApplicationParams
): Promise<{ id?: string; error?: string }> {
  if (!params.agreed_terms) return { error: 'Devi accettare i termini di servizio e la privacy policy.' };
  if (!params.email || !params.email.includes('@')) return { error: 'Email non valida.' };
  if (!params.category || !SUPPLIER_CATEGORIES.includes(params.category as SupplierCategory)) {
    return { error: 'Categoria non valida.' };
  }
  if (!params.full_name && !params.business_name) {
    return { error: 'Inserisci almeno il nome e cognome o il nome azienda.' };
  }

  const displayName = (params.business_name || params.full_name || '').trim();
  if (!displayName) return { error: 'Nome visualizzato mancante.' };

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('marketplace_suppliers')
    .insert({
      name: displayName,
      category: params.category,
      description: params.description?.slice(0, 2000) ?? null,
      city: params.city?.trim() || null,
      website: params.website?.trim() || null,
      email: params.email.trim().toLowerCase(),
      phone: params.phone?.trim() || null,
      address: params.address?.trim() || null,
      vat_number: params.vat_number?.trim() || null,
      approved: false,
      is_partner: false,
      account_type: params.account_type,
      full_name: params.full_name?.trim() || null,
      business_name: params.business_name?.trim() || null,
      region: params.region?.trim() || null,
      country: params.country?.trim() || 'IT',
      instagram: params.instagram?.trim() || null,
      years_experience: Number.isFinite(params.years_experience) ? Number(params.years_experience) : null,
      pricing_from: Number.isFinite(params.pricing_from) ? Number(params.pricing_from) : null,
      agreed_terms: true,
      marketing_consent: !!params.marketing_consent,
      submission_source: 'public_form',
    })
    .select('id')
    .single();

  if (error) return { error: error.message };
  return { id: data?.id };
}
