export type UserRole = 'sposo' | 'organizzatore' | 'invitato' | 'manager' | 'admin';

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

export {
  createClient,
  createServerSideClient,
  createServiceClient,
} from './supabase';

export {
  signUp,
  signIn,
  signOut,
  getCurrentUser,
  signInWithOAuth,
  validateQrToken,
  createQrToken,
  requestPasswordReset,
  updatePassword,
} from './auth';

export {
  generateChat,
  generateText,
} from './ai';

export {
  getEventTier,
  updateEventTier,
  hasFeature,
} from './tiers';
export type { Tier, TierInfo } from './tiers';
export { TIERS } from './tiers';

export { rateLimit } from './rate-limit';

export {
  getEventGuests,
  updateGuestStatus,
  registerGuest,
  updateGuestApprovalMode,
  getEventById,
} from './guests';
export type { EventGuest } from './guests';
