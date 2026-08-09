# PROJECT STATUS — Sposi.live / JustMarry.live

## Sessione 09/08/2026 (pomeriggio) — White label B2B per partner (ristoratori/fotografi)

### Contesto
Costruzione del portale partner B2B: un professionista (ristoratore, fotografo, wedding planner) può registrarsi, acquistare pacchetti di licenze (con sconto volume: ≥6 -50%, ≥12 -50% + 1 gratis) e creare eventi marchiati con il proprio logo. Logo partner doppiato sul watermark di foto E video (alto-sinistra). Countdown evento mostra "offerto da [partner]". Pagamenti: Stripe (esistente) o **bonifico IBAN** con conferma manuale admin e side-effect generazione codici.

### Lavoro fatto (4 fasi, 4 commit)

**Fase 1 — Portale partner** (commit `86b8d9f`)
- Migration `00057_partner_white_label.sql` (applicata in produzione): tabelle `partners`, `partner_codes`, RLS legata a `core_users.id = auth.uid()` e ruolo `partner` nel CHECK.
- Package `@fotosposi/partner`: `getEventPartner`, `getPartnerByUserId`, `redeemFirstAvailableCode`, `listPartnerEvents`, `getPartnerPackagePrice`, `generatePartnerCodes`.
- 8 route API `/api/partner/*`: `setup`, `me`, `codes` (GET+POST), `redeem`, `logo` (upload), `packages` (GET), `profile` (PATCH), `events` (GET+POST con white label automatico).
- Pagine `/partner/{login,signup,dashboard}`; link footer; namespace `partner` in it.json + en-US.json; `transpilePackages` configurato.

**Fase 2 — Doppio watermark foto+video** (commit `2023e8a`)
- `packages/photo-overlay`: `partnerLogoBuffer` opzionale (alto-sinistra, margini 2%, width clamp 135-680). Test integrazione pixel-per-pixel (checker blu/bianco 0→120→200/220 per `detectWatermark`).
- `packages/video-overlay`: `partnerLogoPng` + ffmpeg overlay `24:24`; `remote.ts` con `partnerLogoBase64/partnerLogoMimeType`.
- `vps-scripts/overlay.js` `renderPartnerLogo` + server terzo input ffmpeg.
- `watermark-fonts.server.ts` `loadPartnerLogo` (fetch 8s timeout, mai lancia).
- `process-queue.ts`: `partnerLogo` in `sharedCtx` + repair batch; share + guestbook passano `getEventPartner` + `loadPartnerLogo`.

**Fase 3 — Countdown "offerto da" + creazione eventi diretta** (commit `02e68d5`)
- `packages/ui/countdown.tsx`: blocco partner (logo/claim/indirizzo/sito, fallback `partnerClaimText ?? labels.countdown_intro`).
- `/api/events/[id]/details` e `/api/guest/event` rispondono `partner`; countdown passa props.
- `partner/codes.ts` `redeemFirstAvailableCode` + `listPartnerEvents`.
- Dashboard con lista eventi + form creazione (modello ibrido codici riscattabili + creazione diretta).

**Fase 4 — Pagamenti IBAN con conferma admin** (commit `7116a4b`)
- Migration `00058_orders_iban.sql` (applicata in produzione): `orders.payment_method` ('stripe'|'iban'), `payment_reference`, `metadata` (jsonb); `orders.event_id` **NULLABLE** (pacchetti partner non legati a matrimonio); tabella `platform_settings` (seed placeholder `IT00 0000...`).
- `packages/commerce`: `Order` estesa, `createOrder(paymentMethod...)` con `event_id: string|null`, `getIbanDetails` (legge platform_settings, rifiuta placeholder), `createIbanOrder` (causale `SP-<id8>`), `listPendingIbanOrders`. Fix import `IbanDetails` latente.
- `POST /api/orders/iban`: auth sposo/partner, body `{eventId?, total, currency?, metadata?}` (eventId opzionale per pacchetti), ritorna `{order, reference, iban}`.
- `GET/PATCH /api/admin/orders/iban`: ceoGate locale (pattern marketplace); PATCH `{orderId, action:'confirm'|'cancel'}` → confirm=paid e genera codici se `metadata.kind='partner_package'`, cancel=cancelled.
- Console `/admin/orders` (Server Component + Client island `OrdersClient`): tabella causale/evento/dettaglio/importo, bottoni Conferma/Annulla, feedback codici generati.
- Dashboard partner `handleBuy`: POST /api/orders/iban con `event_id=null`, `metadata.kind='partner_package'`; blocco coordinate IBAN.
- Shop prodotto: bottone "Paga con bonifico" affiancato a Stripe; box coordinate post-acquisto.
- i18n: namespace `partner` + `commerce` con `iban_title/amount/reference/note`, `buy_iban` (it + en-US).
- Test 485/485 (41 file). Typecheck clean.

### TODO post-push
1. **Valorizzare `platform_settings` con coordinate reali** (iban/iban_holder/iban_bank) via SQL o console — senza questo `getIbanDetails` rifiuta gli ordini IBAN.
2. **Deploy VPS**: `vps-scripts/overlay.js` + `vps-scripts/video-watermark-server.js` hanno il doppio logo ma vanno ricopiati sul VPS (scp + restart service).
3. **Namespace `partner` in en-GB/de/es/fr**: solo it + en-US completi.
4. **Rotazione `CEO_PASSWORD`** (TODO preesistente): `542070Ab@` usato per verifica, da cambiare.
5. **Riconnettere Google Drive** evento `ee2cc954` (TODO preesistente): refresh token revocato da Google.

### Commit
- `86b8d9f` feat(partner): Fase 1 portale B2B (tabelle, package, route, pagine, i18n)
- `2023e8a` feat(media): Fase 2 doppio watermark partner su foto e video (alto-sinistra)
- `02e68d5` feat(partner): Fase 3 countdown "offerto da" + creazione eventi diretta dashboard
- `7116a4b` feat(commerce): Fase 4 pagamenti IBAN con conferma admin + side-effect codici (11 file, +555/-24)
- Tutti pushati su `origin/master` (deploy Vercel automatico).

### Note tecniche
- `orders.event_id` nullable: cambio deliberato per supportare ordini non legati a matrimonio (pacchetti partner). Le route esistenti passano ancora `event_id` obbligatorio per gli ordini prodotto (shop).
- `ceoGate` è locale in ogni route `/api/admin/*` (non importato da `ceo-auth.ts`): pattern consolidato marketplace/affiliates/coupons/analytics. Mantenuto coerente in orders/iban.
- `getIbanDetails` rifiuta placeholder `IT00 0000...`: senza coordinate reali, la route orders/iban risponde errore 500 `Coordinate bonifico non configurate`. Safe-by-default.
- IBAN esposto al cliente solo nella response POST (mai in una API pubblica GET): le coordinate sono nella `platform_settings` (service role only), non hanno RLS pubblica.
- `metadata.kind='partner_package'` è il contratto tra orders/iban (client) e admin/orders/iban (PATCH): chiave testuale, non enum nel DB (jsonb). Aggiungere un nuovo kind (es. `product`) non rompe la PATCH.

## Sessione 09/08/2026 (mattina) — Verifica produzione admin + fix Edge Runtime crypto + fix fetch interne + fix await ceoGate

### Contesto
Completamento verifica produzione delle 7 pagine `/admin/*` convertite a Server Component (commit `6becfd5`). La verifica ha scoperto 3 bug critici in cascata, tutti fixati e verificati in produzione:

1. **`MIDDLEWARE_INVOCATION_FAILED` su tutte le route `/admin/*`** (500 `x-vercel-error`): `ceo-auth.ts` usava Node `crypto` (`createHmac`, `timingSafeEqual`) importato dal middleware (Edge Runtime) che NON lo supporta. Bug latente dal commit `660700e` (03/08) — mai triggerato prima perché `/admin/*` non era mai stato visitato con cookie CEO valido.
2. **`Unexpected token '<'` nelle fetch interne**: le Server Component costruivano l'URL di self-fetch con `NEXT_PUBLIC_VERCEL_URL` → in produzione punta all'URL del deployment protetto dietro SSO Vercel (302 → `vercel.com/sso-api` → HTML) invece del dominio pubblico.
3. **500 "No response is returned from route handler"** su 5 route API: `const blocked = ceoGate(req)` **senza `await`** → `ceoGate` è async → `blocked` è una Promise (sempre truthy) → `if (blocked) return blocked` appiattisce a `undefined` quando il gate PASSA (cookie valido) → Next.js 15 rifiuta il route handler senza Response. Con cookie invalido il gate ritornava 401 → sembrava funzionare, ecco perché sfuggito ai test.

### Lavoro fatto

**1. `ceo-auth.ts` riscritto su Web Crypto API** (commit `49e043b`)
- `signCeoSession`/`verifyCeoSession` → async (`crypto.subtle` HMAC-SHA256)
- `timingSafeEqualBytes`: confronto XOR costante manuale su Uint8Array (sostituto di `timingSafeEqual` di Node)
- `ceoPasswordMatches`: confronto timing-safe manuale
- Rimosso codice morto (`hmacKey`/`cachedHmacKey`)
- 18 call site aggiornati con `await`: `middleware.ts` (linea ~73, gate `/admin/*`), 6 pagine `/admin/*`, `/api/admin/{overview,system,affiliates,analytics,coupons,marketplace}`, `/api/ceo/{overview,login,check}`, `/api/gte/leads`
- Middleware build: 198→199 kB (polyfill Web Crypto)

**2. Helper `internalBaseUrl()` + fetch interne** (commit `e334758`)
- Nuovo `apps/web/src/lib/internal-base.ts`: deriva host/protocol dagli header della request in arrivo (`x-forwarded-host` su Vercel) — funziona su `www.sposi.live` e in locale
- Sostituito `NEXT_PUBLIC_VERCEL_URL` in tutte le 7 pagine `/admin/*`
- `/api/ceo/logout` ora usa `request.url` per la redirect (stesso bug potenziale)

**3. Fix `await` mancante su `ceoGate()`** (commit `04447c3`)
- `apps/web/src/app/api/admin/{affiliates x2, coupons x2, analytics, marketplace x3}/route.ts`
- `apps/web/src/app/api/gte/leads/route.ts` (GET + PATCH)
- Riprodotto localmente con `next build` + `next start` + cookie CEO locale: log esatto `Error: No response is returned from route handler...`
- Dopo fix: tutte e 7 le route → 200 con dati reali in locale

### Verifica produzione (deploy `dpl_BRsZVP7wrbsweRxpkocekRad31be`)

- Login CEO con `542070Ab@` su `/ceo/login` → redirect `/ceo` OK
- `/admin` → 2 eventi totali, 5 utenti, tabelle eventi recenti + utenti OK
- `/admin/system` → 6 card KPI (pending 67, processing 0, failed 4, synced 153, DLQ 0, watermark_missing 1), tabella cron (backup/maintenance/dlq-retry ok 08/08), fallimenti per classe (46 totali, 3 classi), eventi top (Agostino Spera & Danila Villa 44, Marinella e Salvo 2), DLQ vuota, dettaglio fallimenti OK
- `/admin/marketplace` → 4 KPI + filtri (Tutti/In attesa/Approvati/Candidature pubbliche) + tabella fornitori (0, DB vuoto) OK
- `/admin/affiliates` → 3 card prezzi volume + 1 collaboratore (Agostino, influencer, MATRI 10%) OK
- `/admin/coupons` → tabella coupon + form OK
- `/admin/analytics` → 5 tab con dati globali (0 eventi, 148 foto, 6 video, 0 ordini/voti/scherzi) OK
- `/admin/leads` → filtri stato + "Nessun lead trovato" OK
- "Esci" su `/ceo` → cookie CEO cancellato → redirect `/ceo/login` OK
- Navigazione `/admin` senza cookie → redirect `/ceo/login?redirect=%2Fadmin...` OK

**NB per il futuro**: dopo un deploy che tocca le Server Component `/admin/*`, la PRIMA richiesta può servire la build precedente (cache edge Vercel `Cache-Control: public, max-age=0, must-revalidate`). Forzare con query param (`?nocache=1`) per la verifica immediata.

### Commit
- `49e043b` fix(auth): Web Crypto API in ceo-auth.ts — risolve MIDDLEWARE_INVOCATION_FAILED 500 su /admin/* (20 file, +118/-68)
- `e334758` fix(admin): fetch interne con internalBaseUrl() al posto di NEXT_PUBLIC_VERCEL_URL (9 file, +36/-23)
- `04447c3` fix(admin): await mancante su ceoGate() in 5 route API — 500 "No response is returned from route handler" (5 file, +10/-10)
- Tutti pushati su `origin/master` (deploy Vercel automatico).

### Cleanup DB (09/08/2026) — loop DLQ→coda chiuso, 67 item irrecuperabili in DLQ

**Investigazione**: la sorgente dei 67 item `pending` non processati era un **loop quotidiano**:
1. Il cron `dlq-retry` (04:45/05:17) ripescava dalla DLQ gli item con `r2_key NULL` (file mai arrivati su R2, `failure_class='invalid_image'`) e li re-inseriva in `upload_queue` come `pending` (25 per notte: 06/08 04:56, 07/08 04:46, 08/08 05:17 — confermato dalle `requeuedIds` in `system_health_log`).
2. Il cron `maintenance` del giorno dopo li processava → `moveToDeadLetter` → di nuovo in DLQ → loop.
3. Il guard `r2_key not.is null` (commits `a96137a` 08/08 + fix sintassi PostgREST `243c27d`) chiude il loop: il `dlq-retry` del 09/08 04:45 ha considerato 0 item.

**Cleanup eseguito via SQL** (insert in `upload_queue_dead_letter` + delete da `upload_queue`):
- 63 item `pending` + 3 item `failed` (retry_count 99, `r2_key NULL`, irrecuperabili) → spostati in DLQ come storico con `last_failure_class='invalid_image'`, reason "cleanup manuale 09/08: file mai arrivato su R2 (r2_key NULL), irrecuperabile". Drenaggio cron (limit 5/run) avrebbe richiesto ~13 giorni.
- RIMASTO in coda: 1 item `failed` id `63af9867-0d5b-422a-8c10-fae20e126601` (`1000177432.png`, event `ee2cc954`, retry 5, `r2_key` PRESENTE, errore `Drive sync fallito: HTTP 401`) — recuperabile, il prossimo cron lo riprova (retry 5 < 7). Il 401 indica credenziali Drive da verificare.
- Watermark: `POST /api/r2/repair-watermark` con `eventId` `d88403f7-b4b7-4b81-9ec3-cff0d4d229de` → `{"repaired":1,"skipped":0,"errors":[]}` — unica foto con `watermark_missing` riparata (verificata `watermark_missing: false`).

**Stato coda finale**: `upload_queue` = 153 synced, 0 pending, 1 failed (Drive 401), 0 processing. DLQ = 63+3+4 item di storico.

### TODO post-push
1. **Ruotare `CEO_PASSWORD`** su Vercel dopo la verifica (la password attuale `542070Ab@` è stata usata per la verifica, da cambiare a una nuova password policy-compliant). Operazione sicura: invalidare la sessione corrente e richiedere nuovo login.
2. **Item Drive 401 residuo** (`63af9867`, `1000177432.png`): **risolto per diagnosi** — il refresh token OAuth dell'evento `ee2cc954` è stato REVOCATO da Google (`invalid_grant: Token has been expired or revoked`, verificato chiamando direttamente `oauth2.googleapis.com/token` con il refresh_token salvato). Il flusso di refresh in `refreshDriveTokenIfExpired` è corretto; non può funzionare con un token revocato. **Azione richiesta (utente)**: ricollegare Google Drive dalla pagina `/events/ee2cc954-98d7-4e11-828b-668a52e738e2/drive` (bottone "Connetti Google Drive"). Dopo la riconnessione il cron `maintenance` riproverà l'item (retry 5 < 7) e il sync andrà a buon fine. Causa probabile della revoca: app OAuth Google in modalità "testing" → Google revoca i refresh token inattivi dopo ~7 giorni (ultimo refresh ok 04/08). Se ricapita, valutare di pubblicare l'app OAuth (Google Console → Publishing status) o passare a un service account condiviso (già supportato da `GOOGLE_DRIVE_CLIENT_EMAIL`/`GOOGLE_DRIVE_PRIVATE_KEY`, attualmente vuoti in `.env.local`).

### Note tecniche

- **Env `CEO_PASSWORD` su Vercel**: le env `sensitive` non sono leggibili via API (nemmeno con `decrypt=true`). La password precedente configurata in produzione non era documentata da nessuna parte. L'utente ha autorizzato esplicita sostituzione con `542070Ab@` via Vercel API PATCH. L'update dell'env NON triggera automaticamente un redeploy. Per applicarla serve un commit reale (commit vuoto `--allow-empty` viene cancellato da Vercel con "project not affected"). Il prossimo push includerà l'env aggiornata.
- **`ceo-auth.ts` DEVE restare su Web Crypto API**: il middleware (Edge Runtime) lo importa. Vietato ri-introdurre `createHmac`/`timingSafeEqual` da Node `crypto` → `MIDDLEWARE_INVOCATION_FAILED` su tutte le route `/admin/*`. Test: build + check che il middleware compili.
- **Self-fetch nelle Server Component**: NON usare `NEXT_PUBLIC_VERCEL_URL` (punta all'URL del deployment, protetto da SSO Vercel → 302 `vercel.com/sso-api` → HTML). Usare `internalBaseUrl()` da `@/lib/internal-base` (deriva `x-forwarded-host` + `x-forwarded-proto` dalla request in arrivo).
- **`ceoGate()` nelle route API è async → SEMPRE `const blocked = await ceoGate(req)`**. Senza `await` il gate passa (Promise truthy) ma l'handler ritorna `undefined` → 500 "No response is returned from route handler" SOLO con cookie valido (con cookie invalido risponde 401 e sembra funzionare — motivo per cui i test con 401 non lo beccano).
- **Estensione del pattern Server Component**: tutte le pagine `/admin/*` ora seguono lo stesso pattern. Aggiungere una nuova pagina admin in futuro = Server Component + Client island + route API CEO-gated. Coerenza con il principio "tutto server-side, client solo per interattività".
- **Bundle client ridotto**: la logica auth (`supabase.auth.getUser`) e le query sono tutte server-side. Il browser scarica solo i componenti UI shadcn (Button/Card/Badge/Table/Tabs) + il codice interattivo specifico. Niente auth Supabase nel bundle, niente RLS toccato dal browser.
- **Form pattern per `affiliates` e `coupons`**: i bottoni submit fanno fetch diretto a `/api/admin/*` con `Content-Type: application/json` + `setLoading(true)` per evitare doppio submit. Risposta JSON `{data, error}` → in caso di errore `alert(json.error)`, in caso di successo reset dei campi + reload lista.
- **Tab pattern per `analytics`**: i Tabs sono client-side (shadcn richiede state), ma tutti i dati arrivano serializzati dal Server Component tramite fetch interna. La pagina passa da 271 righe `'use client'` con 5 useState + Promise.all a un Server Component di 60 righe + un Client wrapper di ~270 righe che riceve props. Bundle client invariato in dimensione ma ora 0 chiamate API client-side al mount.
- **Marketplace dettaglio inline**: invece di espandere la riga in un `<tr>` aggiuntivo dentro `<tbody>` (come la versione originale `'use client'`), il rendering dell'espansione è ora un `<div>` separato sotto la `<Table>` (più facile da gestire con state locale e click-stop propagation). Comportamento utente identico.

