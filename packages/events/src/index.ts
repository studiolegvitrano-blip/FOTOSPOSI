import type { Tier } from '@fotosposi/core';

export type SubEventType = 'addio_celibato' | 'matrimonio' | 'brunch' | 'cena_prova';

export interface WeddingEvent {
  id: string;
  tenant_id: string;
  created_by: string;
  couple_name: string;
  date: string;
  location: string;
  church?: string;
  church_city?: string;
  venue?: string;
  venue_city?: string;
  brand: 'fotosposi' | 'weddingmoments';
  tier: Tier;
  created_at: string;
  code?: string;
  hashtag?: string;
}

export interface SubEvent {
  id: string;
  event_id: string;
  type: SubEventType;
  title: string;
  date: string;
  location: string;
  created_at: string;
}

export interface EventWindow {
  id: string;
  event_id: string;
  opens_at: string;
  closes_at: string;
  created_at: string;
}

export function calculateWindow(eventDate: string): { opens_at: string; closes_at: string } {
  const event = new Date(eventDate);
  const opens = new Date(event);
  opens.setDate(opens.getDate() - 18);
  const closes = new Date(event);
  closes.setDate(closes.getDate() + 2);
  return {
    opens_at: opens.toISOString(),
    closes_at: closes.toISOString(),
  };
}

export {
  createEvent,
  getEventById,
  getEventByCode,
  getEventsByUser,
  createSubEvent,
  getSubEvents,
  getEventWindow,
} from './service';
