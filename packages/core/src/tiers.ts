import { createServiceClient } from './supabase';

export type Tier = 'free' | 'premium' | 'deluxe';

export interface TierInfo {
  key: Tier;
  label: string;
  price: number;
  description: string;
}

export const TIERS: Record<Tier, TierInfo> = {
  free: { key: 'free', label: 'Free', price: 0, description: 'Base gratis' },
  premium: { key: 'premium', label: 'Premium', price: 199, description: 'Servizio Premium' },
  deluxe: { key: 'deluxe', label: 'Deluxe', price: 350, description: 'Full Experience' },
};

const TIER_ORDER: Tier[] = ['free', 'premium', 'deluxe'];

function tierIndex(tier: Tier): number {
  return TIER_ORDER.indexOf(tier);
}

export function hasFeature(tier: Tier, featureKey: string): boolean {
  const requirements: Record<string, Tier> = {
    photo_vote: 'free',
    wall: 'free',
    drive_backup: 'free',
    photo_hunt: 'premium',
    quiz: 'premium',
    dress_vote: 'premium',
    video_guestbook: 'premium',
    photo_overlay: 'premium',
    wedding_wrapped: 'premium',
    kiosk: 'deluxe',
    wow_walk: 'deluxe',
    video_challenges: 'deluxe',
    ai_concierge: 'deluxe',
    reel_riassunto: 'deluxe',
  };
  const required = requirements[featureKey];
  if (!required) return true;
  return tierIndex(tier) >= tierIndex(required);
}

export async function getEventTier(eventId: string): Promise<{ tier?: Tier; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('events')
    .select('tier')
    .eq('id', eventId)
    .single();
  if (error) return { error: error.message };
  return { tier: data.tier as Tier };
}

export async function updateEventTier(eventId: string, tier: Tier): Promise<{ error?: string }> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('events')
    .update({ tier })
    .eq('id', eventId);
  if (error) return { error: error.message };
  return {};
}
