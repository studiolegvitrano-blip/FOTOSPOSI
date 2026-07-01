# PROJECT STATUS — FotoSposi / WeddingMoments

## Stato attuale: FASE 5 — Tutte le fasi completate (1-5) ✓

### Checklist Fase 1 (Core + Events)
- [x] Modulo core: Supabase SSR client, auth helpers (signUp, signIn, signOut, QR token)
- [x] Pagine auth: login, registrazione, confirm email
- [x] Middleware protezione rotte dashboard
- [x] Dashboard sposi con lista eventi + link creazione
- [x] Modulo events: service CRUD (crea, leggi, lista eventi, sub-eventi, finestra 10gg)
- [x] Web: pagina creazione evento
- [x] Web: pagina dettaglio evento con sotto-eventi e finestra
- [x] Modulo media: upload, compressione client-side, Drive sync (codice pronto)
- [x] Web: pagina upload media per evento
- [x] Web: pagina evento pubblico (guest view via QR token)
- [x] Generazione QR code

### Checklist Fase 2 (Games + Social)
- [x] Modulo games: categorie, voti (upsert), leaderboard, barzellette con reveal schedulato
- [x] Web: games hub, votazione con griglia foto, leaderboard live (5s refresh, barre animate)
- [x] Web: wall display (10s refresh, 8s auto-scroll, dark mode)
- [x] Web: barzellette (submit con reveal date, pending/revealed, delete pending)
- [x] Modulo social-sharing: Web Share API, watermak, ShareButton

### Checklist Fase 3 (Commerce)
- [x] Modulo commerce: prodotti, ordini, Stripe checkout session, lista nozze, Gelato stub
- [x] Web: shop (griglia prodotti con filtro categoria)
- [x] Web: dettaglio prodotto + acquisto Stripe
- [x] Web: ordini con banner successo
- [x] Web: lista nozze (importi, messaggio, checkout, transazioni)

### UI + Test
- [x] Tailwind CSS v4
- [x] shadcn/ui (Button, Card, Input, Label, Table, Badge)
- [x] lucide-react, uppy, react-datepicker, qr-code-styling
- [x] Refactor login/signup/dashboard/admin con shadcn
- [x] Vitest + @testing-library/react
- [x] 74 test: auth (9), events (10), Button (3), analytics (4), notifications (11), marketplace (13), concierge (9), face-recognition (15)
- [x] Ruolo manager + admin panel + tabella event_managers

### Checklist Fase 4 (Site-builder + Guestbook + Scherzi)
- [x] Modulo site-builder: 6 template seed, CRUD draft, pubblicazione, generazione AI
- [x] Web: editor sito evento (3 tab: template, contenuti con 5 sezioni, anteprima live)
- [x] Web: video guestbook (registrazione 30s + griglia messaggi)
- [x] Web: angolo scherzi (upload foto/video, countdown reveal, shadcn refactor)

### Checklist Fase 5 (Advanced)
- [x] Modulo face-recognition: consenso GDPR + tagging
- [x] Modulo notifications: preferenze + invio (Resend/Evolution) + log
- [x] Modulo analytics: statistiche evento + dashboard B2B admin
- [x] Modulo marketplace: fornitori + recensioni
- [x] Modulo concierge: chat AI (struttura + Claude API)
- [x] Drive OAuth: Google OAuth per Drive personale sposo + sync
- [x] Galleria live: fullscreen slideshow invitati con auto-refresh
- [x] Navbar aggiornata: link a Marketplace, Analytics, Notifiche, Concierge, Privacy

### Bloccato (chiavi ancora mancanti)
- Stripe: STRIPE_SECRET_KEY / NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY / STRIPE_WEBHOOK_SECRET
- Gelato: GELATO_API_KEY
- Resend: RESEND_API_KEY
- Claude: ANTHROPIC_API_KEY
- Evolution API: EVOLUTION_API_URL / EVOLUTION_API_KEY

### Completato (fix Fase 5)
- [x] Google OAuth configurato: client_id e client_secret in `.env.local`
- [x] Drive OAuth funzionante (sposi + admin)
- [x] 74 test totali (9 file) — tutti verdi
- [x] `createServiceClient` fallback all'anon key nel browser (nessun errore lato client)
- [x] RLS policies: INSERT per events + core_auth_tokens
- [x] Creazione automatica tenant + core_users in signup e conferma email
- [x] Campi Cerimonia e Ricevimento nel form creazione evento + dettaglio evento
- [x] Link Google Maps navigazione per Cerimonia e Ricevimento
- [x] Finestra upload: 18gg prima / 2gg dopo evento
- [x] Sposi upload illimitato, invitati solo in finestra
- [x] QR code valido fino al giorno dopo l'evento (non 30gg fissi)
- [x] Hydration mismatch fix (`suppressHydrationWarning`)
- [x] `.env.local` in `apps/web/` per Next.js
- [x] `FOTO AGO/` escluso da git (secrets)
- [x] Site-builder riscritto: invito moderno con 12 sezioni toggle, frasi suggerite, ICS calendario
- [x] RSVP multi-canale (email, telefono, WhatsApp)
- [x] Menu + allergeni nel sito-evento
- [x] Lucide icons al posto delle emoji
- [x] Pagina pubblica sito-evento `/sito/[id]` renderizzata server-side
- [x] Link Maps navigazione per Cerimonia e Ricevimento nel sito pubblico

### Prossime attività
- **Admin marketplace**: UI per approvazione fornitori
- **Drive sync automatico**: collegare syncToDrive al trigger upload
- **Deploy edge functions**: via Dashboard Supabase (supabase link fallisce da questo PC)
- **Configurare chiavi API mancanti**: Stripe, Resend, Claude, Gelato, Evolution

## Log cronologico
| Data | Modulo | Commit |
|------|--------|--------|
| 30/06/2026 | setup | 1719793 — Setup monorepo + 11 packages + migrazioni SQL |
| 30/06/2026 | infra | a362182 — Edge functions (auth) + chiavi Supabase |
| 30/06/2026 | core | 836d2d3 — Core auth: SSR, login/registrazione, dashboard, middleware |
| 30/06/2026 | events | cfb8aab — Events: service CRUD, creazione evento, dettaglio, sub-eventi |
| 30/06/2026 | media+games | media + games + wall + jokes + social-sharing |
| 30/06/2026 | commerce | 01db06d — Stripe checkout, shop, lista nozze, ordini |
| 30/06/2026 | admin | 0b4076a — Admin panel + ruolo manager |
| 30/06/2026 | ui | b24a958 — Tailwind + shadcn/ui + refactor login/signup/dashboard/admin |
| 30/06/2026 | test | 702557c — Vitest + 22 test (core/auth, events, calculateWindow, Button) |
| 30/06/2026 | drive | a9902f0 — Drive OAuth per evento + galleria live invitati |
| 30/06/2026 | fase5 | 67b1e19 — Analytics B2B, Notifiche, Privacy/Face, Marketplace, Concierge |
| 30/06/2026 | test | f7484bc — 52 nuovi test per Fase 5 (74 totali) |
| 30/06/2026 | docs | accb215 — PROJECT_STATUS.md aggiornato |
| 01/07/2026 | fix | 0bf591a — createEvent usa anon key, RLS policy INSERT, church/venue, hydration |
| 01/07/2026 | fix | 98e7676 — Tenant + core_users automatici in signup e conferma email |
| 01/07/2026 | feat | 6d6319f — Link Maps per Cerimonia e Ricevimento |
| 01/07/2026 | fix | a36bf32 — QR token via API route server-side |
| 01/07/2026 | fix | 165fb9c — QR valido fino al giorno dopo evento |
| 01/07/2026 | feat | 947da8f — Finestra upload 18gg+2gg |
| 01/07/2026 | feat | 066c940 — Sposi upload illimitato, invitati solo finestra |
| 01/07/2026 | docs | a53eb25 — Aggiornato PROJECT_STATUS.md |
| 01/07/2026 | feat | dee7bfb — Site-builder riscritto: invito moderno, sezioni toggle, ICS, Maps |
| 01/07/2026 | feat | 92096fc — RSVP telefono/WhatsApp, allergeni, lucide icons |
