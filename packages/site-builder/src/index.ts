export interface SiteTemplate {
  id: string;
  name: string;
  palette: string[];
  font_family: string;
  preview_url: string;
  created_at: string;
}

export interface SiteContent {
  announcement?: string;
  coupleNames?: string;
  date?: string;
  time?: string;
  countdownEnabled?: boolean;
  ceremonyEnabled?: boolean;
  ceremonyTitle?: string;
  ceremonyAddress?: string;
  ceremonyTime?: string;
  ceremonyNote?: string;
  receptionEnabled?: boolean;
  receptionTitle?: string;
  receptionAddress?: string;
  receptionTime?: string;
  receptionNote?: string;
  storyEnabled?: boolean;
  storyTitle?: string;
  storyBody?: string;
  storyPhotoUrl?: string;
  galleryEnabled?: boolean;
  registryEnabled?: boolean;
  registryText?: string;
  registryIban?: string;
  registryBank?: string;
  registryIntestatario?: string;
  registryLink?: string;
  rsvpEnabled?: boolean;
  rsvpEmail?: string;
  rsvpPhone?: string;
  rsvpDeadline?: string;
  rsvpMessage?: string;
  dressCodeEnabled?: boolean;
  dressCodeText?: string;
  menuEnabled?: boolean;
  menuText?: string;
  hotelsEnabled?: boolean;
  hotelsText?: string;
  playlistEnabled?: boolean;
  playlistLink?: string;
  hashtagEnabled?: boolean;
  hashtag?: string;
}

export interface SiteDraft {
  id: string;
  event_id: string;
  template_id: string | null;
  content: SiteContent | Record<string, string>;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export interface AiGeneratedText {
  id: string;
  event_id: string;
  prompt: string;
  generated: string;
  section: string;
  created_at: string;
}

export function generateIcsLink(date: string, time: string, title: string, address: string, note: string): string {
  const [y, m, d] = date.split('-');
  const [hh, mi] = (time || '12:00').split(':');
  const start = `${y}${m}${d}T${hh}${mi}00`;
  const endH = String(Number(hh) + 2).padStart(2, '0');
  const end = `${y}${m}${d}T${endH}${mi}00`;
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${note || ''}`,
    `LOCATION:${address || ''}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\n');
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

export const SUGGESTED_PHRASES = {
  announcement: [
    'Vi annunciano il loro matrimonio',
    'Con gioia vi invitano al loro matrimonio',
    'Vi aspettano per celebrare il loro amore',
    'Hanno deciso di dirsi SI',
    'Con immenso amore vi invitano',
  ],
  storyTitle: [
    'Come tutto è iniziato',
    'La nostra storia',
    'Quando ci siamo incontrati',
    'Il nostro viaggio insieme',
    'Dal primo sguardo al SI',
  ],
  ceremonyNote: [
    'La cerimonia si terrà presso la chiesa...',
    'Vi aspettiamo per celebrare insieme questo momento speciale',
    'Il rito sarà celebrato nella suggestiva cornice di...',
  ],
  receptionNote: [
    'Seguira il ricevimento presso...',
    'Dopo la cerimonia festeggeremo insieme presso...',
    'Il banchetto nuziale si terrà a...',
  ],
  registryText: [
    'Il vostro regalo più bello è la vostra presenza, ma se desiderate contribuire al nostro futuro...',
    'La vostra presenza è il regalo più prezioso. Se volete, potete aiutarci a realizzare il nostro sogno...',
    'Vi vogliamo accanto a noi in questo giorno speciale. Ogni vostro pensiero sarà benvenuto...',
  ],
  dressCodeText: [
    'Elegante',
    'Formal',
    'Casual chic',
    'Cerimonia',
    'Smalto e tailleur',
    'Libero',
  ],
  rsvpMessage: [
    'Conferma la tua presenza entro il...',
    'Facci sapere se ci sarai entro...',
    'Ti aspettiamo! Conferma entro...',
  ],
};

export {
  getTemplates,
  getTemplateById,
  createDraft,
  getDraft,
  updateDraft,
  updateDraftTemplate,
  publishSite,
  generateText,
  getGeneratedTexts,
} from './service';
