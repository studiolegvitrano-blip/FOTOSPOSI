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
