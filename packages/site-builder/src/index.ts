export interface SiteTemplate {
  id: string;
  name: string;
  palette: string[];
  font_family: string;
  category: string;
  preview_url: string;
  created_at: string;
}

export interface FaqEntry {
  question: string;
  answer: string;
}

export interface WeddingPartyMember {
  name: string;
  role: string;
  photoUrl?: string;
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
  rsvpWhatsapp?: string;
  rsvpDeadline?: string;
  rsvpMessage?: string;
  rsvpFormEnabled?: boolean;
  dressCodeEnabled?: boolean;
  dressCodeText?: string;
  menuEnabled?: boolean;
  menuText?: string;
  menuAllergens?: string;
  hotelsEnabled?: boolean;
  hotelsText?: string;
  playlistEnabled?: boolean;
  playlistLink?: string;
  hashtagEnabled?: boolean;
  hashtag?: string;
  navettaEnabled?: boolean;
  navettaOrari?: string;
  navettaMappa?: string;
  navettaNote?: string;
  navettaContatti?: string;
  navettaMatchmaking?: boolean;
  faqEnabled?: boolean;
  faqEntries?: FaqEntry[];
  weddingPartyEnabled?: boolean;
  weddingPartyMembers?: WeddingPartyMember[];
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

/**
 * URL Google Calendar (form-based render). Apre il form Google con i campi
 * precompilati. L'utente deve solo cliccare "Salva". Funziona anche senza login
 * Google (porta a login se serve).
 * Formato date/time richiesto: ISO `YYYY-MM-DD` + `HH:MM`. Durata in minuti.
 */
export function generateGoogleCalendarUrl(params: {
  date: string;
  time: string;
  title: string;
  address?: string;
  note?: string;
  durationMinutes?: number;
}): string {
  const [y, m, d] = params.date.split('-');
  const [hh, mi] = (params.time || '12:00').split(':');
  // Google Calendar vuole datetime locale SENZA timezone (form `YYYYMMDDTHHMM00`)
  const start = `${y}${m}${d}T${hh}${mi}00`;
  const search = new URLSearchParams({
    action: 'TEMPLATE',
    text: params.title,
    dates: `${start}/${start}`, // Google accetta anche solo start senza end
    details: params.note ?? '',
    location: params.address ?? '',
  });
  // Se durationMinutes specificata, calcola end
  if (params.durationMinutes) {
    const endDate = new Date(`${params.date}T${params.time}:00`);
    endDate.setMinutes(endDate.getMinutes() + params.durationMinutes);
    const ey = endDate.getFullYear();
    const em = String(endDate.getMonth() + 1).padStart(2, '0');
    const ed = String(endDate.getDate()).padStart(2, '0');
    const eh = String(endDate.getHours()).padStart(2, '0');
    const en = String(endDate.getMinutes()).padStart(2, '0');
    search.set('dates', `${start}/${ey}${em}${ed}T${eh}${en}00`);
  }
  return `https://calendar.google.com/calendar/render?${search.toString()}`;
}

/**
 * URL Outlook.com (Microsoft 365) Calendar deeplink. Apre il form di creazione
 * evento precompilato su Outlook Web. Path `/calendar/0/deeplink/compose`.
 */
export function generateOutlookCalendarUrl(params: {
  date: string;
  time: string;
  title: string;
  address?: string;
  note?: string;
  durationMinutes?: number;
}): string {
  const start = new Date(`${params.date}T${params.time || '12:00'}:00`);
  const end = new Date(start.getTime() + (params.durationMinutes ?? 120) * 60000);
  const search = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    startdt: start.toISOString(),
    enddt: end.toISOString(),
    subject: params.title,
    body: params.note ?? '',
    location: params.address ?? '',
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${search.toString()}`;
}

/**
 * Phase detection: dato un evento con date + eventuali ceremonyTime/receptionTime,
 * determina in quale delle 3 phase ci troviamo rispetto al "now".
 *
 * - `countdown`:  T > now + 1h          → manca ancora molto al matrimonio
 * - `cerimony`:   |T - now| <= 2h       → cerimonia in corso (±1h finestra)
 * - `reception`:  now > T + 2h          → cerimonia conclusa, in ricevimento
 * - `ended`:      now > T + 24h         → tutto concluso (post-evento)
 *
 * Se ceremonyTime/receptionTime sono specificati nel SiteContent (o `time` legacy),
 * usiamo quelli. Altrimenti fallback hardcoded:
 *   - cerimonia default ore 11:00
 *   - ricevimento default ore 13:00
 * (decisione presa in sessione 31/07/2026: niente migration DB per orari default).
 *
 * La fase `reception` copre dalle +2h dopo inizio cerimonia fino a +24h (wedding day),
 * poi scatta `ended`. Per eventi la cui cerimonia è la mattina tipica italiana
 * (11:00) e ricevimento pomeriggio (13:00), l'overlap è: 13:00-23:59 wedding day
 * è `reception`, 00:00+ è `ended`.
 */
export type EventPhase = 'countdown' | 'ceremony' | 'reception' | 'ended';

const DEFAULT_CEREMONY_TIME = '11:00';
const DEFAULT_RECEPTION_TIME = '13:00';
const CEREMONY_WINDOW_HOURS = 2;

export function getEventPhase(params: {
  date: string;
  ceremonyTime?: string;
  receptionTime?: string;
  time?: string;
  now?: Date;
}): EventPhase {
  if (!params.date) return 'countdown';
  const now = params.now ?? new Date();

  const cTime = params.ceremonyTime || params.time || DEFAULT_CEREMONY_TIME;
  const rTime = params.receptionTime || DEFAULT_RECEPTION_TIME;

  const ceremonyStart = new Date(`${params.date}T${cTime}:00`);
  if (Number.isNaN(ceremonyStart.getTime())) return 'countdown';

  const receptionStart = new Date(`${params.date}T${rTime}:00`);
  const ceremonyEnd = new Date(
    ceremonyStart.getTime() + CEREMONY_WINDOW_HOURS * 3600000,
  );
  const dayAfter = new Date(ceremonyStart.getTime() + 24 * 3600000);

  if (now < ceremonyStart) return 'countdown';
  if (now >= ceremonyStart && now < ceremonyEnd && now < receptionStart) {
    return 'ceremony';
  }
  if (now >= receptionStart && now < dayAfter) return 'reception';
  if (now >= dayAfter) return 'ended';
  // Gap teorico (ceremonyEnd <= now < receptionStart): cerimonia conclusa
  // ma ricevimento non ancora iniziato → consideriamo ancora ceremony (benvenuto)
  return 'ceremony';
}

/**
 * Helper unificato: ritorna un oggetto con tutti i 3 URL provider
 * per un dato evento. Usato dal componente AddToCalendarMenu.
 */
export function getCalendarLinks(params: {
  date: string;
  time: string;
  title: string;
  address?: string;
  note?: string;
  durationMinutes?: number;
}): { google: string; outlook: string; ics: string } {
  return {
    google: generateGoogleCalendarUrl(params),
    outlook: generateOutlookCalendarUrl(params),
    ics: generateIcsLink(
      params.date,
      params.time,
      params.title,
      params.address ?? '',
      params.note ?? '',
    ),
  };
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
  navettaOrari: [
    'La navetta partirà alle ore 18:00 dalla chiesa al ricevimento',
    'Servizio navetta gratuito: chiesa → ricevimento e ritorno',
    'Navetta disponibile dalle 17:30. Ultima corsa alle 23:00',
  ],
  navettaNote: [
    'Parcheggio gratuito disponibile presso la chiesa',
    'Parcheggio custodito presso il ricevimento',
    'Consigliamo di parcheggiare presso la chiesa e usare il servizio navetta',
  ],
  faqQuestion: [
    'A che ora inizia la cerimonia?',
    'Dove si trova il ricevimento?',
    'Cosa devo indossare?',
    'C\'è un parcheggio?',
    'Posso portare un accompagnatore?',
    'Ci sono intolleranze alimentari?',
  ],
  faqAnswer: [
    'La cerimonia inizierà puntuale alle ore...',
    'Il ricevimento si terrà presso...',
    'Il codice abbigliamento è elegante',
    'Sì, il parcheggio è disponibile presso la sede',
    'Sì, ti chiediamo di indicarlo nella conferma',
    'Il menu prevede opzioni per ogni esigenza',
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
  generateSiteText,
  getGeneratedTexts,
} from './service';
