export type SubEventType = 'addio_celibato' | 'matrimonio' | 'brunch' | 'cena_prova';

export interface WeddingEvent {
  id: string;
  tenant_id: string;
  created_by: string;
  couple_name: string;
  date: string;
  location: string;
  brand: 'fotosposi' | 'weddingmoments';
  tier: 'base' | 'premium' | 'destination';
  created_at: string;
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
  opens.setDate(opens.getDate() - 9);
  const closes = new Date(event);
  closes.setDate(closes.getDate() + 1);
  return {
    opens_at: opens.toISOString(),
    closes_at: closes.toISOString(),
  };
}

export {
  createEvent,
  getEventById,
  getEventsByUser,
  createSubEvent,
  getSubEvents,
  getEventWindow,
} from './service';
