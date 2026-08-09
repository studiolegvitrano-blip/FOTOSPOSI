export type ProductType = 'stampa' | 'gadget' | 'maglietta' | 'album';

export interface Product {
  id: string;
  name: string;
  description: string | null;
  type: ProductType;
  price: number;
  currency: string;
  image_url: string | null;
  gelato_product_id: string | null;
  created_at: string;
}

export interface Order {
  id: string;
  event_id: string | null;
  user_id: string;
  total: number;
  currency: string;
  status: 'pending' | 'paid' | 'fulfilled' | 'cancelled';
  payment_method: 'stripe' | 'iban';
  payment_reference: string | null;
  metadata: Record<string, unknown> | null;
  stripe_payment_intent: string | null;
  created_at: string;
}

/** Coordinate bonifico lette da platform_settings (chiavi iban_*). */
export interface IbanDetails {
  iban: string;
  holder: string;
  bank: string;
}

export interface GiftRegistryTransaction {
  id: string;
  event_id: string;
  from_user: string;
  amount: number;
  currency: string;
  message: string | null;
  stripe_transfer_id: string | null;
  created_at: string;
}

export {
  listProducts,
  getProduct,
  createOrder,
  getOrdersByEvent,
  updateOrderStatus,
  createCheckoutSession,
  getIbanDetails,
  createIbanOrder,
  listPendingIbanOrders,
  createGiftTransaction,
  getGiftTransactions,
  createGiftCheckoutSession,
} from './service';

export type { Coupon, Affiliate, Referral } from './affiliates';
export {
  listCoupons,
  getCoupon,
  createCoupon,
  validateCoupon,
  applyCoupon,
  listAffiliates,
  createAffiliate,
  createReferral,
  getReferrals,
  calculateVolumePrice,
} from './affiliates';
