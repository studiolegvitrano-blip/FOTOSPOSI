# AGENTS.md — FotoSposi / WeddingMoments

Questo è un modular monolith Next.js + Supabase per una piattaforma di gestione matrimoni (brand: FotoSposi/IT, WeddingMoments/INT).

## Stack tecnologico
- **Frontend**: Next.js (React, TypeScript)
- **Hosting**: Vercel (free tier)
- **Database/Auth/Storage temp**: Supabase (Postgres + RLS)
- **Storage definitivo**: Google Drive API
- **Pagamenti**: Stripe + Stripe Connect
- **Print-on-demand**: Gelato API
- **AI testuale**: Claude API
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

## Recap variabili d'ambiente necessarie
- `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `GELATO_API_KEY`
- `GOOGLE_DRIVE_CLIENT_EMAIL` / `GOOGLE_DRIVE_PRIVATE_KEY`
- `RESEND_API_KEY`
- `ANTHROPIC_API_KEY`
- `EVOLUTION_API_URL` / `EVOLUTION_API_KEY`
