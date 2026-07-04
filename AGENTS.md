# AGENTS.md — Sposi.live / JustMarry.live

Questo è un modular monolith Next.js + Supabase per una piattaforma di gestione matrimoni (brand: Sposi.live/IT, JustMarry.live/INT).

## Stack tecnologico
- **Frontend**: Next.js (React, TypeScript)
- **Hosting**: Vercel (free tier)
- **Database/Auth/Storage temp**: Supabase (Postgres + RLS)
- **Storage definitivo**: Google Drive API
- **Pagamenti**: Stripe + Stripe Connect
- **Print-on-demand**: Gelato API
- **AI testuale**: Groq (Llama 3.3 70B) — primario, gratis. Fallback: Gemini 1.5 Flash
- **WhatsApp**: Evolution API self-hosted
- **Email**: Resend

## Struttura del monorepo
```
/apps
  /web              → frontend Next.js
  /api              → backend / edge functions
/packages
  /core             → auth, ruoli, multi-tenant, brand
  /events           → anagrafica evento, finestra 10gg, sub-eventi
  /media            → upload, Drive sync, compressione, guestbook
  /games            → voto, classifiche, wall, angolo scherzi
  /social-sharing   → Web Share API, watermark
  /commerce         → Stripe, Gelato, lista nozze, marketplace
  /site-builder     → generazione sito-evento AI
  /face-recognition → opt-in (solo dopo GDPR)
  /notifications    → email/WhatsApp
  /analytics        → dashboard B2B
/packages/ui        → design system condiviso
/supabase/migrations → schema DB diviso per modulo
```

## REGOLE FERREE
1. Ogni feature appartiene a UN SOLO modulo in /packages. Mai accedere direttamente ai dati di un altro modulo: passa dall'API pubblica in index.ts.
2. Prima di scrivere codice, verifica se il modulo esiste già in /packages. Se non esiste, crealo con la stessa struttura.
3. Ogni tabella nuova ha SEMPRE: id, event_id, created_at, e una RLS policy che la lega all'evento.
4. Segui l'ordine di costruzione: non iniziare la Fase N+1 se la Fase N non ha test funzionanti.
5. Componenti UI condivisi vanno in /packages/ui, mai duplicati tra i due brand — solo testi/lingua cambiano.
6. Ad ogni feature completata: scrivi un test minimo, aggiorna PROJECT_STATUS.md, fai commit atomico.
7. Non introdurre dipendenze a pagamento senza confermare con me prima.

## Ordine di costruzione
- **Fase 1** — Nucleo minimo vendibile: core → events → media
- **Fase 2** — Engagement: games → social-sharing
- **Fase 3** — Monetizzazione: commerce (Stripe, Gelato)
- **Fase 4** — Differenziazione: site-builder → angolo scherzi → video guestbook
- **Fase 5** — Advanced: face-recognition → concierge → marketplace → B2B

## Internazionalizzazione

### Setup tecnico
- **Libreria**: next-intl (v4) con App Router
- **Strategia**: cookie-based (nessun URL prefix), locale rilevato da Accept-Language + cookie
- **File messaggi**: `apps/web/messages/{locale}.json`, fallback a `it.json`
- **Provider**: `NextIntlClientProvider` nel root layout
- **Middleware**: locale detection + cookie `NEXT_LOCALE`

### Scelte di tono deliberate (en-US)
| Italiano | Traduzione letterale | Scelta nativa | Perché |
|----------|---------------------|---------------|--------|
| Angolo Scherzi | Jokes Corner | **Roast Corner** | Un'app wedding USA chiamerebbe così una sezione di prese in giro affettuose |
| Wall | Wall | **The Feed** | "Feed" è il termine wedding-tech standard per flusso foto live |
| Lista Nozze | Wedding List | **Gift Registry** | Registry è lo standard USA |
| Vota il Vestito | Vote the Dress | **Rate the Fit** | Slang naturale per gioco social |
| Sfide Video | Video Challenges | **Bachelor Party Challenges** | Specifica il contesto (addio celibato) |
| Concierge | Concierge | **AI Concierge** | Termine internazionale nel wedding-tech |

### Note culturali per paese
- **USA**: "Wedding party" = gruppo testimoni/damigelle, non "festa di matrimonio". Registry online è standard. QR code per foto ben accolti.
- **UK**: "Wedding breakfast" = pranzo post-cerimonia. Contanti accettati (100£ amici, ~50£ invitati serali).
- **Germania**: Preferiscono contanti (62%). Polterabend (sera prima, rompere piatti) è usanza locale da integrare come format gioco.
- **Francia**: "Vin d'honneur" (cocktail pre-cena aperto anche a non invitati). Quête (raccolta contanti in gabbietta decorativa) comune.
- **Spagna**: "Hora loca" (un'ora di ballo sfrenato con mascherine e coriandoli verso fine ricevimento). "Arras" (13 monete scambiate durante la cerimonia). "Lista de Bodas" è il termine standard per la lista nozze. Tono caldo e informale ("tú") appropriato per comunicazioni wedding. "Despedida de soltero/a" = addio al celibato/nubilato.
- **Svizzera**: Non abbastanza dati affidabili per trattarla come mercato separato — segue usanze del paese linguistico di riferimento.
- **Mercati secondari** (Cina, India, Brasile): ricerca ancora da fare.

### Prossimi passi
1. Validare en-US.json con madrelingua wedding-tech
2. Tradurre en-GB, de, fr
3. Convertire tutte le pagine chiave a `useTranslations()` / `getTranslations()`

## Recap variabili d'ambiente necessarie
- `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `GELATO_API_KEY`
- `GOOGLE_DRIVE_CLIENT_EMAIL` / `GOOGLE_DRIVE_PRIVATE_KEY`
- `RESEND_API_KEY`
- `GROQ_API_KEY` (Llama 3.3 70B, primario)
- `GEMINI_API_KEY` (fallback, già configurato)
- `EVOLUTION_API_URL` / `EVOLUTION_API_KEY`
