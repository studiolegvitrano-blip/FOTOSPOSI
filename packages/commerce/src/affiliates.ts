import { createServiceClient } from '@fotosposi/core';

export interface Coupon {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  applicable_tiers: string[];
  min_quantity: number;
  max_uses: number | null;
  current_uses: number;
  expires_at: string | null;
  affiliate_id: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface Affiliate {
  id: string;
  name: string;
  email: string;
  role: string | null;
  company: string | null;
  commission_rate: number;
  coupon_code: string | null;
  total_referrals: number;
  total_commission: number;
  paid_commission: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface Referral {
  id: string;
  affiliate_id: string | null;
  coupon_id: string | null;
  event_id: string | null;
  order_id: string | null;
  tier_acquistato: string | null;
  coupon_code: string | null;
  sconto_coupon: number | null;
  commission_amount: number | null;
  status: 'pending' | 'converted' | 'paid' | 'cancelled';
  created_at: string;
}

export async function listCoupons(): Promise<{ coupons?: Coupon[]; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
  if (error) return { error: error.message };
  return { coupons: data ?? [] };
}

export async function getCoupon(code: string): Promise<{ coupon?: Coupon; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('coupons').select('*').eq('code', code).single();
  if (error) return { error: error.message };
  return { coupon: data };
}

export async function createCoupon(params: {
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  applicable_tiers?: string[];
  min_quantity?: number;
  max_uses?: number;
  expires_at?: string;
  affiliate_id?: string;
  created_by?: string;
}): Promise<{ coupon?: Coupon; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('coupons')
    .insert({
      code: params.code.toUpperCase(),
      discount_type: params.discount_type,
      discount_value: params.discount_value,
      applicable_tiers: params.applicable_tiers ?? ['premium', 'deluxe'],
      min_quantity: params.min_quantity ?? 1,
      max_uses: params.max_uses ?? null,
      expires_at: params.expires_at ?? null,
      affiliate_id: params.affiliate_id ?? null,
      created_by: params.created_by ?? null,
    })
    .select()
    .single();
  if (error) return { error: error.message };
  return { coupon: data };
}

export async function validateCoupon(code: string, tier?: string): Promise<{
  valid: boolean;
  coupon?: Coupon;
  error?: string;
  discount_label?: string;
}> {
  const { coupon, error } = await getCoupon(code.toUpperCase());
  if (error || !coupon) return { valid: false, error: 'Codice non valido' };
  if (!coupon.is_active) return { valid: false, error: 'Coupon disattivato' };
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) return { valid: false, error: 'Coupon scaduto' };
  if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) return { valid: false, error: 'Coupon esaurito' };
  if (tier && !coupon.applicable_tiers.includes(tier)) return { valid: false, error: 'Coupon non valido per questo piano' };
  const label = coupon.discount_type === 'percentage'
    ? `${coupon.discount_value}% di sconto`
    : `${coupon.discount_value}€ di sconto`;
  return { valid: true, coupon, discount_label: label };
}

export async function applyCoupon(code: string, basePrice: number): Promise<{
  success: boolean;
  finalPrice?: number;
  discount?: number;
  coupon?: Coupon;
  error?: string;
}> {
  const { valid, coupon, error } = await validateCoupon(code);
  if (!valid || !coupon) return { success: false, error: error ?? 'Coupon non valido' };
  let discount = coupon.discount_type === 'percentage'
    ? Math.round(basePrice * (coupon.discount_value / 100) * 100) / 100
    : coupon.discount_value;
  if (discount > basePrice) discount = basePrice;
  const finalPrice = Math.round((basePrice - discount) * 100) / 100;

  const supabase = createServiceClient();
  await supabase.from('coupons').update({ current_uses: coupon.current_uses + 1 }).eq('id', coupon.id);

  return { success: true, finalPrice, discount, coupon };
}

export async function listAffiliates(): Promise<{ affiliates?: Affiliate[]; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('affiliates').select('*').order('created_at', { ascending: false });
  if (error) return { error: error.message };
  return { affiliates: data ?? [] };
}

export async function createAffiliate(params: {
  name: string;
  email: string;
  role?: string;
  company?: string;
  commission_rate?: number;
  coupon_code?: string;
  created_by?: string;
}): Promise<{ affiliate?: Affiliate; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('affiliates')
    .insert({
      name: params.name,
      email: params.email,
      role: params.role ?? null,
      company: params.company ?? null,
      commission_rate: params.commission_rate ?? 10,
      coupon_code: params.coupon_code ?? null,
      created_by: params.created_by ?? null,
    })
    .select()
    .single();
  if (error) return { error: error.message };
  return { affiliate: data };
}

export async function createReferral(params: {
  affiliate_id: string;
  coupon_id: string;
  event_id?: string;
  order_id?: string;
  tier_acquistato?: string;
  coupon_code?: string;
  sconto_coupon?: number;
  commission_amount?: number;
}): Promise<{ referral?: Referral; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('referrals')
    .insert({
      affiliate_id: params.affiliate_id,
      coupon_id: params.coupon_id,
      event_id: params.event_id ?? null,
      order_id: params.order_id ?? null,
      tier_acquistato: params.tier_acquistato ?? null,
      coupon_code: params.coupon_code ?? null,
      sconto_coupon: params.sconto_coupon ?? null,
      commission_amount: params.commission_amount ?? null,
      status: 'pending',
    })
    .select()
    .single();
  if (error) return { error: error.message };
  return { referral: data };
}

export async function getReferrals(affiliateId: string): Promise<{ referrals?: Referral[]; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('referrals')
    .select('*')
    .eq('affiliate_id', affiliateId)
    .order('created_at', { ascending: false });
  if (error) return { error: error.message };
  return { referrals: data ?? [] };
}

export function calculateVolumePrice(basePrice: number, quantity: number): {
  unitPrice: number;
  total: number;
  freeLicenses: number;
  discountPercent: number;
} {
  if (quantity >= 12) {
    return {
      unitPrice: basePrice * 0.5,
      total: Math.round(quantity * basePrice * 0.5 * 100) / 100,
      freeLicenses: 1,
      discountPercent: 50,
    };
  }
  if (quantity >= 6) {
    return {
      unitPrice: basePrice * 0.5,
      total: Math.round(quantity * basePrice * 0.5 * 100) / 100,
      freeLicenses: 0,
      discountPercent: 50,
    };
  }
  return {
    unitPrice: basePrice,
    total: Math.round(quantity * basePrice * 100) / 100,
    freeLicenses: 0,
    discountPercent: 0,
  };
}
