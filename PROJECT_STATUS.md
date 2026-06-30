# PROJECT STATUS — FotoSposi / WeddingMoments

## Stato attuale: FASE 0 — Setup monorepo (completato ✓)

### Checklist Fase 0
- [x] AGENTS.md creato
- [x] PROJECT_STATUS.md creato
- [x] Struttura cartelle creata (apps/web, packages/*, supabase/migrations)
- [x] Root package.json con Turborepo
- [x] Next.js inizializzato in apps/web
- [x] TypeScript configurato (root + packages)
- [x] Dipendenze installate
- [x] Repository Git inizializzato
- [x] .env.local con placeholder per tutte le chiavi
- [x] Migrazioni SQL iniziali (core, events, media, games, commerce)

### Avanzamento Fasi successive
- **Fase 1** (core → events → media): non iniziata
- **Fase 2** (games → social-sharing): non iniziata
- **Fase 3** (commerce): non iniziata
- **Fase 4** (site-builder): non iniziata
- **Fase 5** (advanced): non iniziata

## Log cronologico
| Data | Modulo | Cosa fatto |
|------|--------|------------|
| 30/06/2026 | — | Creati AGENTS.md e PROJECT_STATUS.md |
| 30/06/2026 | — | Scaffolding monorepo: struttura cartelle, package.json, tsconfig, Turborepo |
| 30/06/2026 | — | Inizializzato Next.js in apps/web con layout e pagina base |
| 30/06/2026 | — | Creati tutti i pacchetti (core, events, media, games, social-sharing, commerce, site-builder, face-recognition, notifications, analytics, ui) con index.ts pubblici |
| 30/06/2026 | — | Migrazioni SQL: 00001_core_schema, 00002_events_schema, 00003_media_schema, 00004_games_schema, 00005_commerce_schema |
| 30/06/2026 | — | Inizializzato Git, installate dipendenze (npm install) |

## Ultimo comando eseguito
git init + npm install

## Prossimo passo previsto
FASE 1: Modulo core — implementare auth Supabase, ruoli, creazione tenant, QR token

## Variabili d'ambiente necessarie (mancanti)
- SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
- STRIPE_SECRET_KEY / STRIPE_PUBLISHABLE_KEY
- GELATO_API_KEY
- GOOGLE_DRIVE_CREDENTIALS
- RESEND_API_KEY
- ANTHROPIC_API_KEY
- EVOLUTION_API_URL / EVOLUTION_API_KEY
