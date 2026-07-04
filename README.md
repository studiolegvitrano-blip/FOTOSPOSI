# Sposi.live / JustMarry.live

Piattaforma SaaS per la gestione digitale di matrimoni. Un modular monolith Next.js + Supabase con brand duale: **Sposi.live** (Italia) e **JustMarry.live** (internazionale).

---

## COSA FA

### Per gli sposi
| Funzionalità | Descrizione |
|-------------|-------------|
| **Sito invito digitale** | Editor drag-and-drop con 12 sezioni (Cerimonia, Ricevimento, Storia, Galleria, RSVP, Dress code, Menu, Hotel, Playlist, Hashtag, Countdown). 6 template. Download ICS calendario. |
| **Galleria foto live** | Ospiti uploadano foto in tempo reale dal telefono. Galleria fullscreen con auto-refresh. Finestra upload configurabile. |
| **Giochi interattivi** | Vota foto, leaderboard live, wall display, barzellette con reveal schedulato. |
| **Video guestbook** | Ospiti registrano video-messaggi di 30 secondi. |
| **Lista nozze digitale** | Ospiti contribuiscono con importi liberi o dedicati. Stripe checkout. |
| **Shop foto** | Stampe fotografiche (Gelato print-on-demand). |
| **Backup automatico** | Foto sincronizzate su Google Drive personale dello sposo (via OAuth). |
| **Concierge AI** | Chat con Claude AI per consigli su organizzazione. |
| **Angolo scherzi** | Barzellette e video-scherzi con countdown reveal. |

### Per gli invitati
- **Sito-evento pubblico**: tutte le info (location, orari, menu, dress code, mappe)
- **RSVP**: conferma presenza via email, telefono o WhatsApp
- **Upload foto**: direttamente dal telefono nella galleria dell'evento
- **Partecipazione giochi**: vota foto, scrivi barzellette, registra video
- **Selfie kiosk** (prossimamente): chiosco con filtri JustMarry.live

### Per il team (B2B)
- **Admin panel**: gestione multi-evento, ruolo manager
- **Analytics B2B**: statistiche, report, dashboard
- **Marketplace fornitori**: vetrina fornitori con recensioni (prossimamente approvazione admin)

---

## ARCHITETTURA

```
┌─────────────────────────────────────────────────┐
│                   apps/web                       │
│          Next.js 15 (App Router)                 │
│    32 pagine, SSR, middleware auth               │
├─────────────────────────────────────────────────┤
│                  packages/                        │
│                                                   │
│  core ── auth, multi-tenant, ruoli, brand        │
│  events ── CRUD eventi, sub-eventi, finestra     │
│  media ── upload, Drive sync, compressione       │
│  games ── voti, leaderboard, wall, barzellette   │
│  social-sharing ── Web Share, watermark          │
│  commerce ── Stripe, Gelato, lista nozze         │
│  site-builder ── template, sezioni, AI, ICS      │
│  face-recognition ── tagging opt-in GDPR         │
│  notifications ── Resend, Evolution API          │
│  analytics ── statistiche, report B2B            │
│  marketplace ── fornitori, recensioni            │
│  concierge ── chat AI (Claude)                  │
│  ui ── design system (shadcn/ui + Tailwind v4)   │
├─────────────────────────────────────────────────┤
│              supabase/migrations                  │
│      10 file, 25+ tabelle, RLS policies          │
├─────────────────────────────────────────────────┤
│              supabase/functions                   │
│      auth ── validazione QR token (deployata)    │
│      events/media ── da implementare              │
└─────────────────────────────────────────────────┘
```

### Stack tecnico
| Layer | Tecnologia |
|-------|-----------|
| Frontend | Next.js 15, React 19, TypeScript |
| Styling | Tailwind CSS v4, shadcn/ui, lucide-react |
| Database | Supabase (Postgres 17 + RLS) |
| Auth | Supabase Auth (magic link, OAuth Google) |
| Storage | Supabase Storage → Google Drive API (definitivo) |
| Pagamenti | Stripe + Stripe Connect |
| Print-on-demand | Gelato API |
| AI testuale | Claude API (Anthropic) |
| Notifiche | Resend (email) + Evolution API (WhatsApp) |
| Hosting | Vercel (free tier) |
| Testing | Vitest + @testing-library/react (74 test) |
| Monorepo | Turborepo |

---

## FLUSSI PRINCIPALI

### 1. Registrazione → Evento
```
Utente → /auth/signup → crea tenant + core_users
      → /login → dashboard eventi
      → /events/new → crea evento (chiesa, ricevimento, date, sub-eventi)
      → /events/[id] → dettaglio, QR code, upload, giochi, sito, shop
```

### 2. Invito ospiti
```
Sposi → sito-evento → pubblicano con link
     → QR code stampabile (vale fino a giorno dopo evento)
     → Ospiti → scansionano QR → accesso pubblico all'evento
              → RSVP, upload foto, giochi, guestbook
```

### 3. Upload foto
```
Sposi: upload illimitato, sempre
Invitati: solo nella finestra (18gg prima - 2gg dopo evento)
        → compressione client-side (Uppy)
        → salvataggio su Supabase Storage
        → sync automatico su Google Drive (OAuth sposo)
```

### 4. Games
```
Sposi attivano giochi → ospiti votano/sfidano
                      → leaderboard live (refresh 5s)
                      → wall display (scroll 8s)
                      → barzellette con reveal schedulato
```

### 5. Commerce
```
Ospiti → shop (griglia prodotti)
       → dettaglio prodotto → Stripe checkout
       → lista nozze → contributo + messaggio
       → ordine confermato → banner successo
```

---

## MODELLO DI BUSINESS

| Revenue stream | Margine |
|---------------|:-------:|
| **Tier** (Sito 99€ / Premium 149€ / Deluxe 250€) | ~92% |
| **Geo-pricing** (UK £190-480, USA $245-620) | ~92% |
| **Gift** (amici regalano il servizio) | ~92% |
| **Commissioni lista nozze** | 3-5% |
| **Stampe Gelato** | 20-30% |
| **Domini personalizzati** | 40€ margine |
| **Extras** (time capsule, reel, ecc.) | ~90% |

### Proiezione 2 anni
| | Anno 1 (Italia) | Anno 2 (Globale) |
|---|---|---|
| Clienti | 253 | 9.800 |
| Ricavi | ~46K€ | ~3.5M€ |
| ARPU | 183€ | 320€ |
| Netto | ~38K€ | ~3.3M€ |
| Margine | 83% | 93% |

---

## STATO PROGETTO

Vedi [PROJECT_STATUS.md](./PROJECT_STATUS.md) per:
- ✅ Checklist Fase 1-5 (tutte completate)
- 🔴 Bloccanti (chiavi API mancanti: Stripe, Resend, Claude, Gelato, Evolution)
- 🔶 Da fare (admin marketplace, drive sync)
- 📋 Backlog Fase 6 (11 idee: time capsule, reel, quiz, caccia foto, ecc.)

---

## INSTALLAZIONE LOCALE

```bash
# Requisiti: Node.js 20+, npm
git clone https://github.com/studiolegvitrano-blip/FOTOSPOSI.git
cd FOTOSPOSI
npm install
cp apps/web/.env.local.example apps/web/.env.local
npm run dev
```

**Variabili d'ambiente necessarie** (in `apps/web/.env.local`):
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
STRIPE_SECRET_KEY=... (bloccante)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=... (bloccante)
RESEND_API_KEY=... (bloccante)
ANTHROPIC_API_KEY=... (bloccante)
EVOLUTION_API_URL=... (bloccante)
EVOLUTION_API_KEY=... (bloccante)
GELATO_API_KEY=... (bloccante)
```

---

## COMANDI UTILI

```bash
npm run dev        # Avvia sviluppo
npm run build      # Build produzione
npm test           # Esegue test (74 test)
npm run lint       # ESLint
```
