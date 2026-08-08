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
  /music            → colonna sonora condivisa (Spotify search, event_songs, export M3U/PDF)
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

## Migrazioni DB

`apply_migration` su Supabase MCP applica le DDL ma **NON refresha la cache PostgREST**. PostgREST tiene uno schema cache in memoria e NON si refresha automaticamente dopo `ALTER TABLE / ADD COLUMN`. Risultato: qualsiasi nuova colonna via migration MCP è invisibile al Data API (Supabase client incluso) finché non si esegue manualmente:

```sql
NOTIFY pgrst, 'reload schema';
```

Dopo aver applicato una migration che altera lo schema (es. `ALTER TABLE ADD COLUMN`), **esegui sempre** questo comando via `supabase_execute_sql`. Senza questo, il client Supabase rifiuta upsert/insert con `42703 column "X" does not exist in the schema cache`, anche se la colonna esiste nel DB (verificabile con `information_schema.columns`).

Pattern completo sicuro:
1. `apply_migration` o `execute_sql` con la DDL
2. `execute_sql` con `NOTIFY pgrst, 'reload schema'`
3. Verifica con una upsert di test che il client veda la nuova colonna

## OAuth callback: detectSessionInUrl già scambia il code

`@supabase/ssr` v0.6.1+ `createBrowserClient` ha `detectSessionInUrl: true` di default → **all'init della pagina `/auth/callback` scambia AUTOMATICAMENTE il `?code=...` OAuth** (POST /token), scrive la sessione nei cookie e rimuove il PKCE verifier dalla sessionStorage. **Non chiamare `exchangeCodeForSession(code)` di nuovo** — il verifier è già stato consumato → `AuthPKCECodeVerifierMissingError: PKCE code verifier not found in storage` → se l'utente viene rimbalzato al login con `?error=oauth_failed` nonostante la sessione sia valida nei cookie, è esattamente questo pattern.

**Regola (pattern obbligatorio in `apps/web/src/lib/oauth-callback.ts` → `resolveOAuthSession`)**:

1. `getSession()` PRIMA — se la sessione esiste, ritorna subito (detect automatico riuscito).
2. Solo se `getSession()` è null E c'è un code → `exchangeCodeForSession(code)` come fallback.
3. Se l'exchange fallisce → retry `getSession()` (caso difensivo race con detect async).
4. Su errore finale → redirect a `/login?error=oauth_failed` (caso reale "code reuse / tab chiuso durante OAuth", NON un bug).

Inoltre: la navigazione finale al target (`/dashboard` o `/events/{id}/...`) DEVE essere **hard** (`window.location.href = target`), non `router.push`. `router.push` può risolvere `/dashboard` dal prefetch RSC del client-router PRIMA del login (quando il middleware aveva risposto "redirect a /login") → la sessione nei cookie è fresca ma il middleware gira sul vecchio prefetch → rimbalzo al login → loop OAuth. Hard reload forza il middleware a rileggere i cookie auth appena scritti.

## Sharp in monorepo: range identici obbligatori

`sharp` ha dipendenze native (`@img/sharp-libvips-*`, `@img/sharp-*-*`) che **cambiano formato tra minor versions**. Se due package nello stesso monorepo dichiarano range sharp non sovrapposti (es. `^0.33.0` in `packages/photo-overlay` vs `^0.34.5` in `apps/web`), npm installa **due copie**: una hoisted root e una annidata in `packages/photo-overlay/node_modules/sharp`. webpack (Next.js `transpilePackages`) risolve `import('sharp')` dalla copia annidata locale → build fallisce con `Module not found '@img/sharp-libvips-dev/include'` perché la versione annidata ha un set di binding nativi diverso da quello che il bundler si aspetta.

**Regola**: TUTTI i package che dipendono da `sharp` devono dichiarare lo **stesso range esatto** (`^0.34.5`). Verificare con `npm ls sharp` dopo ogni `npm install` — deve mostrare UNA SOLA copia `deduped`, MAI nested. Aggiungere `sharp` come `dependencies` (non `devDependencies`) in ogni package che lo importa per garantire che npm lo veda.

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
- `CEO_PASSWORD` (console `/ceo`, policy: ≥8 char, maiuscola, minuscola, numero, simbolo)
