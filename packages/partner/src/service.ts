import { createServiceClient } from '@fotosposi/core';
import { calculateVolumePrice } from '@fotosposi/commerce';

export interface Partner {
  id: string;
  user_id: string | null;
  affiliate_id: string | null;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  logo_url: string | null;
  claim_text: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PartnerBranding {
  partnerId: string;
  name: string;
  logo_url: string | null;
  claim_text: string | null;
  website: string | null;
  address: string | null;
}

export interface PartnerCode {
  id: string;
  partner_id: string;
  code: string;
  package_size: number;
  status: 'available' | 'used' | 'revoked';
  redeemed_event_id: string | null;
  created_at: string;
  redeemed_at: string | null;
}

export type Tier = 'premium' | 'deluxe';

export interface PartnerPackagePrice {
  tier: Tier;
  quantity: number;
  unitPrice: number;
  total: number;
  freeLicenses: number;
  discountPercent: number;
}

/**
 * Prezzo pacchetto licenze: stessa regola a volume degli affiliates
 * (calculateVolumePrice): >=6 → -50%, >=12 → -50% + 1 licenza gratis.
 * Base = prezzo tier annuale (premium 199, deluxe 350 come in core TIERS).
 */
export function getPartnerPackagePrice(tier: Tier, quantity: number): PartnerPackagePrice {
  const base = tier === 'premium' ? 199 : 350;
  const vol = calculateVolumePrice(base, quantity);
  return {
    tier,
    quantity,
    unitPrice: vol.unitPrice,
    total: vol.total,
    freeLicenses: vol.freeLicenses,
    discountPercent: vol.discountPercent,
  };
}

/** Profilo partner per l'utente auth corrente (core_users.id = auth.uid()). */
export async function getPartnerByUserId(userId: string): Promise<{ partner?: Partner; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('partners')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return { error: error.message };
  return { partner: (data as Partner) ?? undefined };
}

/** Profilo partner per email (match anagrafica, usato al signup per il link affiliates). */
export async function getPartnerByEmail(email: string): Promise<{ partner?: Partner; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('partners')
    .select('*')
    .ilike('email', email.trim())
    .maybeSingle();
  if (error) return { error: error.message };
  return { partner: (data as Partner) ?? undefined };
}

export async function createPartnerProfile(params: {
  userId: string;
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
}): Promise<{ partner?: Partner; error?: string }> {
  const supabase = createServiceClient();

  // Link automatico a un collaboratore esistente (affiliates) con la stessa email:
  // il partner accede con lo stesso account e il portale vede le sue commissioni.
  let affiliateId: string | null = null;
  if (params.email) {
    const { data: aff } = await supabase
      .from('affiliates')
      .select('id')
      .ilike('email', params.email.trim())
      .maybeSingle();
    if (aff) affiliateId = aff.id as string;
  }

  const { data, error } = await supabase
    .from('partners')
    .insert({
      user_id: params.userId,
      name: params.name,
      company: params.company ?? null,
      email: params.email?.trim() ?? null,
      phone: params.phone ?? null,
      website: params.website ?? null,
      address: params.address ?? null,
      affiliate_id: affiliateId,
    })
    .select()
    .single();
  if (error) return { error: error.message };
  return { partner: data as Partner };
}

export async function updatePartnerProfile(
  userId: string,
  fields: Partial<Pick<Partner, 'name' | 'company' | 'phone' | 'website' | 'address' | 'logo_url' | 'claim_text'>>,
): Promise<{ partner?: Partner; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('partners')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select()
    .maybeSingle();
  if (error) return { error: error.message };
  return { partner: (data as Partner) ?? undefined };
}

/**
 * Branding white label di un evento: partner che lo sponsorizza, logo, claim.
 * Usato da process-queue (watermark), countdown e pagine pubbliche.
 */
export async function getEventPartner(eventId: string): Promise<{ partner?: PartnerBranding; error?: string }> {
  const supabase = createServiceClient();
  const { data: event, error: evErr } = await supabase
    .from('events')
    .select('partner_id, partner_claim_text')
    .eq('id', eventId)
    .maybeSingle();
  if (evErr) return { error: evErr.message };
  if (!event?.partner_id) return {};

  const { data: partner, error: pErr } = await supabase
    .from('partners')
    .select('id, name, logo_url, claim_text, website, address, is_active')
    .eq('id', event.partner_id)
    .maybeSingle();
  if (pErr) return { error: pErr.message };
  if (!partner || !partner.is_active) return {};

  return {
    partner: {
      partnerId: partner.id,
      name: partner.name,
      logo_url: partner.logo_url,
      claim_text: (event.partner_claim_text ?? partner.claim_text ?? null) as string | null,
      website: partner.website,
      address: partner.address,
    },
  };
}

/** L'evento è white label (sponsorizzato da un partner attivo)? */
export async function isPartnerEvent(eventId: string): Promise<boolean> {
  const { partner } = await getEventPartner(eventId);
  return !!partner;
}
