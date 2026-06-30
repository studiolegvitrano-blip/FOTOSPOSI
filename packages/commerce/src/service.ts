import { createServiceClient } from '@fotosposi/core';
import type { Product, Order, GiftRegistryTransaction } from './index';

export async function listProducts(type?: string): Promise<{ products?: Product[]; error?: string }> {
  const supabase = createServiceClient();
  let query = supabase.from('products').select('*').order('created_at', { ascending: false });
  if (type) query = query.eq('type', type);
  const { data, error } = await query;
  if (error) return { error: error.message };
  return { products: data ?? [] };
}

export async function getProduct(productId: string): Promise<{ product?: Product; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('products').select('*').eq('id', productId).single();
  if (error) return { error: error.message };
  return { product: data };
}

export async function createOrder(params: {
  event_id: string;
  user_id: string;
  total: number;
  currency?: string;
}): Promise<{ order?: Order; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('orders')
    .insert({
      event_id: params.event_id,
      user_id: params.user_id,
      total: params.total,
      currency: params.currency ?? 'EUR',
      status: 'pending',
    })
    .select()
    .single();
  if (error) return { error: error.message };
  return { order: data };
}

export async function getOrdersByEvent(eventId: string): Promise<{ orders?: Order[]; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });
  if (error) return { error: error.message };
  return { orders: data ?? [] };
}

export async function updateOrderStatus(
  orderId: string,
  status: Order['status'],
  stripePaymentIntent?: string,
): Promise<{ error?: string }> {
  const supabase = createServiceClient();
  const update: Record<string, unknown> = { status };
  if (stripePaymentIntent) update.stripe_payment_intent = stripePaymentIntent;
  const { error } = await supabase.from('orders').update(update).eq('id', orderId);
  if (error) return { error: error.message };
  return {};
}

export async function createCheckoutSession(params: {
  productId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url?: string; error?: string }> {
  const { product, error: prodError } = await getProduct(params.productId);
  if (prodError || !product) return { error: prodError ?? 'Prodotto non trovato' };

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return { error: 'Stripe non configurato' };

  try {
    const stripe = await import('stripe');
    const client = new stripe.default(stripeKey, { apiVersion: '2025-02-24.acacia' as any });

    const session = await client.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: product.currency.toLowerCase(),
            product_data: { name: product.name, description: product.description ?? undefined },
            unit_amount: product.price,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    });

    return { url: session.url ?? undefined };
  } catch (err) {
    return { error: String(err) };
  }
}

export async function createGiftTransaction(params: {
  event_id: string;
  from_user: string;
  amount: number;
  currency?: string;
  message?: string;
}): Promise<{ transaction?: GiftRegistryTransaction; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('gift_registry_transactions')
    .insert({
      event_id: params.event_id,
      from_user: params.from_user,
      amount: params.amount,
      currency: params.currency ?? 'EUR',
      message: params.message ?? null,
    })
    .select()
    .single();
  if (error) return { error: error.message };
  return { transaction: data };
}

export async function getGiftTransactions(eventId: string): Promise<{
  transactions?: GiftRegistryTransaction[];
  total?: number;
  error?: string;
}> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('gift_registry_transactions')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });
  if (error) return { error: error.message };
  const items = data ?? [];
  const total = items.reduce((sum: number, t: GiftRegistryTransaction) => sum + t.amount, 0);
  return { transactions: items, total };
}

export async function createGiftCheckoutSession(params: {
  event_id: string;
  from_name: string;
  amount: number;
  message?: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url?: string; error?: string }> {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return { error: 'Stripe non configurato' };

  try {
    const stripe = await import('stripe');
    const client = new stripe.default(stripeKey, { apiVersion: '2025-02-24.acacia' as any });

    const session = await client.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: { name: 'Regalo di nozze' },
            unit_amount: Math.round(params.amount * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: {
        event_id: params.event_id,
        from_name: params.from_name,
        message: params.message ?? '',
        type: 'gift_registry',
      },
    });

    return { url: session.url ?? undefined };
  } catch (err) {
    return { error: String(err) };
  }
}
