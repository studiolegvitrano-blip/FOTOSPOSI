# PROJECT STATUS — Sposi.live / JustMarry.live

## Sessione 05/07/2026 — Deploy Vercel + DNS live (IN CORSO)
- [x] **Bug turbo.json**: chiave `"pipeline"` (Turborepo v1) non compatibile con `turbo ^2.5.0` installato → rinominata in `"tasks"`. Pushato (`fa23e6e`), risolto il primo build fallito.
- [x] **Bug import mancante**: `apps/web/src/app/events/[id]/guests/page.tsx` importava `getEventById` da `@fotosposi/core`, funzione mai implementata (file lasciato a metà da una sessione precedente). Aggiunta `getEventById()` in `packages/core/src/guests.ts` + esportata in `index.ts`.
- [x] **Bug bundling sharp**: webpack tentava di impacchettare i binari nativi di `sharp` (usato da `@fotosposi/photo-overlay` per il watermark) causando errori `Module not found '@img/sharp-libvips-dev/*'`. Fix: `serverExternalPackages: ['sharp']` in `apps/web/next.config.ts`.
- [x] **Bug tipo TS**: `apps/web/src/app/events/[id]/games/leaderboard/page.tsx` dichiarava `media_id_fk: string` (obbligatorio) nello state, ma `getLeaderboard()` in `packages/games/src/service.ts` lo restituisce come opzionale (`media_id_fk?: string`) → allineato lo state a opzionale.
- [x] **Pushate le 4 fix**: commit `203edb0` (guests.ts, index.ts, next.config.ts, leaderboard/page.tsx) — pushato su `origin/master`.
- [x] **Pushato lavoro "autonomia/manutenzione"** (sessione 04/07, rimasto in sospeso): commit `ea94096` — `api/cron/backup`, `api/cron/maintenance`, `vercel.json` (cron 04:00/04:20 UTC), migration `00029_system_health_log.sql`, fix minore `process-queue/route.ts`.
- [x] **Domini Vercel aggiunti**: `sposi.live`, `www.sposi.live`, `justmarry.live`, `www.justmarry.live` aggiunti al progetto `fotosposi-web` (apex→www redirect 308 configurato su entrambi).
- [x] **DNS propagato e verificato**: utente ha aggiornato i record su Register.it (A `@`→`216.198.79.1`, CNAME `www`→`5c8792472ce406eb.vercel-dns-017.com.`) per sposi.live — confermato "Valid Configuration" su Vercel per tutti e 4 i domini. Justmarry.live risultava già propagato anch'esso al momento della verifica (DNS records esistenti — record mail/PEC su Register.it non toccati).
- [x] **Connesso Vercel MCP** (account `studiolegvitrano-blip`): permette a Claude di leggere deployment/log build direttamente, senza copia-incolla manuale.
- [x] **Verificato su Vercel**: entrambi i deployment `203edb0` e `ea94096` risultati **ERROR** → causa di `DEPLOYMENT_NOT_FOUND` sui domini (nessun deployment production mai riuscito).
- [x] **Bug 5 — Route type error**: `apps/web/src/app/api/r2/process-queue/route.ts` esportava anche `processQueueForEvent()` oltre a `POST` — Next.js vieta export extra nei file `route.ts` ("does not match the required types of a Next.js Route"). Fix: funzione spostata in `apps/web/src/lib/process-queue.ts` (nuovo file), importata sia dalla route sia da `api/cron/maintenance/route.ts`.
- [x] **Bug 6 — Type error `faqEntries`/`weddingPartyMembers` possibly undefined**: pattern `x?.length > 0` non valido in TS strict (confronto `>` con possibile `undefined`). Corretto in 4 punti → `(x?.length ?? 0) > 0`: `apps/web/src/app/sito/[id]/page.tsx` (righe faq + weddingParty) e `apps/web/src/app/events/[id]/site-builder/page.tsx` (stesse due righe).
- [ ] **Da pushare e verificare**: le fix dei Bug 5 e 6 sono corrette sul disco ma non ancora committate — servono `git add`/`commit`/`push`, poi ricontrollare il build su Vercel (potrebbero emergere altri type error non ancora scoperti, dato che `next build` si ferma al primo errore incontrato).
- [ ] **Urgente — sicurezza**: `git remote -v` mostra il PAT GitHub in chiaro nell'URL remoto (`https://ghp_...@github.com/...`). Da revocare/rigenerare e da riconfigurare il remote senza token in chiaro nell'URL (usare credential manager o SSH).
- [ ] Da fare dopo il build OK: verifica finale (test, sicurezza chiavi, rotazione PAT GitHub esposto anche in `ECCOLO FOTOSPOSI.txt`), PWA runtime per Deluxe (task 15, non ancora iniziato).
- [ ] **SEO + GEO (Generative Engine Optimization)**: non dimenticare, oltre alla SEO classica (meta tag, sitemap, dati strutturati), l'ottimizzazione per essere citati dai motori generativi/AI (ChatGPT, Perplexity, Gemini, AI Overviews di Google) quando gli utenti chiedono consigli per organizzare un matrimonio — contenuti chiari/strutturati, FAQ schema, risposte dirette citabili. Da affrontare prima del lancio pubblico.

## Sessione 04/07/2026 — Go-live: homepage, camera fix, watermark video, autonomia
- [x] Homepage JustMarry riscritta (design originale ispirato a Zola, non copiato): hero, badge, sezione piani (Free/Premium/Deluxe), CTA finale
- [x] Sito pubblico invito (`/sito/[id]`): aggiunta sezione "Foto & Giochi" con link a Wall e hub giochi/challenge (prima mancava il collegamento)
- [x] **Fix bug reale**: registrazione video in kiosk e video-recorder forzava `video/webm` → crash su iOS Safari (`NotSupportedError`). Ora rileva il mimeType supportato (webm/mp4) con fallback upload-da-galleria universale su tutte le piattaforme (iOS/Android/desktop)
- [x] Cleanup automatico stream fotocamera allo smontaggio componente (niente più "fotocamera accesa" residua)
- [x] **Watermark video**: nuovo package `packages/video-overlay` (ffmpeg+sharp) esteso a `/api/photos/[id]/share` — prima il watermark su condivisione funzionava solo per le foto. Nota: testare su Vercel per limiti dimensione funzione/durata (vedi sotto)
- [x] Form registrazione: nome, cognome, cellulare con prefisso internazionale (default IT +39, selezionabile per altri paesi), checkbox GDPR obbligatoria + checkbox facoltativa condivisione terze parti — migration `00028_user_contact_consent.sql`
- [x] Verificata sessione persistente (Supabase SSR + cookie): autenticazione singola, nessun re-login continuo
- [x] **Autonomia/manutenzione**: `/api/cron/backup` (snapshot JSON tabelle critiche su R2) + `/api/cron/maintenance` (recupero job upload_queue bloccati, sweep autonomo code di TUTTI gli eventi non solo quello con tab aperta, health check) — `vercel.json` con cron alle 04:00/04:20 UTC (dopo le 4:40 locale), log in `system_health_log` — migration `00029_system_health_log.sql`. Richiede `CRON_SECRET` impostata anche nelle Environment Variables Vercel
- [ ] **Da fare**: deploy Vercel + collegamento DNS justmarry.live, PWA personalizzata a runtime per app matrimonio (Deluxe), decisione confermata: PWA unica invece di app nativa per coppia (vedi motivazioni Apple 4.2.6)

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
- [x] 102 test: auth (9), events (10), Button (3), analytics (4), notifications (11), marketplace (20), concierge (9), face-recognition (15), games (21)
- [x] Ruolo manager + admin panel + tabella event_managers

### Checklist Fase 4 (Site-builder + Guestbook + Scherzi)
- [x] Modulo site-builder: 6 template seed, CRUD draft, pubblicazione, generazione AI
- [x] Web: editor sito evento (3 tab: template, contenuti con 5 sezioni, anteprima live)
- [x] Web: video guestbook (registrazione 30s + griglia messaggi)
- [x] Web: angolo scherzi (upload foto/video, countdown reveal, shadcn refactor)

### Checklist Fase 5 (Advanced)
- [x] Modulo face-recognition: consenso GDPR + tagging
- [x] Modulo notifications: preferenze + invio (Resend/Evolution) + log
- [x] Modulo analytics: statistiche evento + dashboard B2B admin + 4 metriche strategiche
- [x] `social_shares` table + `marketplace_suppliers.contacted_at/active` columns
- [x] Modulo marketplace: fornitori + recensioni
- [x] Modulo concierge: chat AI (struttura + Claude API)
- [x] Drive OAuth: Google OAuth per Drive personale sposo + sync
- [x] Galleria live: fullscreen slideshow invitati con auto-refresh
- [x] Navbar aggiornata: link a Marketplace, Analytics, Notifiche, Concierge, Privacy

### Bloccato (chiavi ancora mancanti)
- Stripe: STRIPE_SECRET_KEY / NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY / STRIPE_WEBHOOK_SECRET
- Gelato: GELATO_API_KEY
- Resend: RESEND_API_KEY
- Evolution API: EVOLUTION_API_URL / EVOLUTION_API_KEY

### Configurato (chiavi presenti)
- ✅ Supabase: URL + anon key + service role
- ✅ Google OAuth: client_id + client_secret
- ✅ Cloudflare R2: account_id + access_key + secret_key
- ✅ Groq: GROQ_API_KEY (AI primaria)
- ✅ Gemini: GEMINI_API_KEY (AI fallback)

### Storage: Supabase → Cloudflare R2 (buffer) + Google Drive (permanente)
- [x] `packages/r2-storage/`: S3 client, presigned URL, upload, delete
- [x] API routes: `POST /api/r2/upload` (presigned URL) + `POST /api/r2/delete`
- [x] Upload page riscritta: client upload diretto a R2 → processa → Drive sync → cancella R2
- [x] Niente più Supabase Storage per i file (solo metadati in DB)
- [x] R2 free tier: 10 GB storage, bandwidth ∞, $0/mese
- [x] Stress test: `scripts/stress-test.mjs` + RPC `pg_database_size()` / `get_table_sizes()`
- [x] Stima: ~100k eventi in 500 MB DB Supabase (Storage non è più limite)

### Tier System (Fase 5 — Monetizzazione)
- [x] Migration 00015: event_tiers (free/premium/deluxe) + tier_features mapping table
- [x] Packages/core/src/tiers.ts: `getEventTier`, `updateEventTier`, `hasFeature`
- [x] Eventi nuovi con tier='free' di default
- [x] Games hub: mostra solo giochi disponibili per tier + lock visivo per feature bloccate
- [x] Games manage: badge tier per feature, toggle disabilitato se tier insufficiente
- [x] Watermark logo su download/condivisione social per tutti i tier
- [x] Drive backup per tutti i tier (free/premium/deluxe)
- [x] Jokes/Barzellette rimosse da AVAILABLE_FEATURES (fuori dal prodotto)
- [x] PRICING.md aggiornato: Free €0 / Premium 229€ / Deluxe 375€ + geo-pricing 9 paesi
- [x] Time Capsule geo-pricing (+10% paesi ricchi UK/US/CH/AU/CA)
- [ ] Stripe one-time payment (bloccato: STRIPE_SECRET_KEY mancante)
- [ ] Time Capsule acquisto singolo (Premium: 15€/6mesi, Invitati: 15€/6mesi)
- [ ] Finestra 48h Addio Celibato/Nubilato per Premium+
- [ ] Video before/after (design in corso)
- [x] Free tier: max 100 foto, compresse (SD), nessun video — migration 00017 + upload gate + badge SD su Wall

### Pricing finale (IT)
| Tier | Prezzo | Foto | Video | Qualità |
|------|--------|------|-------|---------|
| Free | €0 | max 100 | ❌ | compressa (SD) |
| Premium | 229€ | illimitate | ✅ | originale |
| Deluxe | 375€ | illimitate | ✅ | originale |
| Time Capsule extra | 15€/6 mesi |
| Time Capsule Deluxe | inclusa 6 mesi, poi 12€/6 mesi |

### Geo-pricing esempi
| Paese | Premium | Deluxe |
|:-----:|:-------:|:------:|
| 🇮🇹 IT | 229€ | 375€ |
| 🇬🇧 UK | £486 | £796 |
| 🇺🇸 US | $622 | $1,019 |

### Google OAuth configurato: client_id e client_secret in `.env.local`
- [x] Drive OAuth funzionante (sposi + admin)
- [x] 131 test totali (10 file) — tutti verdi
- [x] **Quiz sugli Sposi** (migration 00013, modulo games 17 nuovi test, admin + play + leaderboard pagine, tema consigliato basato sulle preferenze, 6 lingue i18n)
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

### Completato (feature virali)
- [x] Frame overlay brandizzato (sharp, square+story, cache Storage, pulsanti galleria)
- [x] Wedding Wrapped (packages/wrapped/, ImageResponse card 1080×1920, pagina pubblica /e/[id]/wrapped/[guestId])
- [x] Live Curation Fase 1 (colonna wall_priority_score, funzione recalculate_wall_scores, trigger INSERT, query curata con rotazione)
- [x] Drive sync automatico — cartelle Foto/Video/Ricevimento/Cerimonia create su OAuth, upload queue usa folder corretto per tipo file, getEventDriveFolders()
- [x] Video guestbook con teleprompter AI (Gemini) e review prima dell'invio
- [x] Time Capsule — migration + packages/time-capsule/ + API routes + pagine pubbliche/gestione + sync Drive + naming YYYY_MM_DD_EV_IT001
- [x] Work Diary — migration + packages/work-diary/ + API routes + pagina task con fasi e link redditività
- [x] Event Codes — tabella event_codes, formato EV_IT001 auto-generato in createEvent, getEventByCode()

### Prossime attività
- **App Mobile brandizzata** (Android + iOS): PWA o app nativa personalizzata per gli sposi (colori, logo, data), con upload foto, giochi, wall, guestbook, time capsule. Inclusa in Deluxe, aggiungibile a Premium per +60€.
- **Configurare chiavi API mancanti**: Stripe, Resend, Gelato, Evolution

### Nuove idee backlog
- **Morning-After AI Teaser**: alle 09:00 del giorno dopo le nozze, AI seleziona le migliori 15 clip video/foto, monta a tempo di musica e notifica push. Condivisione virale IG/TT con frame brandizzato.
- **VIP Face-Match Gallery**: face recognition GDPR-compliant. Ogni invitato riceve link alla sua galleria personale con solo le foto in cui appare.
- **Digital Flash-Mob & Light Show Sync**: smartphone invitati lampeggiano a tempo di musica sincronizzato durante il primo ballo.
- **Rete Partner internazionale**: al lancio in UK/US/DE/FR/ES, reclutare partner locali (fotografi, fornitori, autonoleggi) con geolocalizzazione 140 km + servizi consigliati con referral link specifici per paese.
- **Affiliate Program Influencer**: CPA (10% su vendita) per wedding blogger, fotografi, make-up artist, content creator. Nessun costo upfront, tracciato via referral code/link.

### ✔ Batch 2 — Giochi virali + Video Challenges
- [x] **Admin marketplace**: `getAllSuppliers`, `approveSupplier`, `deleteSupplier` in service.ts; pagina `/admin/marketplace` con stats + table
- [x] **Caccia alla Foto** (`/events/[id]/games/photo-hunt`): registrazione con ruolo, 10 task default, upload foto, leaderboard punti
- [x] **Navetta Ospiti** (modulo `site-builder`): sezione toggle con orari, mappa, contatti, matchmaking
- [x] **Vota il Vestito** (`/events/[id]/games/dress-vote`): star rating 1-5 per sposo/sposa, barre comparative, upsert
- [x] **Tavolo Selfie** (`/kiosk/[code]`): camera access, countdown, capture, compress, upload, dark UI brandizzata
- [x] **Primo Alcolico** (`/events/[id]/games/primo-alcolico`): 5 cardio targets, foto/video, localStorage
- [x] **Wow Walk** (`/events/[id]/wow-walk`): before/after walking video, side-by-side sync playback
- [x] **Video Challenges Addio al Celibato** (`/events/[id]/video-challenges`): 21 sfide, prima=addio celibato / dopo=cerimonia, side-by-side, localStorage
- [x] **21 nuovi test games**: photo_hunt (register, tasks, submit, leaderboard), dress_vote (cast, stats, my vote), ensureDefaultTasks
- [x] **194 test totali (16 file)** — tutti verdi
- [x] **GTM Engineer integrato**: package `@fotosposi/gte`, 5 API routes (`/api/gte/*`), admin page `/admin/leads`, migration 00023 (6 nuove tabelle GTE), 7 test

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
| 01/07/2026 | infra | (no commit) — Deploy edge function `auth` via Supabase CLI + nuovo PAT `sbp_d12...` |
| 01/07/2026 | media | — Upload queue system (`upload_queue` table + queue processor + pause/resume + persistenza) |
| 01/07/2026 | docs | — `SPEC_VIRAL_MARKETPLACE.md`: roadmap virale (frame, wrapped, curation) + marketplace 2 binari (white-label planner/fotografi + fornitori pay-to-play) |
| 01/07/2026 | feat | — Frame overlay brandizzato: `packages/photo-overlay/` (sharp), `event_branding` table, API route `/api/photos/[id]/share`, bottone Scarica/IG-TT galleria |
| 01/07/2026 | feat | — Wedding Wrapped: `packages/wrapped/`, API route `/api/wrapped/[guestId]/card`, pagina `/e/[id]/wrapped/[guestId]`, condivisione Web Share |
| 01/07/2026 | feat | — Live Curation Fase 1: colonna `wall_priority_score`, trigger, query pesata |
| 01/07/2026 | feat | — Drive sync: cartelle Foto/Video/Ricevimento/Cerimonia create su OAuth, `getEventDriveFolders()`, upload usa cartelle corrette |
| 01/07/2026 | feat | — Video guestbook con teleprompter AI (Gemini API route + review prima invio) |
| 01/07/2026 | feat | 15eebae — Time Capsule + Work Diary + Event Codes: migration 00011, packages/time-capsule, packages/work-diary, API routes, pagine pubbliche/gestione, file naming YYYY_MM_DD_EV_IT001 |
| 02/07/2026 | feat | — Batch 2 giochi virali: Caccia alla Foto, Navetta, Vota il Vestito, Tavolo Selfie, Primo Alcolico, Wow Walk, Video Challenges Addio al Celibato |
| 02/07/2026 | test | — 21 nuovi test games (photo_hunt + dress_vote) + fix build TS, **102 test totali** |
| 02/07/2026 | docs | — Aggiornato PROJECT_STATUS.md con Batch 2 completato |
| 02/07/2026 | feat | — **4 metriche strategiche analytics**: tasso attivazione, coinvolgimento invitati, coefficiente virale, conversione B2B |
| 02/07/2026 | data | — Migrazione 00012: `social_shares` table + `marketplace_suppliers.contacted_at/active` + tab Analytics con 5 schede |
| 02/07/2026 | test | — 12 nuovi test analytics (activation, engagement, viral, b2b) — **114 test totali** |
| 02/07/2026 | docs | — Aggiornato PROJECT_STATUS.md con metriche strategiche |
| 02/07/2026 | i18n | — next-intl setup, cookie-based locale detection, middleware aggiornato |
| 02/07/2026 | i18n | — messages/it.json + en-US.json (tone wedding-tech americano), LanguageSwitcher, home page i18n |
| 02/07/2026 | docs | — Ricerca usanze matrimoniali per paese + strategia internazionalizzazione in AGENTS.md |
| 02/07/2026 | i18n | — Convertite a i18n: Login, Signup, Dashboard, Event detail, Wall, Jokes, Games hub, Kiosk, Admin analytics — build OK |
| 02/07/2026 | i18n | — Convertito Site-builder a i18n — build OK |
| 02/07/2026 | i18n | — Convertiti Shop (listing, dettaglio, ordini) e Gift registry a i18n — build OK |
| 02/07/2026 | i18n | — Create en-GB.json (UK wedding tone), de.json (formal Sie), fr.json (elegant vous) — build OK |
| 02/07/2026 | i18n | — Create es.json (Spanish, "tú" tone) + routing + LanguageSwitcher + AGENTS.md customs — build OK |
| 02/07/2026 | i18n | — DE/ES: copiate versioni validate da FOTO AGO/, fix video_challenges.title gender-inclusive (IT/EN-US/EN-GB) — build OK, 114 test verdi |
| 02/07/2026 | feat | — **Quiz sugli Sposi**: migration 00013 (quiz_questions + quiz_answers), 17 nuovi servizi in games, pagina admin (domande con opzioni/tema/risposte), pagina play (quiz interattivo con risultati + tema consigliato), pagina leaderboard, i18n 6 lingue, 131 test totali |
| 02/07/2026 | tier | — **Tier System**: migration 00015 (free/premium/deluxe), `packages/core/src/tiers.ts`, games hub/gestione filtrano per tier, PRICING.md aggiornato 229€/375€ + geo-pricing 9 paesi |
| 02/07/2026 | r2 | — **R2 Storage**: `packages/r2-storage/` (S3 client, presigned URL), API routes upload/delete, upload page riscritta: client→R2→Drive sync→cancella R2, niente più Supabase Storage |
| 02/07/2026 | test | — Stress test `scripts/stress-test.mjs` + RPC `pg_database_size()` / `get_table_sizes()`, stima ~100k eventi in 500 MB |
| 03/07/2026 | docs | — `GTM-ENGINEER-WEDDINGMOMENTS.md`: documento GTM Engineer integrato per WeddingMoments (4 workflow n8n, schema SQL, prompt AI, setup guide) |
| 03/07/2026 | gte | — Migration 00023 (6 nuove tabelle GTE), package `@fotosposi/gte`, 5 API routes `/api/gte/*`, admin page `/admin/leads`, 7 test, **194 test totali** |

## Internazionalizzazione

### Setup tecnico
- **Libreria**: next-intl (v4) con App Router
- **Strategia**: cookie-based (nessun URL prefix), locale rilevato da Accept-Language + cookie
- **File messaggi**: `apps/web/messages/{locale}.json`, fallback a `it.json`
- **Provider**: `NextIntlClientProvider` nel root layout
- **Middleware**: locale detection + cookie `NEXT_LOCALE`

### Lingue configurate
| Codice | Lingua | Stato |
|--------|--------|-------|
| `it` | Italiano (sorgente/fallback) | ✅ Completo |
| `en-US` | Inglese USA (pilota) | ✅ Completo, tono Zola-style |
| `en-GB` | Inglese UK | ✅ Completo, tono UK wedding ("Sign in", "Wedding List", "Stag Do", "basket") |
| `de` | Tedesco | ✅ Completo, tono formale "Sie", diretto/funzionale |
| `fr` | Francese | ✅ Completo, tono elegante "vous" |
| `es` | Spagnolo | ✅ Completo, tono caldo informale "tú" ("Lista de Bodas", "Despedida de soltero/a") |

### Scelte di tono deliberate (en-US)
| Italiano | Traduzione letterale | Scelta nativa | Perché |
|----------|---------------------|---------------|--------|
| Angolo Scherzi | Jokes Corner | **Roast Corner** | Un'app wedding USA chiamerebbe così una sezione di prese in giro affettuose |
| Wall | Wall | **The Feed** | "Feed" è il termine wedding-tech standard per flusso foto live |
| Lista Nozze | Wedding List | **Gift Registry** | Registry è lo standard USA, "wedding list" suona britannico |
| Vota il Vestito | Vote the Dress | **Rate the Fit** | Slang naturale per un gioco social su Instagram/TikTok |
| Sfide Video | Video Challenges | **Bachelor Party Challenges** | Specifica il contesto (addio celibato) nel titolo |
| Concierge | Concierge | **AI Concierge** | Si mantiene "Concierge" perché è ormai un termine internazionale nel wedding-tech |

### Prossimi passi i18n
1. Validare en-US.json con madrelingua wedding-tech reale
2. Validare en-GB, de, fr, es con madrelingua
3. Convertire pagine minori a `useTranslations()` (Upload, Guestbook, Video challenges, ecc.)
   - [x] Login (`/login`)
   - [x] Signup (`/signup`)
   - [x] Dashboard (`/dashboard`)
   - [x] Event detail (`/events/[id]`)
   - [x] Site-builder (`/events/[id]/site-builder`)
   - [x] Wall (`/events/[id]/games/wall`)
   - [x] Jokes (`/events/[id]/games/jokes`)
   - [x] Shop (`/events/[id]/shop` + product detail + orders)
   - [x] Gift registry (`/events/[id]/gift`)
   - [x] Kiosk (`/kiosk/[code]`)
   - [x] Games hub (`/events/[id]/games`)
   - [x] Admin analytics (`/admin/analytics`)

## Strategia — Business

### 4 Metriche da tracciare (implementate nel modulo analytics)

| Metrica | Descrizione | Fonte Dati |
|---------|-------------|-----------|
| **Tasso attivazione sposi** | % che completa setup sito entro 48h dalla registrazione | `events.created_at` + `site_drafts.published`/`updated_at` |
| **Coinvolgimento invitati** | % invitati che caricano ≥1 foto o partecipano a ≥1 gioco | `media_uploads` + `votes` + `joke_entries` + `photo_hunt_registrations` + `dress_votes` |
| **Coefficiente virale** | Condivisioni social (Wrapped/overlay) per evento e click di ritorno | `social_shares` (nuova tabella, tracciata via Web Share API) |
| **Conversione B2B** | Fornitori contattati → attivi | `marketplace_suppliers.contacted_at` + `.active` (nuove colonne) |

### Necessità di investimento
- **Bootstrap minimo**: ~3.000-6.000€ per arrivare a validazione (chiavi API, hosting, marketing base)
- **Investimento esterno**: solo DOPO validazione con retention reale, coefficiente virale misurato, 5-10 partner B2B attivi
- **Pre-seed target**: 50-150k€ (business angel wedding/turismo, incubatore travel-tech italiano)

### Rischio principale
Mercato matrimoni Italia in contrazione (-5,9% annuo) ma valore medio per evento in crescita. La crescita deve venire da **quota di mercato sottratta a Google Drive/WhatsApp/soluzioni fai-da-te**, non dall'espansione del mercato.

## Documenti di progetto
- 📄 [GTM ENGINEER — WEDDINGMOMENTS](GTM-ENGINEER-WEDDINGMOMENTS.md) — Sistema di marketing automatizzato (n8n + Groq/Mistral + Telegram) a costo zero per content pipeline, B2B lead hunter, engagement triage, learning loop
