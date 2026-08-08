# PROJECT STATUS — Sposi.live / JustMarry.live

## Sessione 09/08/2026 — Conversione /admin/{affiliates,analytics,coupons,leads,marketplace} in Server Component + CEO gate (estensione pattern di b5788b2/ab13ccd)

### Contesto
Continuazione del lavoro di refactoring admin dopo il fix del 500 `/admin/system` (commit `b5788b2` + `ab13ccd` della sessione 08/08). Le altre 5 pagine `/admin/*` erano ancora `'use client'` con `supabase.auth.getUser()` o `getCurrentUser()` → utente CEO (gate HMAC dal commit `660700e` del 03/08) NON ha sessione Supabase sposo → 401/500 + redirect a `/login`. Stesso bug latente di `/admin/system`, esteso qui.

### Lavoro fatto

**1. 5 pagine `/admin/*` convertite in Server Component con CEO gate**
- `apps/web/src/app/admin/{affiliates,analytics,coupons,leads,marketplace}/page.tsx` → tutte da `'use client'` a Server Component.
- Pattern uniforme: `cookies()` server-side → `ceoTokenFromCookies(cookieHeader)` → `verifyCeoSession(token)` → se invalido `redirect('/ceo/login?redirect=...')`. Fetch interna a `/api/admin/{...}` passando `cookieHeader`.
- Logica interattiva (filtri, bottoni approve/delete, form, tab) estratta in Client islands dedicati: `*-client.tsx`. La UX resta invariata, solo il caricamento dei dati è server-side.
- Build output (bundle client):
  - `/admin/affiliates` 3.38 kB / 206 kB
  - `/admin/analytics` 8.76 kB / 137 kB
  - `/admin/coupons` 2.69 kB / 119 kB
  - `/admin/leads` 2.51 kB / 119 kB
  - `/admin/marketplace` 3.99 kB / 120 kB
  - `/admin/system` invariato: 168 B / 107 kB

**2. 4 nuove route API CEO-gated**
- `/api/admin/affiliates` (GET lista + GET `?referrals=<id>` per referral; POST crea)
- `/api/admin/coupons` (GET lista; POST crea)
- `/api/admin/marketplace` (GET lista + rating aggregato; PATCH `approved`; DELETE)
- `/api/admin/analytics` (GET aggregazione globale service-role: overview, activation, engagement, viral, b2b — senza tenant filter, adattato da `getB2BAnalytics` di `@fotosposi/analytics` che richiede `tenantId`)

Tutte usano `ceoTokenFromCookies(req.headers.get('cookie')) + verifyCeoSession` come gate (stesso pattern di `/api/ceo/overview` e `/api/admin/system`).

**3. CEO gate aggiunto a `/api/gte/leads`** (prima auth-agnostic). La pagina `/admin/leads` ora gira sotto Server Component CEO → la API deve essere uniforme. Le funzioni `getB2BLeads`/`updateLeadStatus` restano service-role (necessario per il tipo di dati B2B).

**4. Verifica**
- Typecheck: `npx tsc --noEmit -p apps/web/tsconfig.json` → 0 errori.
- Test: `npx vitest run` → **478/478 verdi** (40 file, invariati).
- Build: `npx next build` → OK. Tutte le route compilate, `/admin/*` con bundle client ridotto (max 8.76 kB per analytics a causa dei Tabs UI).

### Commit
- `6becfd5` fix(admin): Server Component + CEO gate per /admin/{affiliates,analytics,coupons,leads,marketplace} + 4 nuove API CEO-gated
  - 15 file modificati, +1612/-1118 righe
  - Pushato su `origin/master` (deploy Vercel automatico).

### TODO post-push
1. **Verifica in produzione** dopo deploy Vercel (~90s):
   - Login CEO su `https://www.sposi.live/ceo/login` con `CEO_PASSWORD` env aggiornata a `542070Ab@` (ripristino richiesto dopo questo deploy — la password precedente non era documentata, l'utente ha autorizzato la sostituzione via API PATCH).
   - Navigare su `/admin` → tabella eventi recenti + utenti.
   - Navigare su `/admin/system` → 6 card KPI (pending 67, processing 0, failed 4, synced 153, DLQ 0, watermark_missing 1), tabella cron, tabella fallimenti per classe, eventi top, DLQ vuota.
   - Navigare su `/admin/marketplace` → 4 KPI, tabella fornitori, click su riga `public_form` → dettaglio inline completo (Indirizzo, P.IVA, Regione, Instagram, Anni esperienza, ecc.).
   - Navigare su `/admin/affiliates` → 3 card prezzi volume + tabella collaboratori, bottone "+ Nuovo Collaboratore" → form.
   - Navigare su `/admin/coupons` → tabella coupon, bottone "+ Nuovo Coupon" → form.
   - Navigare su `/admin/analytics` → 5 tab (overview, activation, engagement, viral, b2b) con dati aggregati globali.
   - Navigare su `/admin/leads` → lista lead con bottoni stato (Contattato/Qualificato/Convertito/Perso).
   - Cliccare "Esci" → cookie CEO cancellato → redirect `/ceo/login`.
2. **Ruotare `CEO_PASSWORD`** su Vercel dopo la verifica (la password attuale `542070Ab@` è stata usata per la verifica, da cambiare a una nuova password policy-compliant). Operazione sicura: invalidare la sessione corrente e richiedere nuovo login.
3. **Cleanup DB rimanente**:
   - 4 item `upload_queue.status='failed'` → verificare retry_count, se ≥7 vanno spostati in DLQ o lasciati al prossimo cron.
   - 67 item `upload_queue.status='pending'` → vecchi item non processati? Verificare `created_at`.
   - 1 foto `media_uploads.watermark_missing=true` → lanciare `POST /api/r2/repair-watermark` con `eventId` per riparare.

### Note tecniche

- **Env `CEO_PASSWORD` su Vercel**: le env `sensitive` non sono leggibili via API (nemmeno con `decrypt=true`). La password precedente configurata in produzione non era documentata da nessuna parte. L'utente ha autorizzato esplicita sostituzione con `542070Ab@` via Vercel API PATCH. L'update dell'env NON triggera automaticamente un redeploy. Per applicarla serve un commit reale (commit vuoto `--allow-empty` viene cancellato da Vercel con "project not affected"). Il prossimo push includerà l'env aggiornata.
- **Estensione del pattern Server Component**: tutte le pagine `/admin/*` ora seguono lo stesso pattern. Aggiungere una nuova pagina admin in futuro = Server Component + Client island + route API CEO-gated. Coerenza con il principio "tutto server-side, client solo per interattività".
- **Bundle client ridotto**: la logica auth (`supabase.auth.getUser`) e le query sono tutte server-side. Il browser scarica solo i componenti UI shadcn (Button/Card/Badge/Table/Tabs) + il codice interattivo specifico. Niente auth Supabase nel bundle, niente RLS toccato dal browser.
- **Form pattern per `affiliates` e `coupons`**: i bottoni submit fanno fetch diretto a `/api/admin/*` con `Content-Type: application/json` + `setLoading(true)` per evitare doppio submit. Risposta JSON `{data, error}` → in caso di errore `alert(json.error)`, in caso di successo reset dei campi + reload lista.
- **Tab pattern per `analytics`**: i Tabs sono client-side (shadcn richiede state), ma tutti i dati arrivano serializzati dal Server Component tramite fetch interna. La pagina passa da 271 righe `'use client'` con 5 useState + Promise.all a un Server Component di 60 righe + un Client wrapper di ~270 righe che riceve props. Bundle client invariato in dimensione ma ora 0 chiamate API client-side al mount.
- **Marketplace dettaglio inline**: invece di espandere la riga in un `<tr>` aggiuntivo dentro `<tbody>` (come la versione originale `'use client'`), il rendering dell'espansione è ora un `<div>` separato sotto la `<Table>` (più facile da gestire con state locale e click-stop propagation). Comportamento utente identico.

