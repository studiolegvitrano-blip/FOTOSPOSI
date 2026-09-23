# PROJECT STATUS — Sposi.live / JustMarry.live

## Sessione 23/09/2026 (2) — "Nessun link nudo, mai": vecchio ShareButton eliminato, share file-first ovunque + guardrail buildShareUrl

### 1. Root cause "solo link nella descrizione" CONFERMATA: il vecchio ShareButton era ancora su /events/[id]:347 (la pagina del test utente)
- Il fix del 23/09 (handleShare per-platform in social-share-buttons.tsx) era corretto, ma `apps/web/src/app/events/[id]/page.tsx:347` e `event/[code]/page.tsx:349` usavano ANCORA il vecchio `ShareButton` (packages/ui) con `eventUrl=location.href` → `shareMedia(location.href, title)` → `navigator.share({title, text: title, url})` → post FB come LINK NUDO + nessuna didascalia/hashtag. L'URL nel post FB dell'utente (`/events/d88403f7-...`) conferma che aveva premuto QUELLO.

### 2. Fix (commit di questa sessione)
- **Sostituito** il vecchio ShareButton con `SocialShareButtons` su ENTRAMBE le pagine (file-first: `mediaId`/`eventId` → download/share del file watermarked via `/api/photos/{id}/share`, caption precompilata `buildDefaultCaption`, tag automatici). NB: le pagine sono CLIENT-side con GIÀ partner/media/handles nello state — niente fetch server extra. Field name reali: `groom1_social_handle`/`groom2_social_handle`/`couple_hashtag` (events), `social_handle`/`social_hashtag` (partner) — la proposta Claude usava field name inesistenti (`groom1_handle`, `partner.handle`).
- **photoUrl per il testo WhatsApp = endpoint share PUBBLICO** (`/api/photos/{id}/share?eventId=...&format=square`, verificato 200 senza cookie, immagine watermarked con preview in WhatsApp) — NON `/api/media/{id}/download` (401 senza cookie → link ROTTO per i destinatari; deviazione deliberata dalla proposta Claude, verificata live).
- **Branch X file-first**: native share (file) + caption clipboard, fallback download + clipboard + intent `text=` SOLO (mai `&url=`).
- **Guardrail in `buildShareUrl`** (share-with-tags.ts): `console.error` per facebook/tiktok ("usa downloadAndOpenSocial, non un link sharer") — un futuro refactor non può reintrodurre il bug per errore. + test ×3 (console.error FB/TikTok, nessun guardrail su Twitter intent).
- **Rimosso dead code**: `packages/ui/src/share-button.tsx` (delete + export) e `shareMedia` da service.ts/index.ts (unica consumer era ShareButton). P2 "2 componenti share sovrapposti da consolidare" CHIUSO. `shareMediaWithFile` resta (primitiva file-sharing valida).
- **Checklist grep verificata**: `shareMedia(` → ZERO chiamate; `ShareButton` → solo SocialShareButtons.

### 3. Verifiche live (oggi)
- **Endpoint share VALIDO e NON nero anche per foto Marinella** `ba33c543` (event d88403f7): HTTP 200, image/jpeg 355KB, **1080x2340** sRGB 4:2:0, mean 78.6/73.9/65.1, stdev 72.8 (c'è contenuto).
- **`format=square` NON produce 1:1**: restituisce la foto a dimensione ORIGINALE (in photo-overlay solo 'story' ricrea il canvas 1080x1920; 'square' non ridimensiona — nome fuorviante, NON bug).
- `/api/media/{id}/download` → 401 senza cookie (verificato) — inutilizzabile da app esterne/destinatari.
- Test 557/557 (49 file). Typecheck `tsc --noEmit` apps/web OK.

### 4. Aperto "foto nera" nel preview share sheet (da chiarire — endpoint SCARTATO, è valido)
Ipotesi in ordine di probabilità (endpoint verificato valido 2x):
1. **VIDEO condiviso** (feed card video → File fotosposi.mp4 → anteprima mp4 nello share sheet Android nera)
2. **Menu browser Android**: l'img della lightbox NON ha `onContextMenu preventDefault` (full-gallery-lightbox.tsx) → il long-press apre ANCHE il menu browser ("Condividi immagine") → l'app destinataria riceve `/api/media/{id}/download` → 401 → attachment/preview nero (e la clipboard NON viene copiata)
3. Foto scura di suo (party notturna, mean 78) — percezione "nera" su preview piccolo
- **Fix candidati prossima sessione**: (a) `onContextMenu={(e) => e.preventDefault()}` + `-webkit-touch-callout: none` sull'img lightbox; (b) PREVIEW del file watermarked nel menu long-press (thumbnail del blob che sarà condiviso — l'utente vede subito se è nero/valido PRIMA di scegliere la destinazione); (c) diagnostica file.size/canShare in console.
- **NB feed WhatsApp link rotto**: le card feed passano `photoUrl=absoluteUrl(mediaUrl)` = `/api/media/{id}/download` (401 per i destinatari) — da allineare all'endpoint share pubblico come fatto per le due pagine.

### 5. Fix WhatsApp file-first (stesso giorno, follow-up utente: "adesso condivide il link non la foto ma con tag")
- **Root cause**: WhatsApp era l'unico bottone rimasto che non passava MAI dal file — `buildWhatsappUrl` costruiva sempre `wa.me/?text=` con caption+tag e `photoUrl` dentro → il messaggio usciva con il LINK al posto della foto (con tag). Unico wa.me share del repo (verificato grep; gli altri 2 sono link contatto RSVP non correlati).
- **Fix**: branch WhatsApp = 1° tentativo native share FILE (WhatsApp mobile lo supporta bene: foto allegata + caption) + clipboard, fallback download + wa.me con SOLO il testo (MAI photoUrl) + toast "allega la foto alla chat". `buildWhatsappUrl` rimosso (dead code). Regola "nessun link nudo nel testo" estesa a WhatsApp.
- **Test** +1: photoUrl non finisce mai nel testo share (buildShareText). Suite 558/558 (49 file). Typecheck OK.
- NOTA: il prop `photoUrl` resta in SocialShareProps (usato dai call site) ma ora è inutilizzato dentro il componente (solo dal fallback dead buildShareUrl mai raggiunto — tutte le piattaforme hanno branch dedicato).

### 6. P0 SCOPERTO: TUTTI i deploy Vercel falliti da 21/09 23:20 → produzione ferma su build VECCHIO (l'utente testava sempre il codice vecchio)
- **Come scoperto**: verificando il chunk JS in produzione — conteneva ancora `buildWhatsappUrl` (codice vecchio) e NESSUNA stringa dei fix. Verifica via GitHub API commit status: **failure su TUTTI gli ultimi 10 commit** (dal 21/09 23:20), anche `4cc9c8f` che è solo docs → il build fallisce per un errore PERSISTENTE introdotto prima, non per i singoli commit.
- **Root cause (riprodotta localmente con next build)**: `capsule-client.tsx` (CLIENT component) importava `@fotosposi/time-capsule` → index ri-esportava `watermark.ts` → import statico di `@fotosposi/video-overlay` → **sharp** (con dep native `detect-libc`: `node:child_process`, `node:crypto`, `node:events`, `fs`) nel bundle CLIENT → webpack fallisce `Failed to compile: Can't resolve 'child_process'`. ATTENZIONE: il dynamic import NON basta — webpack compila i target dei dynamic import come chunk async ANCHE se mai chiamati a runtime → fallisce comunque.
- **Fix strutturale (commit di questa sessione)**:
  - **`packages/time-capsule/src/constants.ts`** (NUOVO, client-safe ZERO import): FRASE_NOSTRA_WATERMARK, CAPSULE_MAX_VIDEO_SECONDS, CAPSULE_MAX_PHRASE_CHARS, buildCapsuleWatermarkText.
  - **index.ts**: esporta le costanti da './constants' (stessa API pubblica per i client, capsule-client.tsx INVARIATO); le funzioni server-only `submitCapsuleWatermarkJob`/`processCapsuleWatermarkJob` RIMOSESSE dall'index (le route server le importano dal subpath `@fotosposi/time-capsule/src/watermark`).
  - **watermark.ts**: import video-overlay SOLO type (eraso) + funzioni importate DINAMICAMENTE nei metodi (runtime node) + type `ProcessCapsuleWatermarkJobFn` esportato per la DI.
  - **delivery.ts**: `processCapsuleWatermarkJob` NON più importato (nemmeno dinamicamente) → **dependency injection**: `runCapsuleSweep({ processWatermarkJob })` opzionale, iniettato dal cron route (stesso pattern di `brandingFor`). Guard `!opts.processWatermarkJob` sui loop watermark.
  - **cron capsule route**: importa `processCapsuleWatermarkJob` dal subpath e lo inietta in runCapsuleSweep.
  - capsule/route.ts + confirm/route.ts: `submitCapsuleWatermarkJob` dal subpath `@fotosposi/time-capsule/src/watermark`.
- **Lezione (regola per i package con sharp/ffmpeg)**: un package che usa sharp/node:* NON deve essere raggiungibile dal bundle client NESSUN статico NE dinamicamente. I client importano solo moduli client-safe (constants/pricing); le funzioni server-only si iniettano dal chiamante server (DI) o si importano da subpath dedicati. La build locale `npx next build` riproduce l'errore Vercel — VERIFICARE SEMPRE localmente prima del push.
- **Verifica**: build locale RIUSCITO (BUILD_ID ydvn9xB-mocnmIu_o4bys), test 558/558 (49 file), typecheck OK.

### TODO prossima sessione
1. Fix "foto nera" preview (vedi sezione 4: onContextMenu + preview blob nel menu + diagnostica). NB: deploy `1fcba72` VERIFICATO VERDE in produzione (chunk `6434` con i fix: WhatsApp file-first + X file-first + guardrail) — l'utente ora può ritestare sul codice nuovo.
2. Allineare il photoUrl WhatsApp del feed all'endpoint share pubblico.
3. Frase nostra watermark: placeholder 'Sposi.live · Capsula del Tempo' — da decidere.
4. Importi prezzo capsule: default in codice — da confermare via platform_settings.
5. WhatsApp delivery: provider da completare.
6. Idempotenza processSingleItem (chiude il loop orfani per sempre) + repair 5 video Marinella.
7. Share API dirette per sposi (Fase 2): TikTok Content Posting API, LinkedIn Posts API, FB/IG Graph API con OAuth.

## Sessione 23/09/2026 — Coda drenata (30 righe orfane video → DLQ) + share ChatGPT integrata + endpoint share verificato

### 1. ROOT CAUSE "file sempre in carica": 30 righe coda orfane per video GIÀ processati, duplicate ogni giorno dai cron
- **Sintomo utente**: "file sempre in carica" — coda con 17 processing + 13 pending + 3 failed statici.
- **Root cause**: TUTTI gli item stuck/pending erano le STESSE 4 video di Elisa & Nausica (`1000187830/1000185765/1000187139/1000186093.mp4`) duplicate ogni giorno (15→22/09, create_at 04:54-04:59 daily). Il repair 15/09 (VPS async) fixò i media DIRECTLY (29/29 watermark ok) SENZA aggiornare le righe coda → righe orfane obsolete con `failure_class='detect_watermark_missing'` → i cron le ritentano all'infinito (claim → lambda muore a metà run sui video → stuck → recovery reset → claim → loop). Loop classico DLQ→coda.
- **Fix**: 29 righe Elisa (video 29/29 già in galleria) + 1 failed Marinella (in_media=1) → spostate in DLQ come storico con reason "video già processato e in galleria (repair 15/09) - riga coda duplicata dai cron daily, obsoleta" + DELETE dalla coda. NOTA: la DELETE via CTE INSERT...RETURNING non funzionò (WHERE convoluto con max(moved_to_dlq_at)) — rifatta diretta con gli stessi criteri.
- **Stato finale coda**: 395 synced + **1 pending reale** (video Marinella `1000187830.mp4` non ancora in media — il cron lo processa con resume). 0 processing / 0 failed.
- **Marinella**: 2/7 video watermark ok, 5 con watermark_missing → da riparare (repair, NON toccare le foto).
- **Lezione**: quando un repair manuale (VPS/script) completa item direttamente, deve ANCHE chiudere le righe coda corrispondenti (o il loop riparte). Candidato fix strutturale: idempotenza nel processSingleItem — se il video è già in media_uploads con watermark ok → completa l'item senza ri-processare.

### 2. Endpoint share verificato + integrazione review ChatGPT
- **Verifica programmatica**: GET `/api/photos/{id}/share?format=square` su foto reale Elisa → **jpeg 1024x1536 VALIDO** (mean luminanza 98/74/62, 49% scuri — NON nero). La "foto tutta nera" riferita dall'utente NON viene dall'endpoint: probabile VIDEO condiviso via share sheet (FB renderizza male le preview video) o rendering lato app FB. Da chiarire con l'utente (foto o video?).
- **Nota CORS**: NON è un problema — l'endpoint è same-origin (il fetch R2 avviene server-side). ChatGPT aveva suggerito CORS come causa possibile: FALSO per questa architettura.
- **Integrato** (commit `aac9c94`): (1) **logging errori** fetch/clipboard/share in console (`[social-share] endpoint share fallito {status}`) — niente fallimenti silenziosi, l'utente vede in console il 404/500 in 30s; (2) **check blob vuoto** (blob.size===0 → errore esplicito, non file corrotto); (3) **branch TikTok esplicito**: native share (file) + clipboard, fallback download+clipboard+open tiktok.com/upload (il generico `upload?text=` era ignorato da TikTok — nessun web-intent con caption lato TikTok).
- **Limiti documentati (ChatGPT, confermati)**: le Storie IG/TikTok scartano SEMPRE il testo dello share sheet (policy piattaforma) → mitigazione clipboard + toast; nessun modo lato client di pubblicare foto+caption in un tap su FB/X → serve API ufficiale OAuth (Fase 2, scenario B2B partner).
- NON sostituito il componente con il modulo factory ChatGPT (`createHandleShare`) — il componente esistente è wired ovunque (lightbox + card + timeline feed); integrati solo i punti buoni. `nativeShareFile` conserva text nel payload (alcuni target lo onorano; clipboard comunque copiata prima).

### 3. Coda drenata manualmente (trigger maintenance)
- Trigger `GET /api/cron/maintenance` + Bearer CRON_SECRET: HTTP 000 a 150s (la lambda gira oltre — maxDuration 300s) MA il run continua server-side (verificato: failed 3→1, item processati). NB: usare curl.exe (curl PowerShell = alias Invoke-WebRequest, `-m` ambiguo).

### TODO prossima sessione
1. **Frase nostra nel watermark**: placeholder 'Sposi.live · Capsula del Tempo' — da decidere.
2. **Importi prezzo**: default in codice (base €9 + €1/mese) — da confermare via platform_settings.
3. **WhatsApp delivery**: provider da completare.
4. **Legacy route `/api/time-capsule/[eventId]` SENZA auth** — da gated in futuro.
5. **Chiarire "foto tutta nera"** con l'utente (foto o video? quale bottone?) + verificare video share in produzione.
6. **Fix strutturale**: idempotenza processSingleItem (video già in media → completa l'item) per chiudere il loop orfani per sempre + repair 5 video Marinella.
7. **Re-run security review agent** (tornato vuoto) + recovery step stuck processing capsule + orfani R2 capsules in /api/r2/orphans.
8. **Share API dirette per sposi (Fase 2)**: TikTok Content Posting API, LinkedIn Posts API, FB/IG Graph API con OAuth.
9. Verifica visiva capsula + galleria in produzione + Search Console batch SEO settimanale.

## Sessione 18/09/2026 — FIX cuore watermark video (fuori linea) + FEATURE Capsula del Tempo (video, delivery 6mesi-5anni, pagamenti proporzionali)

### 1. Fix cuore watermark video fuori linea dai caratteri
- **Root cause**: in `packages/video-overlay/src/index.ts` + `vps-scripts/overlay.js` il cuore era stato ridotto a `0.7*textPx` ma `heartTopY = baselineY - actualTextPx` (formula per size PIENA) → il cuore flottava `0.3*textPx` SOPRA la baseline (fuori linea). In photo-overlay il cuore è full-size con il fondo SULLA baseline.
- **Fix**: fondo del cuore SULLA baseline (`heartTopY = baselineY - actualHeartSize`) + `actualHeartSize = actualTextPx * 0.7` coerente col testo scalato (prima la width del cuore NON scalava con actualTextPx nel loop). VPS `overlay.js`: `heartSize` stimata in monoWidth allineata a 0.7.
- **Verifica**: test video-overlay 27/27; verifica programmatica sharp (render SVG → fondo cuore sulla baseline). NB: il cuore NON renderizzava nel test locale con data-URI SVG + MIME png sbagliato → usare PNG vero rasterizzato.
- **VPS da ri-deployare**: `scp vps-scripts/overlay.js ubuntu@92.4.218.108:/opt/fotosposi-vps/` + `sudo systemctl restart fotosposi-watermark` (la fix locale è su git, il VPS ha ancora il cuore flottante).

### 2. FEATURE Capsula del Tempo — video messaggi a data futura con pagamenti proporzionali
- **Requisiti**: sposi inviano video (max 3 min) a invitato loggato / email / WhatsApp; trasmissione tra 6 mesi e 5 anni dall'inserimento; sposi gratis fino a 12 mesi poi extra proporzionale; invitati SOLO agli sposi e SEMPRE a pagamento (stessa scala); delivery via email (link) o WhatsApp; watermark = frase utente (max 60 char, size adattiva) + frase nostra + logo Sposi.live/JustMarry + partner.
- **Modulo ESTESO** `@fotosposi/time-capsule` (esisteva già: testo/foto via Supabase Storage + Drive, API senza auth) — regola ferrea #1.
- **Migration 00061** (applicata + NOTIFY, verificata con insert di test): `time_capsule_messages` ADD COLUMN r2_key, original_r2_key, watermark_phrase, delivery_channel (email/whatsapp/app, default 'app'), recipient_email, recipient_whatsapp, recipient_guest_id (FK event_guests), status (awaiting_payment/processing/scheduled/delivered/failed, default 'scheduled' — flusso testo legacy invariato), video_job_id, last_error, payment_required, price_cents, order_id (FK orders), access_token (magic link), retry_count. RLS SELECT estesa: sender_user_id OR owner evento OR guest destinatario (prima solo owner).
- **Pricing** (`packages/time-capsule/src/pricing.ts`): base €9 (6-12 mesi) + €1/mese oltre i 12 → 6mo=€9, 1yr=€9, 2yr=€21, 5yr=€57. Proporzionale (5 anni = base + 4×extra-anno). Override importi via computeCapsulePriceCents (platform_settings capsule_price_base_eur/per_month_eur senza deploy).
- **Pagamenti Stripe SENZA webhook**: `createCapsuleCheckoutSession` (commerce, pattern gift checkout a importo libero, metadata type='time_capsule' + capsule_id) + `verifyCapsuleCheckoutSession` (retrieve session → paid + metadata match) → POST confirm: order → paid + capsula → processing + submit watermark.
- **Watermark capsula** (`packages/time-capsule/src/watermark.ts`): protocollo async VPS — `submitCapsuleWatermarkJob` (submit senza poll, per create/confirm con lifetime breve) + `processCapsuleWatermarkJob` (poll/resume video_job_id, come process-queue). Completato → .wm.mp4 diventa r2_key principale, originale su original_r2_key. `buildCapsuleWatermarkText`: frase utente + ` · ` + FRASE_NOSTRA_WATERMARK (placeholder 'Sposi.live · Capsula del Tempo' — DA DECIDERE). Branding assemblato in `apps/web/src/lib/capsule-watermark.ts` (logo brand, logo partner, font sposi via watermark-fonts.server).
- **Delivery** (`packages/time-capsule/src/delivery.ts` → `runCapsuleSweep`): (1) resume job watermark in corso; (2) re-submit capsule video fallite (retry_count < 3); (3) trasmissione scheduled+reveal_at passata → channel email → sendNotification (Resend) con link `/event/capsula/<id>?t=<access_token>`; channel whatsapp → PENDING (provider da completare, capsula resta scheduled); channel app → visibile in pagina → delivered.
- **API**: `POST /api/events/[id]/capsule/presign` (video/* + max 256MB), `POST /api/events/[id]/capsule` (create: validazione 6-60 mesi, recipient rules, pricing, checkout o submit watermark), `GET` (sposi: tutte; invitati: inviate + ricevute), `POST /api/events/[id]/capsule/confirm` (verifica Stripe), `POST /api/events/[id]/capsule/download` (presigned), `GET /api/cron/capsule` (GET-only + Bearer CRON_SECRET, maxDuration 300, branding cache per evento). Auth: `authorizeCapsuleAccess` (`apps/web/src/lib/capsule-auth.ts`) — sposo/delegato → 'couple', event_guests approved → 'guest'.
- **Pagine**: `/events/[id]/capsule` (sposi+invitato, CapsulePageServer → CapsuleClient: recipient picker, video picker con validazione durata ≤180s client-side, frase watermark, date picker min/max 6mo-5yr, prezzo live, Stripe redirect), `/event/[code]/capsule` (invitato via codice → resolve code → eventId), `/event/capsula/[id]?t=` (vista pubblica destinatario: countdown prima della data, video watermarkato dopo).
- **vercel.json**: cron `15 5 * * *` (/api/cron/capsule). next.config.ts: transpilePackages + outputFileTracingIncludes fonts/loghi per il cron capsule.

### Test/verifica
- Vitest: time-capsule 17/17 (prezzi proporzionali + boundary + payment_required + watermark text), suite completa 55/55 (7 file). `tsc --noEmit` apps/web OK.
- Migration verificata live: insert test con nuove colonne OK, poi cancellato.

### Review strutturale 4-agenti + fix P0 (stessa sessione)

**Review con 4 agenti paralleli (moduli/regole ferree, architettura/drift, capsule fresh-eyes; il security-agent è tornato vuoto — da rifare).**

**P0 fixati (commit di questa sessione):**
1. **Flusso pagamento rotto end-to-end**: la route `/capsule/confirm` NON veniva mai chiamata — il client reindirizzava a Stripe e al ritorno `?paid=1` mostrava "Pagamento completato" ma la capsula restava `awaiting_payment` PER SEMPRE (mai watermarkata, mai consegnata; nessuna sweep query la becca). **Fix**: client salva `capsule_pending_{eventId}` in localStorage prima del redirect; al ritorno `?paid=1&session_id=...` (Stripe appende session_id) chiama POST confirm → capsula processing. + Idempotenza: guard `status !== 'awaiting_payment'` → ok esplicito (double-confirm = doppio encode VPS).
2. **Data minima del picker sistematicamente rifiutata (400)**: validazione strict `months < 6` su mesi-30.4375 — 6 mesi calendario = ~5.95 mesi → 400 sulla PRIMA data offerta dal picker, con video già su R2 (orfan per ogni retry). **Fix**: tolleranza ±0.5 mese (`months < 5.5` / `months > 60.5`) + clamp.
3. **Sweep consegnava capsule MAI PAGATE**: `getFailedVideoCapsules` non filtra il pagamento — le capsule marcate `failed` per errore createOrder/checkout venivano riprocessate e CONSEGNATE gratis. **Fix doppio**: (a) create route → errore order/checkout ora ripristina `awaiting_payment` (non 'failed'); (b) delivery loop 2 → guard `payment_required && !order_id` → skip + error log.
4. **Legacy `/api/time-capsule/[eventId]` azione `cron-deliver` invocabile da chiunque** (marcava TUTTE le capsule delivered): gate CRON_SECRET Bearer. La route resta SENZA auth per create (pagina legacy `/e/[id]/capsule` per invitati ANONIMI ancora linkata da /event/[code] — gated completo romperebbe il flusso anonimo).

**P1 fixati (stesso commit):**
- `recipientGuestId` NON validato come appartenente all'evento (FK richiede solo esistenza in event_guests di QUALSIASI evento) → verifica `.eq('event_id', eventId)` prima dell'insert.
- Label/bottone prezzo UX: `price === 0` mai vero (base minimo 900 cents) → il bottone "Paga e crea" compariva anche per sposo ≤12 mesi che non paga. Ora `capsulePaymentRequired()` decide label ("Gratis (fino a 12 mesi)") e bottone.
- **sharp non dichiarato in video-overlay** (import 4× senza dep — pattern fragile regola ferrea) → `"sharp": "^0.34.5"` aggiunto, `npm ls sharp` → deduped singola copia.
- **`@fotosposi/social-sharing` non dichiarato in packages/ui** (share-button.tsx:4 lo importa via hoisting) → dep aggiunta.

**P1/P2 RIMASTI (da pianificare prossime sessione):**
- **Stuck 'processing' + video_job_id null = capsula persa** (delivery.ts re-submit azzera video_job_id; kill-window lambda → job VPS completato ma mai promosso). Serve recovery step come nel flusso media.
- **Orfani R2 capsules non riconosciuti** da `/api/r2/orphans` (considera solo media_uploads + upload_queue; il "Forza" creerebbe righe in upload_queue — tabella sbagliata per capsule).
- **Drift DB senza migration tracciata**: `upload_queue` (tabella più critica!), `time_capsule_messages` (pre-00061), `event_codes`, `feed_reactions/comments`, `event_drive_folders`, `event_branding`, `event_work_diary` (package work-diary non in AGENTS.md).
- **Duplicazioni**: `escapeXml` ×3 (video-overlay canonica, photo-overlay privata, process-queue privata — il bug no-op 05/09 è successo perché le copie divergevano), `getBrandLabel` ×2 (process-queue + capsule-watermark → spostare in core), derivazione filename `.wm.mp4` ×3 già divergenti (process-queue solo .mp4 vs time-capsule .mp4|mov|...).
- **process-queue.ts 1056 righe** — monolite da split (claim/branding/video-flow/repair).
- **Cross-module in /packages** (regola ferrea #1): wrapped ×12 query su 5 moduli (media/games/commerce/face-recognition/events), analytics ×6, gte, partner→events/affiliates, core→events/event_guests (inversione layering preesistente).
- **Dead code**: azioni mark/fail/retry in /api/queue (client usa solo state/enqueue), `/api/gte/{ugc,performance,engagement,brand-config}` senza consumatori, tabella `b2b_reports`, `getDueCapsuleMessages` (solo legacy).
- **P2 vari**: cron routes apribili se CRON_SECRET env mancante (`if (!secret) return true` ×6); durata video validata SOLO client-side (server non verifica mai — il VPS encode>300s già noto); vista pubblica capsula non controlla `status` (capsula failed mostra video originale NON watermarkato); niente Drive backup capsule video nel nuovo flusso (syncCapsuleToDrive esiste ma mai chiamata); email/whatsapp senza validazione formato; access_token/PII nelle response lista (defense-in-depth); i18n ~33% (40/120 file); SafeLinks scanner segnano downloaded_at; ui→site-builder dependency direzione inusuale; 2 componenti share sovrapposti da consolidare; due copie agenti review su /packages/markeplace ecc.

### 3. Condivisione social intelligente — file reale + LinkedIn + didascalia precompilata (richiesta founder 22/09/2026)
- **Base già esistente** (share-with-tags 10-11/08): `nativeShareFile()` condivide il FILE watermarked (square jpg via `/api/photos/[id]/share`) con Web Share API `files` + testo tag — già NON un link. Textarea testo modificabile. Hashtag auto da nome coppia (`&`→`and`).
- **Aggiunto**: (1) **LinkedIn** (6° tasto: icona nativa #0A66C2; fallback desktop = stesso pattern IG: clipboard testo + open linkedin.com/feed — sharing/share-offsite accetta solo URL, niente testo); (2) **didascalia DEFAULT precompilata** `buildDefaultCaption(coupleName)` ('💍 Una giornata indimenticabile per {nome}! ❤️' + riga grazie) — il campo descrizione nasce GIÀ SCRITTO, l'utente cancella/modifica/aggiunge (textarea precompilata); (3) **hashtag generici**: sposilive → #Matrimonio #Nozze #Wedding, justmarry → #Wedding #WeddingItaly (dopo brand + coppia + partner).
- **NOTA design**: niente righe DB per-social (facebook_text/instagram_text/...) — il testo è DETERMINISTICO da couple_name + couple_hashtag + brand, generato a runtime. Pubblicazione diretta via API (TikTok Content Posting API, LinkedIn Posts API, OAuth) = Fase 2 per gli sposi; gli invitati restano su Web Share nativo (nessun account da collegare).
- File: `packages/social-sharing/src/share-with-tags.ts` + `index.ts`, `apps/web/src/components/social-share-buttons.tsx`, test +3 (10/10). Typecheck OK.

### 4. Fix FB post "solo URL" (bug visto in produzione 23/09) — fallback mai link nudo
- **Sintomo**: l'utente condivide una foto su FB → la foto esce allegata ma il post contiene SOLO `https://www.sposi.live/events/...`, non @sposilive/#hashtag.
- **Diagnosi**: NON un difetto del payload `files` (già corretto: title+text+files, NESSUN url). Due path producevano l'URL nudo: (1) il **fallback desktop/file-fallito** per FB usava il FB sharer (`sharer.php?u=...&quote=...`) — **FB ignora ufficialmente `quote`** → post solo URL con preview (sembra allegato ma è il link); (2) il **vecchio ShareButton** (packages/ui, usato nella pagina invitato /event/[code]:349) condivideva `location.href` con `navigator.share({title, url})` → URL solo. ChatGPT aveva suggerito un componente nuovo (SharePhotoButton con Supabase Storage) — NON necessario: le foto sono su R2 e il componente esistente fa già la cosa giusta; serviva solo sistemare il fallback.
- **Fix**: (a) fallback FB/IG/LinkedIn = **mai link nudo**: download del file watermarked + caption negli appunti + apertura facebook.com / instagram.com / linkedin.com/feed (toast "Foto scaricata + testo copiato — incolla nel post"); (b) `nativeShareFile` copia SEMPRE la caption negli appunti PRIMA della share (se l'app FB scarta il testo ricevendo l'allegato, l'utente lo incolla); (c) rimosso il path degradato `nav.share({text, url})` (mai url nella share); (d) `shareMedia` (packages/social-sharing) ora passa `text: title` nel payload (il post evento non esce più come link nudo).
- **Limitazione FB documentata**: quando l'app riceve file+testo può scartare il testo — decisione dell'app destinatario, non del codice. La clipboard è la mitigazione; la soluzione robusta resta l'API Graph (Fase 2).

### 5. normalizeHashtag robusto + handleShare per-piattaforma (23/09, review ChatGPT integrata)
- **Bug reale per #Anna&Marcosposi**: `normalizeHashtag` NON sanitizzava `&` → l'hashtag impostato dagli sposi con `&` restava intatto nel testo share e i social lo troncano al `&`. **Fix** (versione ChatGPT): NFD + diacritici rimossi (hashtag social non accettano accenti) + SOLO `[a-zA-Z0-9_]` (`#Anna&Marcosposi` → `#AnnaMarcosposi`). `coupleNameToHashtag`: `&` → `E` (`Elisa & Marco` → `#ElisaEMarco`, prima "and").
- **handleShare per-piattaforma** (prima: nativeShareFile indistinto → share sheet imprevedibile per FB/X): **FB** = SEMPRE download+clipboard+open facebook.com (MAI share sheet, MAI sharer); **IG** = native share file + clipboard, fallback download+open; **LinkedIn** = download+clipboard+open feed; **X** = composer con testo precompilato (intent `text=` SENZA url — il `&url=` rendeva il post "foto+link") + foto scaricata da allegare; **WhatsApp** invariato (wa.me accetta testo). `buildTagText` NON passa più photoUrl (il testo share non contiene mai https://...).
- NB ChatGPT aveva sugerito che buildShareText inserisse l'URL nel testo — FALSO (verificato: photoUrl ignorato da buildShareText). Un output corrotto "locklock..." in chat era un glitch di generazione, non scritto in nessun file (verificato typecheck+test+grep).
- Test: social-sharing 12/12 (+2: & strippato, accenti rimossi). Typecheck OK.

### TODO prossima sessione
1. **Frase nostra nel watermark**: placeholder 'Sposi.live · Capsula del Tempo' — da decidere (costante FRASE_NOSTRA_WATERMARK in packages/time-capsule/src/watermark.ts).
2. **Importi prezzo**: default in codice (base €9 + €1/mese) — da confermare/con cambiare via platform_settings.
3. **WhatsApp delivery**: provider da completare (selectWhatsAppProvider esiste in notifications; il channel whatsapp resta scheduled fino ad allora).
4. **Legacy route `/api/time-capsule/[eventId]` SENZA auth** (preesistente): usa service client + body-provided sender_user_id — gap di sicurezza, da gated in futuro.
5. Verifica visiva capsula + galleria in produzione + Search Console batch SEO settimanale.
6. **Re-run security review agent** (tornato vuoto) + recovery step stuck processing capsule + riconoscimento orfani R2 capsules in /api/r2/orphans.
7. **Share API dirette per sposi (Fase 2)**: TikTok Content Posting API (foto, Direct Post), LinkedIn Posts API, Facebook/Instagram Graph API con OAuth "Collega il tuo account" — pubblicazione diretta foto+didascalia. Gli invitati restano su Web Share nativo.

### Deploy VPS cuore + test E2E (23/09/2026, completamento punto 1 della sessione 18/09)
- **Deployato**: `scp vps-scripts/overlay.js ubuntu@92.4.218.108:/opt/fotosposi-vps/` + `sudo systemctl restart fotosposi-watermark` → active, health `{"ok":true,"maxConcurrent":2}`.
- **Test E2E su VPS** (script node temporaneo, eseguito e rimosso): (1) **cuore ALLINEATO** — fondo a 128 vs baseline 129 (delta -1px; il bug vecchio era -22px flottante SOPRA la riga), verificato analizzando l'overlay PNG generato dall'overlay.js DEPLOYATO; (2) **ffmpeg filter senza label orfani** — no-logo E brand-only (filter produzione `[0:v]scale...[wm];[wm][2:v]overlay...` SENZA [wb] finale) → nessun "unconnected output"; (3) **cuore VISIBILE su fondo chiaro** (0xECECEC + testo bianco): 1594 px rossi nella striscia (min atteso 40).
- **Suite completa locale: 552/552 (49 file)**. NB test E2E: il filto brand-only del TEST con `[wb]` finale è il pattern SBAGLIATO (unconnected) — la produzione rimuove il label dall'ultimo overlay (verificato grep dal VPS). Script node su VPS: risoluzione ESM segue il path dello script → eseguire DENTRO /opt/fotosposi-vps (non /tmp) per risolvere node_modules.
- Il fix cuore vale per i video/capsule processati DOPO il deploy: i video in galleria hanno ancora il cuore vecchio flottante (ri-watermark solo su richiesta, NON toccare le foto).

## Sessione 15/09/2026 — ROOT CAUSE "31 foto → 5 in galleria": loop upload client abortiva al primo errore di rete + rate limit per-IP

### Sintomo
Utente carica 31 foto → solo 5 in galleria; retry con 13 → solo 3. Il resto "perso". DB: solo 9 righe mai create (8 synced + 1 senza r2_key in DLQ) → **35 file su 44 non sono MAI arrivati nè in coda nè su R2**: persi lato CLIENT durante l'upload, non nel processing.

### Root cause (2 difetti in `apps/web/src/app/events/[id]/upload/page.tsx` + 1 in `/api/queue`)
1. **`await fetch` NON protetti nel loop per-file** (presign `/api/r2/upload`, PUT R2, enqueue): un singolo errore di rete (blip WiFi, timeout) lanciava un'eccezione NON catturata → **l'intero batch moriva in silenzio**. Il file in corso era già in coda senza r2_key (finiva in DLQ `invalid_image`), i successivi non venivano mai inviati. Combacia col sintomo: batch1 5 file ok → 6° presign lancia → 26 persi; batch2 3 ok → stesso abort → 9 persi.
2. **2 chiamate queue-api per file** (enqueue PRIMA dell'upload + mark DOPO) → il doppio del consumo del budget rate-limit, e le righe nascevano senza r2_key (upload fallito = riga orfana in DLQ).
3. **Rate limit PER-IP su `/api/queue`** (60/min condivisi): con gli invitati sul WiFi della location (stesso IP NAT) TUTTI condividono lo stesso budget → 429 di massa. `/api/r2/upload` era già per-utente (fix 26/07), `/api/queue` no.

### Fix (commit di questa sessione)
- **Loop per-file interamente in try/catch**: un errore su un file lo conta `failedFiles` e CONTINUA il batch (riepilogo finale con alert "N file non caricati, ricarica i mancanti"). Mai più batch morti in silenzio.
- **Flusso riordinato: presign → PUT R2 → enqueue UNA SOLA volta con `r2_key` già valorizzata**. La riga in coda nasce SOLO se il file è davvero su R2 → niente righe senza r2_key, metà delle chiamate queue-api (1/file invece di 2), le azioni `mark`/`retry` restano per retrocompatibilità ma non sono più usate.
- **`/api/queue`: rate limit PER-UTENTE** (`queue-api:user:<id>`, 120/min) e azione `state` (sola lettura, polling 5s) FUORI dal budget. Chiamata `enqueue` accetta `r2Key` opzionale.
- Typecheck OK, test 67/67 (media + process-queue-solidity).

### Nota operativa
- I 35 file persi NON sono recuperabili (mai arrivati su R2): l'utente deve ricaricarli. Con il fix, ogni file fallito viene contato e segnalato, e il batch prosegue.
- La DLQ di oggi ha 1 riga (`1000189082.jpg`, r2_key NULL) — irrecuperabile per costruzione, col nuovo flusso questo path sparisce.
- Evento Marinella e Salvo (`d88403f7`): **tier → deluxe** (niente limite foto, video abilitati) e **data → 30/09/2026** su richiesta utente (chiedeva 31/09 che non esiste; settembre ha 30 giorni). 24 media totali (8 synced + 16 pregressi).

## Sessione 14/09/2026 — Backlog drenato a 0 (foto+video) + VPS video async (niente più limite 300s) + fix fallback ffmpeg Vercel + modulo SEO/blog + fix Groq modello ritirato

### Fatto

**1. Drenaggio backlog (COMPITO 1) — completato**
- Stato iniziale: 39 pending (non 72 — i cron avevano già drenato), **0 video tra i pending** (tutte foto) → alzare `ITEMS_PER_EVENT` sicuro.
- Trigger manuale: **`GET /api/cron/maintenance` + `Bearer CRON_SECRET`** (la route è **GET-only**: POST risponde 405).
- `ITEMS_PER_EVENT` 5→20 in `maintenance-sweep.ts` (backlog 100% foto corte; commit `b9b5b0a`) → drain: 39→0 pending in 4 run.
- **Final state: 0 pending / 0 processing / 0 failed** su tutti gli eventi.

**2. Video lunghi Elisa (8 righe failed → 5 video unici) + straggler — tutti riparati via VPS async**
- I 5 video (encode VPS >300s → irraggiungibili dal vecchio flusso HTTP sync) sono stati processati con il nuovo protocollo async via runner locale (script temporanei `repair-long-videos*.mjs`, eseguiti e rimossi): submit job → poll → CopyObject `.wm.mp4` → r2_key → `watermark_missing=false` → righe coda `synced`.
- +1 video straggler (`..._1000186093.mp4`, caricato 13/09, era watermark_missing=true): riparato uguale.
- NOTA comportamento: le righe failed vengono ri-claimate non solo dai cron ma anche da `/api/r2/process-queue` quando un invitato apre la pagina upload → codice VECCHIO deployato (sync 55s) le ri-falliva DOPO la mia sync manuale. Fino al push del nuovo flusso async, le sync manuali DB dei video sono fragili. Risolto dal punto 3.

**3. VPS video async — fine del problema "video lunghi >300s" (solidità per 250 matrimoni × 200 invitati)**
- `vps-scripts/video-watermark-server.js` riscritto con coda job in-memory: `POST /watermark {async:true}` → 202 `jobId`; `GET /jobs/:id` → `queued|running|done|error|not_found`; `MAX_CONCURRENT=2` encode paralleli (env), TTL job done 60min. Retrocompatibile (senza `async` = sync come prima). Deployata su Oracle + testata live (submit, poll, health `running/queued/maxConcurrent`).
- `packages/video-overlay/src/remote.ts`: `submitVideoWatermarkJob`, `getVideoWatermarkJobStatus`, `applyVideoOverlayRemoteAsync({pollBudgetMs, pollIntervalMs, resumeJobId})`. Resume con re-submit automatico su `not_found` (VPS riavviata).
- `apps/web/src/lib/process-queue.ts`: branch video usa async. Budget polling `VIDEO_POLL_BUDGET_MS` (default 150s) < maxDuration 300s. Se il budget scade col job ancora in corso → item torna `pending` con `video_job_id` salvato + `next_retry_at` +45s: la run successiva **riprende lo stesso job senza ri-encodare**. Completato/fallito → `video_job_id` azzerato.
- Migration: `upload_queue ADD COLUMN video_job_id text` (+ NOTIFY pgrst).
- Test nuovi: `remote-async.test.ts` (9 test: submit, poll stati, budget→inProgress con jobId, resume, re-submit, errori). Suite: video-overlay 18/18, process-queue-solidity 3/3, seo 8/8.

**4. VPS Oracle irraggiungibile ~1h + fix fallback locale Vercel (ridondanza "orologio svizzero")**
- La VPS Oracle (92.4.218.108) ha avuto un blocco di rete ~1h (timeout TCP su 22 e 443, ping negativo): il sidecar sul VPS non era morto (uptime 20476s al ritorno) → era l'infrastruttura di rete Oracle. Risolta da sola.
- Punto debole scoperto: se la VPS è down, ogni video fallisce perché il fallback locale non aveva `ffmpeg-static` tracciato nella lambda (ENOENT). `next.config.ts`: aggiunto `node_modules/ffmpeg-static/**` (+ path monorepo `../../node_modules/ffmpeg-static/**`) a TUTTE le route che toccano video (share, process-queue, cron maintenance + maintenance-evening, guestbook, repair-watermark). Ora VPS down = degrado qualità (720p/33%) ma **i video non si bloccano mai**.

**5. Fix critico AI: Groq ha ritirato `llama-3.3-70b-versatile` (404 model_not_found)**
- Sostituito in `packages/core/src/ai.ts` con `openai/gpt-oss-120b` (così torna il primario gratis per site-builder, concierge, SEO, ecc.). Modelli residui Groq all'account: gpt-oss-120b/20b, qwen3.6/3.8-27b, whisper, compound.

**6. Chiave "Nebula AI" (`api.b.ai`) — valida ma SENZA credito (decisione utente: lasciare perdere)**
- Auth OK, `GET /v1/models` risponde; OGNI chat/completions → 403 `Deposit required to unlock premium models`. `gpt-5.2` non esiste nel catalogo. NON salvata/integrata.

**7. Modulo SEO v1 (`@fotosposi/seo`) — motore articoli stile BabyLoveGrowth (gratis, via Groq)**
- Migration: tabella `blog_posts` (id, slug, locale, title, meta_description, keyword, content_md, status draft/published, published_at, event_id nullable, created/updated) + RLS public read sui soli published (+ NOTIFY).
- Package `/packages/seo`: `generateSeoArticle(keyword)` (Groq via `generateChat`), `insertDraft` (upsert su locale+slug), `publishPost`, `listPublishedPosts`, `getPostBySlug`, `markdownToHtml` (converter sicuro, HTML-escape prima, solo heading/liste/bold/link https+relativi; link javascript: strippati → testo) + test (8/8).
- Web: `/blog` (lista, revalidate 3600, canonical+OG), `/blog/[slug]` (generateMetadata + JSON-LD Article), `sitemap.ts` (statiche + post da DB), `robots.ts` (allow marketing, disallow aree private), `public/llms.txt` (AEO).
- Admin: `POST /api/admin/seo/generate` {keyword, locale?, publish?:false default bozza} + `POST /api/admin/seo/publish` {id} (CEO-gated come gli altri /api/admin/*).
- Seed pubblicati e visibili su https://www.sposi.live/blog: `regali-sposi-idee`, `lista-nozze-online-guida-completa`.

### Test/verifica
- Vitest: video-overlay 18/18, seo 8/8, process-queue 3/3. `tsc --noEmit` apps/web OK. npm workspace linkato (`@fotosposi/seo` + transpilePackages + dep in apps/web).

### Commit
- `feat(video): job VPS async con resume (niente più limite 300s) + fix ffmpeg-static nelle lambda Vercel (VPS down non blocca più i video)`
- `fix(ai): Groq llama-3.3-70b-versatile ritirato → openai/gpt-oss-120b`
- `feat(seo): modulo @fotosposi/seo + blog pubblico + sitemap/robots/llms.txt + route admin generate/publish`

### TODO prossima sessione
1. **Drive reconnect manuale** (utente) su entrambi gli eventi → /events/{id}/drive.
2. Generare altre keyword (batch settimanale via /api/admin/seo/generate) + schedulare (cron settimanale) e monitorare indicizzazione su Search Console.
3. AEO: monitorare citazioni (ChatGPT/Perplexity) mensilmente.
4. VPS single-point-of-failure resta: le foto vanno sempre (sharp in lambda), i video degradano su ffmpeg-static. Valutare un secondo nodo (Hetzner ~€4/mese) o health check + alert se /health giù >15 min.

## Sessione 12/09/2026 — Ri-watermark 28 video Elisa & Nausica con fix contrasto + fix latente buildFilterComplex (overlay unconnected)

### Contesto
Esecuzione del Punto 1 della sessione 11/09: ri-applicare il watermark ai video dell'evento `2f6ee6de-53bc-4857-8add-75aac538469f` (Elisa & Nausica) con la fix di contrasto (commit `f439aba`), che il cron maintenance NON fa (repair manuale via `POST /api/r2/repair-watermark`).

### Fatto

**1. Repair via route HTTP: 23 video riparati (10→23 ok)**
- Stato iniziale query DB: 28 video totali, 21 con `watermark_missing=true`.
- `POST /api/r2/repair-watermark` con `{eventId, limit:50}` + header `x-cron-secret`. Ogni run processa ~4-6 video prima del `maxDuration=300s` della lambda (il VPS lavora in async e scrive su R2, poi il template lambda muore → la risposta HTTP diventa 504 ma il lavoro PID completa). Rilanciato 6 volte.
- Risultato: 23 ok. RIMASTI 5 video con `watermark_missing=true`: i più RECENTI, con encode VPS di **298-557s** (durata reale 1-2min ma bitrate alto, source 720p/60fps). Superano sia il `timeoutMs:250_000` del repair-client sia il `maxDuration=300s` della lambda → non completeranno MAI via route HTTP.

**2. Repair dei 5 video lunghi via runner locale (no cap orchestratore)**
- Script ESM locale (`apps/web/repair-5.mjs`, creato e poi rimosso) che interroga la DB via service role, replica `composeWatermarkLine1` (coupleNames = `"Elisa & Nausica Sposi Palermo 07/09/2026"`), genera presigned download/upload, POSTa al VPS `https://watermark.sposi.live/watermark` (NON c'è il limite 300s), scarica il `.wm.mp4`, lo scrive sulla `r2_key` principale e imposta `watermark_missing=false`.
- Di questi, 4 completati in un run (~153-283s encode VPS l'uno). Il 5° (`1789120574394`, encode>300s) ricevè `HTTP 504` da nginx (`proxy_read_timeout 300s` della demo Vercel locale) MA il VPS aveva comunque COMPLETATO e caricato il `.wm.mp4` su R2 (47MB, presigned valido 3600s) → spostato alla `r2_key` principale + `watermark_missing=false`. Nessuna re-encode persa.

**3. ROOT CAUSE emersa: bug latente `buildFilterComplex` — "Filter overlay has an unconnected output"** (fix in questo commit)
- I 5 video fallivano via script con `ffmpeg: Filter overlay has an unconnected output`. Causa: la funzione (locale `packages/video-overlay/src/index.ts` + VPS `vps-scripts/video-watermark-server.js`) lasciava l'ULTIMO overlay con un output LABEL non consumato:
  - Nessun logo (no brand/no partner): la catena terminava con `...[wm]`, label mai consumato → errore ffmpeg.
  - Solo brand: terminava con `[wm2]` (versione locale) o `[wm]` replicato (VPS).
- Questo NON era mai emerso prima perché nel flusso normale il logo brand (fotosposi) è sempre presente → l'ultimo overlay era SENZA label → ffmpeg auto-mappa l'output al file. Il mio runner senza logo l'ha esposto.
- Fix (identico su entrambi i file): solo gli overlay INTERMEDI hanno un label per concatenare; l'ULTIMO termina senza label. Casi coperti: nessun logo / solo brand / solo partner / brand+partner.
- Sono stati usati input label coerenti 0=video, 1=strip testo, 2=brand, 3=partner.

**4. VPS ri-deployata + test**
- `scp vps-scripts/video-watermark-server.js` + `sudo systemctl restart fotosposi-watermark` → `active`. Verificata la fix su VPS con i 4 video lunghi (ora OK senza logo).
- Test regressione locale `packages/video-overlay/src/filter-complex.test.ts` (nuovo, 5 test): verifica che nessun caso produca un label orfano finale e che la stringa filter sia corretta per i 4 scenari.
- Typecheck pulito `tsc --noEmit -p apps/web/tsconfig.json`. Test: video-overlay 18/18 (3 file), process-queue-solidity 3/3.

### Verifica finale
- `SELECT count(*) FILTER (WHERE watermark_missing=false) FROM media_uploads WHERE event_id='2f6ee6de-...+75aac538469f' AND type='video'` → **28/28** (prima 10/28, RESTANO 0).
- Verifica visiva programmatica su `1789120574394_1000187830.mp4` (il più lungo): estratto frame a 10s → striscia bassa (13% altezza) 27.1% pixel <90 vs 19.8% sul frame intero → bordo di contrasto del testo VISIBILE (la fix `f439aba` era già sul VPS dal 11/09 e il VPS registrava `textColor=#ffffff` white su luma adattivo).

### Nota operativa per il futuro
- I video lunghi (encode VPS >~250-300s) NON sono riparabili via route HTTP: il repair route e il cron maintenance hanno `maxDuration=300s` e il repair-client un `timeoutMs:250_000`. Per questi serve un runner locale/VPS direct (o alzare `maxDuration` — ma Vercel Hobby ha cap 300s per funzione). Da tenere conto anche per i 72 pending di Agostino (`ee2cc954`): eventuali video lunghi andranno gestiti fuori lambda.

### Commit
- `fix(video): buildFilterComplex overlay label orfano — "Filter overlay has an unconnected output" senza logo (+ test regressione)`: tocca `packages/video-overlay/src/index.ts`, `vps-scripts/video-watermark-server.js`, nuovo test. VPS ri-deployata.

### TODO post-push
1. **Drenare backlog Agostino** (72 pending): `POST /api/cron/maintenance` con `Authorization: Bearer <CRON_SECRET>` è sicuro, oppure alzare `ITEMS_PER_EVENT` in `maintenance-sweep.ts` (5→20-25, attento timeout col video lunghi — valutare runner locale per essi).
2. **Riconnettere Drive** dei 2 eventi (istruzioni via `/events/{id}/drive`) per ripristinare il backup (in sospeso dalla fix `51dc3ce`).
3. Verifica visiva galleria dei 28 video con il nuovo watermark (contrasto bordo + logo).
4. Outstanding latente: fallback locale video `ffmpeg-static ENOENT` su Vercel se VPS giù. TODO `outputFileTracingIncludes` per ffmpeg-static o disabilitare fallback sul repair.

---

## Sessione 11/09/2026 — Watermark video invisibile su fondo chiaro (fix contrasto) + coda bloccata da Drive revoked (fix pubblicazione non bloccante)

### Contesto
Due problemi segnalati dall'utente durante il test: (1) il watermark video "spariva" sui video reali; (2) le foto/video caricati non venivano elaborati — "il sistema doveva essere solido ma non bastava per 29 upload, immagina 200 matrimoni × 200 invitati".

### Fatto

**1. Root cause watermark video invisibile** (`packages/video-overlay/src/index.ts` + VPS `vps-scripts/overlay.js`, commit `f439aba`)
- Il testo era bianco a `fill-opacity 0.5`; `probeLuminance` campiona SOLO il primo frame (fade-in/scuro → sceglie bianco) ma la scena reale ha la striscia bassa ~96% chiara (mean 199, bright 94.8%) → **testo bianco su fondo bianco = invisibile**.
- Fix: contorno di colore OPPOSTO (`stroke` con `paint-order="stroke fill"`, `strokeWidth = max(1, textPx*0.1)`), opacità 0.5→0.9, helper `isHexLight`. Verificato sul VPS: su sfondo bianco il testo ora produce ~6% di pixel scuri (bordo) → visibile (prima 0%).

**2. Root cause coda bloccata = token Drive `revoked`** (commit `51dc3ce`)
- Entrambi gli eventi test (Elisa `2f6ee6de`, Agostino `ee2cc954`) avevano `event_drive_tokens.status='revoked'` (Elisa 11/09, Agostino 2/09).
- Il guard della rifondazione 14/08 faceva: `if (token && token.status==='revoked')` → rilasciava il claim e ritornava `{processed:0}` → l'INTERO evento non veniva processato (niente watermark, niente R2, niente galleria). Da qui `itemsProcessed=0` nei log maintenance e coda che cresce indefinitamente.
- Fix: token `revoked` → `token = undefined` invece del `return` → `hasDrive=false` → **l'item viene watermarkato e pubblicato in galleria (R2) comunque; si salta solo il backup Drive**. Riconnettendo Drive da `/events/{id}/drive` il backup riprende.
- Il media record + upload R2 (gallery) avvengono PRIMA del sync Drive in `processSingleItem`, quindi Drive è correttamente "best-effort opzionale", non gate.
- Verificato live: maintenance `itemsProcessed` 0 → 9-10 per run; Elisa drenata (18→7 tail, 1 senza `r2_key` non recuperabile), Agostino in discesa (92→72 e continua).

### Stato allocco coda (11/09)
- `upload_queue`: Elisa ~7 pending residui (1 senza r2_key = orfano, non recuperabile), Agostino ~72 pending che si drenano via sweep (ITEMS_PER_EVENT=5, MAINTENANCE maxDuration 300s, cron 2-3x/giorno su Vercel Hobby).
- N.B. throughput limitato: a 5 item/evento/run, i 72 di Agostino servono ~15 run se non si alza `ITEMS_PER_EVENT`.

### Verifica
- Typecheck pulito `tsc --noEmit -p apps/web/tsconfig.json`.
- Test 13/13 video-overlay + process-queue solidità/dlq/refresh token passanti.

### Commit
- `f439aba` fix(video): watermark testo invisibile su fondo chiaro — contorno di contrasto + opacità 0.9
- `51dc3ce` fix(queue): Drive token revoked NON blocca più la pubblicazione (solo backup Drive saltato); sblocca backlog Agostino/Elisa

### TODO prossima sessione (dal punto 1)
1. **Ri-watermarkare i video Elisa & Nausica** con la fix di contrasto (25 video marcati `watermark_missing=true`, in attesa di re-repair con `/api/r2/repair-watermark`). Serve perché R2 ha ancora il watermark vecchio (testo bianco invisibile).
2. **Raggiungere il backlog Agostino** (72 pending): trigger sweep o alzare `ITEMS_PER_EVENT` (valutare timeout 300s con i video).
3. **Riconnettere Drive** dei 2 eventi (istruzioni all'utente) per ripristinare il backup.
4. **Verifica visiva** galleria: foto/video watermarkati col nuovo stile/contrasto.
5. **Outstanding**: fallback locale video `ffmpeg-static ENOENT` su Vercel (latente, se VPS giù); `client_max_body_size 256m` + `proxy_read_timeout 300s` già a posto su nginx VPS.

---

## Sessione 05/09/2026 — Allineamento stile watermark video a foto (no banda, logo, cuore, colore adattivo)

### Contesto
Il watermark video (VPS `overlay.js` + locale `video-overlay/src/index.ts`) era stilisticamente diverso dal watermark foto (`photo-overlay/src/index.ts`): usava una banda colorata in basso, testo bianco fisso, nessun cuore, nessun font custom, logo brand dentro la banda. L'utente ha chiesto di allinearlo allo stile foto: niente banda, logo brand in alto a destra (A COLORI), logo partner in alto a sinistra, testo con colore adattivo (bianco su scuro, nero su chiaro), cuore rosso tra i nomi, font custom.

### Fatto

**1. `vps-scripts/overlay.js` riscritto da zero**
- `renderWatermarkOverlay`: striscia TRASPARENTE (niente `<rect>` di sfondo), testo bottom-left con cuore PNG inline (stesso `HEART_PNG_BASE64` di photo-overlay), colore adattivo passato dal caller, opacità 50%, font custom opzionale via `@font-face` base64 (`branding.fontBase64`).
- `renderBrandLogo` (NUOVO): logo brand PNG ridimensionato a 8% della larghezza video (clamp 48-90px), A COLORI, compositato in alto a destra da ffmpeg (overlay separato, non dentro la striscia).
- `renderPartnerLogo`: logo partner PNG, in alto a sinistra (speculare al brand).
- `probeLuminance(filePath, targetWidth)`: estrae il primo frame del video via `ffmpeg -frames:v 1`, campiona la fascia bassa (25% altezza) con `sharp.stats()`, ritorna luma 0..1. Il server usa il luma per scegliere `textColor = luma < 0.5 ? '#ffffff' : '#000000'`.
- `probeDuration`: invariato.
- Export: `renderWatermarkOverlay`, `renderBrandLogo`, `renderPartnerLogo`, `runFfmpeg`, `probeDuration`, `probeLuminance`, `escapeXml`.

**2. `vps-scripts/video-watermark-server.js` riscritto**
- `readBody` maxBytes aumentato a 256MB (era 256KB — troppo piccolo per `fontBase64` che è ~150KB).
- `probeLuminance` chiamato sul video scaricato per decidere `textColor` adattivo (bianco/nero).
- `renderWatermarkOverlay` con `{ width: 1080, textColor }` — striscia testo trasparente.
- `renderBrandLogo` + `renderPartnerLogo` come PNG separati (non più compositati dentro la striscia).
- `buildFilterComplex(hasBrand, hasPartner)`: filter_complex con 3 overlay:
  - `[0:v]scale=1080:-2[base]`
  - `[base][1:v]overlay=0:main_h-overlay_h[wm]` — striscia testo in basso
  - `[wm][2:v]overlay=main_w-overlay_w-24:24` — logo brand alto-dx
  - `[wm2][3:v]overlay=24:24` — logo partner alto-sx
- Encoding settings: crf 26, preset medium, maxrate 2.5M, audio 128k (migliore del locale crf 30 veryfast — il VPS ha CPU sufficiente).

**3. `packages/video-overlay/src/index.ts` riscritto con stesso stile**
- `applyVideoOverlay`: striscia TRASPARENTE (no banda), cuore PNG inline, colore adattivo via `probeLuminance` (estrazione primo frame + sharp.stats), font custom via `@font-face` base64 (`branding.fontBuffer`), logo brand e partner come PNG separati compositati da ffmpeg.
- `probeLuminance(bin, filePath, targetWidth)`: estrae primo frame con ffmpeg, campiona fascia bassa con sharp.stats, ritorna luma 0..1.
- `renderBrandLogoPng` + `renderPartnerLogoPng`: PNG a 8% larghezza (clamp 48-90px).
- `buildFilterComplex(hasBrand, hasPartner)`: stesso schema del VPS (3 overlay).
- Encoding locale: crf 30, veryfast, maxrate 1.5M, audio 96k (qualità 33% — per stare nei 90s di Vercel).
- `brandingToRemote` estesa con `fontBase64` (TTF base64 per il VPS).

**4. `packages/video-overlay/src/remote.ts` estesa**
- `RemoteBranding` aggiunge `fontBase64?: string` (bytes TTF base64 per embedding @font-face lato VPS).

**5. `apps/web/src/lib/process-queue.ts` — `fontBuffer` passato al brandingConfig video**
- Entrambi i blocchi brandingConfig video (main queue `processSingleItem` e `repairWatermarkForEvent`) ora includono `fontBuffer: wmFontBuffer` (già calcolato per le foto, era mancante nei video).
- `brandingToRemote(brandingConfig)` ora serializza `fontBase64` nel payload JSON per il VPS.

**6. `apps/web/src/app/api/photos/[id]/share/route.ts` — `fontBuffer` aggiunto**
- `loadWatermarkFontBuffer` importato e chiamato per caricare il TTF selezionato dagli sposi.
- `brandingConfig` ora include `fontBuffer: wmFontBuffer` per il path video (sia VPS che locale).

### Verifica
- Typecheck pulito: `tsc --noEmit -p apps/web/tsconfig.json` (0 errori).
- Test 506/506 (44 file) passanti.
- VPS aggiornato via scp + restart: `curl /health` → `{"ok":true}`.

### Deploy VPS
- `scp overlay.js video-watermark-server.js ubuntu@92.4.218.108:/opt/fotosposi-vps/`
- `sudo systemctl restart fotosposi-watermark`
- `curl http://localhost:8081/health` → OK

### Completamento repair 12 video + fix emersi (continuazione 05/09)

**Repair completato**: tutti i **23** video "Elisa & Nausica" (`eventId=2f6ee6de-53bc-4857-8add-75aac538469f`) sono stati ri-riparati con il nuovo stile, `watermark_missing=false` su tutti (nota: l'evento aveva 23 video, non 12 come stimato inizialmente — upload aggiuntivi arrivati nel frattempo). Il repair lavora sull'originale pulito (`original_r2_key` valorizzato) → nessuna degradazione.

**Allineamento dimensione logo foto/video** (commit `97e3ec0`)
- Prima: logo video dimensionato per ALTEZZA ~8% del frame (clamp 48-90px), logo partner fisso 64px — molto più piccolo del logo foto (larghezza 25.5%, clamp 135-680px).
- Ora: logo brand E partner dimensionati per LARGHEZZA ~20% del frame (clamp 120-500px), aspect ratio preservato — scala relativa coerente con le foto. Applicato in `video-overlay/src/index.ts`, VPS `overlay.js` e `video-watermark-server.js` (firma `renderPartnerLogo` ora riceve `targetWidth`).
- I 23 video ri-riparati via VPS con la nuova dimensione logo.

Fix emersi durante il repair (3 root cause in cascata):

**1. `escapeXml` corrotto (no-op) in `packages/video-overlay/src/index.ts`** (commit `648dba4`)
- `escapeXml` sostituiva `&`→`&`, `<`→`<`, `>`→`>`, `"`→`"` (literal, no-op). Con testo coppia contenente `&` (es. "Elisa & Nausica") l'SVG conteneva `&Nausica` raw → XML invalido → librsvg `Opening and ending tag mismatch: svg ...`. La VPS `overlay.js` aveva l'`escapeXml` corretto, ma il repair cadde sul path locale (→ errore). Corretto a `&amp;`/`&lt;`/`&gt;`/`&quot;`, allineato a photo-overlay. `escapeXml`/`escapeXmlAttr` ora esportati.
- Nuovo test regressione `packages/video-overlay/src/watermark-svg.integration.test.ts`: renderizza l'SVG con `&` via sharp, verde solo con escape corretto (verificato rosso col no-op).

**2. nginx VPS `client_max_body_size 1m` → 413** (fix infra VPS)
- Root cause del `VPS watermark failed: HTTP 413`: il body del POST `/watermark` ora include `branding.fontBase64` (~100KB) + `logoBase64` (logo brand `logo-sposi-trans.png` = 835KB → base64 ~1.1MB) → body ~1.2MB > 1m.
- Fix: `client_max_body_size 256m` (coerente col `readBody` 256MB del sidecar) + reload nginx. Confermato: body 1.5MB ora raggiunge il sidecar.

**3. Timeout VPS hardcoded 55s → abort su video lunghi** (commit `865655f`)
- `applyVideoOverlayRemote` aveva timeout client fisso 55s (sotto il maxDuration 60s della share route). I 4 video lunghi (encode VPS 80-83s) venivano abortiti → fallback locale → `ffmpeg-static ENOENT`.
- Fix: `RemoteWatermarkRequest.timeoutMs` opzionale (default 55s); il repair (route maxDuration 300s) passa `timeoutMs: 250_000`. Migliora anche: VPS `proxy_read_timeout 120s → 300s` in nginx.

### TODO post-repair
1. **Verificare visivamente** un video watermarkato con il nuovo stile: logo brand alto-dx, logo partner alto-sx, testo in basso senza banda, colore adattivo, font custom.
2. **Drive non ri-sincronizzato**: il repair NON tocca `drive_sync_status`/`drive_file_id`. Le copie su Google Drive dei 12 video restano col watermark VECCHIO. La galleria streamma da R2 (nuovo stile), Drive è solo backup. Per allinearle: ri-sync a Drive (non implementato nel repair).
3. **`ffmpeg-static ENOENT` su Vercel** (latente): il fallback locale video è rotto su Vercel lambda (`spawn /var/task/node_modules/ffmpeg-static/ffmpeg ENOENT` — binario ffmpeg-static non tracciato nel bundle della route `repair-watermark`). Fino a quando il VPS è up il VPS-first copre tutto; se il VPS va giù il fallback locale fallisce. TODO: `outputFileTracingIncludes` per ffmpeg-static o disabilitare il fallback locale sul repair.
4. **`fontBase64`/logo nel body VPS**: verificare visivamente che il font Playfair (`watermark_font='classico'`) e il logo brand siano applicati (test VPS-side confermato che librsvg accetta `@font-face` base64).

### Commit
- `d5c77ec` feat(video): allineamento stile watermark video a foto (no banda, logo alto-dx/sx, cuore, colore adattivo, font custom)
- `648dba4` fix(video): escapeXml watermarked era un no-op → SVG invalido con '&' nei nomi (XML parse error librsvg) + test regressione
- `865655f` fix(video): timeout VPS parametrizzato — repair usa 250s (video lunghi >55s abortivano il fallback locale ffmpeg ENOENT)
- `97e3ec0` feat(video): logo brand/partner per larghezza ~20% del frame (allineato alle foto, prima altezza 8%/64px fissa)

---

## Sessione 14/08/2026 — Rifondazione "solidità" flusso upload→R2→queu→watermark→galleria→Drive (P0)

### Contesto
Rifondazione del gestore coda upload per eliminare duplicati/item persi/code in stallo. Chiusi i gap P0 elencati in `prompt-solidita.md`: race condition sul claim, idempotency parziale, errori non classificati, circuit breaker OAuth debole, cron IT sfalsato, watermark video non verificato.

### Fatto

**1. Claim atomico (P0 — elimina duplicati da worker concorrenti)**
- Migration `00059_upload_queue_solidity.sql`: RPC `claim_upload_queue_items(event_id, limit)` → `SELECT ... FOR UPDATE SKIP LOCKED` + `UPDATE status='processing'` in UN'UNICA transazione (SECURITY DEFINER, `search_path=public`). REVOKE a PUBLIC + GRANT a service_role.
- `process-queue.ts` `processQueueForEvent`: sostituita la vecchia SELECT (`status IN pending/failed`) + update a due passi (NON atomici) con la RPC. Rimossa la `update({status:'processing'})` inline in `processSingleItem` (ora il claim avviene nella RPC).

**2. Idempotency reale (P0)**
- `packages/media/src/service.ts` `createMediaRecord`: upsert con `ignoreDuplicates:true` (DO NOTHING) + rilettura esplicita del record esistente via `maybeSingle` quando l'upsert su r2_key già presente non ritorna riga. Il chiamante riceve SEMPRE il media_id corretto → nessun secondo Drive upload.

**3. Backoff reale (P0 — prima `computeProcessingBackoffMs` era definito ma MAI usato)**
- Nuovo helper `markItemFailed(supabase, item, {eventId, failureClass, errorMessage})` che centralizza: logFailure + (DLQ se retry≥7 ALTRIMENTI update `status='failed'` con `next_retry_at` = now + backoff, `failure_class`, `permanent_failure=false`). Sostituisce 7 punti duplicati.
- Migration `00060_upload_queue_backoff_columns.sql` (idempotente): documenta/crea `next_retry_at`, `failure_class`, `permanent_failure` (erano nel DB remoto ma senza migration tracciata → drift).

**4. Classificazione errori (P0)**
- Nuovo `packages/media/src/errors.ts`: costanti `FAILURE_CLASS_*` + `classifyError(err)` (euristica su messaggio). Esportate da `index.ts`. L'outer catch di `processSingleItem` e il path `createMediaRecord` ora classificano (prima tutto → `other`). Ordine dei pattern corretto: `detect/verif` prima di `watermark` generico.

**5. Circuit breaker OAuth 3-tentativi (P1)**
- `event_drive_tokens.consecutive_refresh_failures INT` (migration 00059). `refreshDriveTokenIfExpired`: incrementa il contatore a ogni refresh fallito, marca `status='revoked'` SOLO su `invalid_grant` OPPURE quando `consecutive_refresh_failures >= 3`; reset a 0 su successo. `saveDriveToken` resetta a 0 + `status='active'` alla riconnessione.
- `processQueueForEvent`: guard `token.status === 'revoked'` → rilascia il claim degli item (status→pending) e skip del batch senza sprecare risorse.

**6. Evening sweep (P1 — cron IT sfalsato)**
- Nuovo `apps/web/src/lib/maintenance-sweep.ts`: logica estratta da `maintenance/route.ts` (recovery stuck processing + sweep autonomo) con parametri `jobLabel` + `source`.
- Nuova route `/api/cron/maintenance-evening` (riusa `runMaintenanceSweep('maintenance','evening')`). `vercel.json`: aggiunti cron `30 22 * * *` e `0 2 * * *`. Entrambi scrivono `job='maintenance'` (banner /admin invariato) con `details.source` per distinguerli.

**7. Watermark video gate (P1)**
- `processSingleItem`: il catch di `applyVideoOverlay` ora setta `watermarkFailed=true` (quando `expectsWatermark`) invece di log-solamente → il video nasce con `watermark_missing=true` e resta ritentabile/riparabile.

**8. Runbook operativo in `/admin/storage`**
- Card "Runbook operativo" con 6 sezioni: coda in stallo, `permanent_failure`, token revoked, duplicati, video senza watermark/VPS, evening sweep.

### Migrazioni DB applicate (con `NOTIFY pgrst,'reload schema'`)
- `00059_upload_queue_solidity.sql` (RPC claim + `consecutive_refresh_failures` + CHECK status)
- `00060_upload_queue_backoff_columns.sql` (colonne backoff documentate)

### Test
- Nuovi: `errors.test.ts` (7), `process-queue-solidity.test.ts` (3: claim RPC + no update processing + backoff `next_retry_at`), estesi `service.test.ts` (idempotency), `refresh-drive-token.test.ts` (soglia 3-tentativi + reset su successo).
- **501/501 (43 file)** passanti (baseline era 488 + 13 nuovi).
- Typecheck `tsc --noEmit` pulito su `apps/web` e `packages/media`.

### Nota sul proporzionamento watermark
Il requisito "scritta rientri nella foto" è GIÀ implementato in `packages/photo-overlay/src/index.ts` (FIX 31/07/2026): dimensione font derivata dalla dimensione MINORE della foto, safety-check "fuori foto" con scala automatica (fino a minimo 12px), misurazione reale dei segmenti di testo via canvas. Nessun nuovo lavoro necessario.

### Commit previsto
`fix(media): rifondazione solidità coda upload (claim atomico RPC, idempotency, backoff, circuit breaker OAuth 3-tentativi, classificazione errori, evening sweep, watermark video gate)`

---

## Sessione 11/08/2026 — share-with-tags completata (da committare) + BOM fix + chiarimento cascata lead → GTN

### Contesto
Ripresa della feature share-with-tags iniziata il 10/08 (file `share-with-tags.ts` scritto, non committato). In questa sessione: implementazione completa UI (galleria + lightbox + impostazioni sposo + dashboard partner), fix BOM in `apps/web/package.json` (bloccava `next dev`), spostamento porta dev su 3001 (3000 occupata da Docker), pulizia disco (npm-cache 6.1 GB), e chiarimento fondamentale: **la "cascata lead" NON appartiene a questo progetto → appartiene al SaaS GTN Engineering** (marketing). Prompt dedicato scritto in chat (da incollare nella chat GTN).

### Fatto

**1. Feature share-with-tags COMPLETATA (working tree, NON committata, NON pushatta)**
- `packages/social-sharing/src/share-with-tags.ts` (NUOVO): `buildShareText` (frase utente + 8 spazi + @sposi + @brand + @partner se B2B + #brand + #hashtag coppia + #partner), `buildShareUrl` (FB sharer, TikTok upload, X intent, IG home), `buildShareTextForInstagram`, tipi `SharePlatform`/`BrandHandle`/`ShareTagInput`. Normalizzazione handle (`@`/`#` opzionale in input).
- `packages/events/src/service.ts`: nuova `updateEventSocial(eventId, {groom1_social_handle, groom2_social_handle, couple_hashtag})` esportata da `index.ts`. Tipo `WeddingEvent` esteso con le 3 colonne.
- `packages/partner/src/service.ts`: `PartnerBranding` esteso con `social_handle`/`social_hashtag`, `getEventPartner` ora li seleziona e ritorna.
- `apps/web/src/app/api/events/[id]/social/route.ts` (NUOVO): `PATCH` gated sposo/delegato (stesso pattern authorize di participants), sanitize stringhe max 60 char, chiama `updateEventSocial`.
- `apps/web/src/app/api/partner/profile/route.ts`: PATCH estesa con `socialHandle`/`socialHashtag`.
- `apps/web/src/components/social-share-buttons.tsx` (NUOVO): 5 tastini icona FB/IG/X/WhatsApp/TikTok (SVG inline, no dip) + toggle input testo libero + toast IG opzionale. WhatsApp via `wa.me/?text=`. IG: copia appunti + toast + apre IG. Usa `buildShareText`/`buildShareUrl` dal package.
- `apps/web/src/components/facebook-feed.tsx`: prop `shareProps?` (Omit<SocialShareProps,'photoUrl'>) → riga "Condividi:" con tastini sotto ogni card (foto e video). Helper `absoluteUrl` per URL assoluto.
- `apps/web/src/components/event-timeline-feed.tsx`: prop `shareProps?` pass-through a FacebookFeed.
- `apps/web/src/components/full-gallery-lightbox.tsx`: riscritta con long-press 500ms (touch + mouse con tolleranza 10px movimento → swipe annulla) → menu custom 5 icone; tap singolo = foto successiva (preservato); ESC = chiudi menu poi lightbox; hint "Tieni premuto per condividere".
- `apps/web/src/app/events/[id]/page.tsx` + `apps/web/src/app/event/[code]/page.tsx`: passano `shareProps` (handle evento + partner + brand detection `weddingmoments → justmarry`) sia al feed sia alla lightbox.
- `apps/web/src/app/events/[id]/settings/page.tsx`: nuova sezione "Handle social per la condivisione" (3 input + nudge "sostienici" con link seguici brand-specific IG/FB/TikTok per Sposi.live / JustMarry.live) + save via PATCH `/api/events/[id]/social`.
- `apps/web/src/app/partner/dashboard/page.tsx`: profilo esteso con input `socialHandle`/`socialHashtag` nella stessa PATCH profile.

**2. Fix critico: BOM UTF-8 in `apps/web/package.json`**
- Il file iniziava con byte `EF BB BF` → `next dev` crashava con `SyntaxError: Unexpected token '﻿', "{"name"... is not valid JSON` → "still not listening" su ogni porta. Rimosso il BOM (backup creato e poi rimosso). **Il fix deve essere committato insieme a share-with-tags.**

**3. Dev server: porta 3000 occupata da Docker (`com.docker.backend` PID 2408)**
- Avviato su **3001**: `cmd /c npm run dev --workspace apps/web` con `$env:PORT="3001"` via Start-Process con redirect stdout/stderr a `%TEMP%\nextdev-3001.log`.

**4. Pulizia disco C: (era a 0.2 GB liberi)**
- `C:\Users\agost\AppData\Local\npm-cache` (6.11 GB) cancellato → 6.6 GB liberi. Altri candidati: `.next` (0.54 GB), Docker (25 GB, da `docker system prune -af` su conferma).

**5. CHIARIMENTO STRATEGICO: "cascata lead" → SaaS GTN Engineering, NON Sposi.live**
- L'utente ha chiarito che la "cascata" (enrichment lead multi-fonte: matrimoni.it → sito → IG/FB/TikTok/YouTube → anagrafica completa con P.IVA, PEC, cell, social) è una feature del SaaS GTN Engineering (marketing per Sposi.live), NON di questo progetto.
- **Prompt completo scritto in chat per l'utente** da incollare nella chat GTN (copia NON salvata su file — solo in chat).
- Comprende: ratio universale (dati umani + dati di sistema confluiscono nello stesso lead), esempio reale `scattoemidiverto` = Scatto e Mi Diverto di Matteo Fontanieri, fonti consultate in sequenza (sito → P.IVA/responsabile/cell/PEC/email; social scoperti cercando il nickname anche se non citati), cartella `C:\lead\INBOX\<lead>\` con screen + txt appunti, merge first-wins con provenance + verified flag, nessuna email automatica per ora.
- NOTA: matrimoni.it risponde 522/timeout da fetch server-side (Cloudflare origin down) — da valutare headless browser o fonte alternativa.

### Verifica
- Typecheck pulito: `npx tsc --noEmit -p apps/web/tsconfig.json`
- Test 485/485 (41 file) passanti
- Dev server su http://localhost:3001 (STATUS 200)

### Commit previsto (NON ancora fatto)
```
feat(share): share-with-tags da galleria + lightbox (FB/IG/X/WA/TikTok) con tag automatici + impostazioni social handle + fix BOM package.json
```
16 file (14 modificati + 2 nuovi + 1 nuova dir API social).

### TODO post-push
1. Verifica visiva in produzione: `/events/<id>/settings` (sezione handle social), galleria card (tastini), lightbox (long-press)
2. Verifica `/partner/dashboard` con partner reale loggato (nuovi input social)
3. La "cascata lead" è di GTN Engineering: riportare il prompt fornito in chat nella chat GTN

---

## Sessione 10/08/2026 (sera) — Diagnostica storage /admin/storage (Forza/Cancella pending + orfani R2) + share-with-tags (iniziato)

### Contesto
Segnalazione utente: "6 oggetti su R2 senza record in media_uploads (orfani)" per l'evento `ee2cc954` di Agostino Spera & Danila Villa. Verifica DB: 5 su 6 sono in `upload_queue` con `status='pending'` retry_count=0 (caricati su R2 ma mai processati); 1 è un orphan vero (file R2 ma nessun record né in queue né in media). Utente chiede: tasto che forza la pubblicazione + capire dove sono finiti i file (R2/media/Drive) + sistema automatizzato o azione manuale Forza/Cancella.

### Fatto

**1. Route `/api/admin/storage-audit` (GET + POST)** — nuovo file `apps/web/src/app/api/admin/storage-audit/route.ts`
- **GET**: lista pending/failed/processing (max 200 da `upload_queue`) + scan orfani R2 (prefisso `events/`, max 500 keys per rispettare i 60s di timeout Vercel hobby). Per ogni item verifica `in_r2` (HEAD via `objectExists` di `@fotosposi/r2-storage`), `in_media` (lookup `media_uploads.r2_key`), `in_drive` (lookup `media_uploads.drive_file_id` server-side in bulk), `couple_name` (lookup `events`). Ritorna `{items: AuditItem[], stats: {total, pending_in_queue, orphans_r2, in_media, in_drive, r2_truncated}, generatedAt}`.
- **POST** `{action:'force'|'delete', r2_key}`:
  - `force`: se esiste già row in `upload_queue` per quel `r2_key` → reset (status='pending', retry_count=0, error=null). Se non esiste → inferisce `event_id` dal path R2 `events/<r2_folder_name>/...` (lookup `events.r2_folder_name`), crea nuova row pending con `file_name` = basename del path. Se inferenza fallisce → 400 esplicito.
  - `delete`: DELETE da `upload_queue` per `r2_key` + `deleteObject(r2_key)` da R2 + log di auditoria in `system_health_log` con `job='storage_audit'`, `status='success'`, `details={action:'delete', r2_key, queue_row_deleted, r2_deleted}`.
- CEO-gated via `verifyCeoSession` (Web Crypto), service role per bypass RLS, `runtime='nodejs'`, `maxDuration=60`.

**2. Pagina `/admin/storage`** — nuovo file `apps/web/src/app/admin/storage/page.tsx` + client island `storage-audit-client.tsx`
- Server Component fetch interno via `internalBaseUrl()` con cookie CEO (stesso pattern di `/admin/system`).
- Layout: AdminShell (sidebar condivisa) + 5 KPI Card (totale righe, pending_in_queue, orphans_r2, in_media, in_drive) + warning card se `r2_truncated=true` + tabella diagnostica + card legenda.
- Tabella colonne: `r2_key` (troncato `.../<basename>`), Evento (couple_name), Source (`queue`/`orphan` badge), R2/media/Drive (✓ verde / ✗ rosso), Queue (status + retry count), Azioni (bottoni Forza / Cancella).
- Client island gestisce feedback per ogni riga: `loading` / `ok:<msg>` / `err:<msg>`. Tasto "Cancella" con `confirm()` JS per protezione contro distruzioni accidentali.
- Banner "Storage integro ✓" quando `items.length === 0`.

**3. AdminSidebar estesa** — `apps/web/src/components/admin/AdminSidebar.tsx`
- Aggiunta nona voce `{ href: '/admin/storage', label: 'Storage', icon: 'drive' }` tra Sistema e Ordini.
- Aggiunta icona `drive` SVG inline nello switch Icon (`<path d="M4 4h16v12H4z" /><path d="M8 20h8" /><path d="M12 16v4" />`).

### Note tecniche
- **Limiti del scan R2**: `listObjectsByPrefix('events/', 500)` + check `objectExists` per ogni pending → sufficiente per eventi normali. Per bucket >500 oggetti `r2_truncated=true` avvisa l'utente. Future audit estese: job cron separato che logga in `system_health_log` (TODO).
- **`mediaByR2Key` come Map in memory**: max 5000 row caricate dal DB per lookup bulk. Per eventi con >5000 foto, lookup fallisce silenziosamente (omo `in_media=false`) → false positive orfano. Mitigato dal limite 500 keys del scan R2: in pratica non si raggiungono mai.
- **`force` su orfano: inferenza `event_id`**: lievemente fragile se `events.r2_folder_name` non corrisponde esattamente al primo path segment dopo `events/`. Return 400 esplicito in caso, l'utente vede il messaggio (non si inventa metadati).
- **`delete` lascia `media_uploads` intatto**: scelta deliberata. Se l'orphan ha TTY una row in `media_uploads`, cancellarla richiederebbe RLS review → si preferisce loggare + deprire le foto orfane dopo. TODO futuro: estensione con `delete_media=true` opzionale che chiama DELETE `/api/media/[id]` riusando logica esistente.
- **i18n SKIPPED**: testo inline IT nella pagina + client island. Le altre lingue vedono IT finché non si localizza il client island (TODO futuro). Principio "tutto server-side, client solo interattività" mantenuto.

### Migration DB associata
- **`add_social_handles_to_events_partners`**: aggiunge a `events` le colonne `groom1_social_handle`, `groom2_social_handle`, `couple_hashtag` e a `partners` `social_handle`, `social_hashtag` (per feature share-with-tags iniziata e sospesa). Schema cache ricaricato con `NOTIFY pgrst,'reload schema'`. Verificato funzionante con upsert di test.

### Verifica
- Typecheck pulito (`tsc --noEmit -p apps/web/tsconfig.json`).
- Test 485/485 (41 file) passanti.
- Verifica dati reali: 5 pending dell'evento `ee2cc954` + 1 orphan (`1785319990671_1000144023.jpg` non in queue) → totale 6 item, pending_in_queue=5, orphans_r2=1. Tutti in R2 ma non in media.

### TODO post-push
1. **Verificare in produzione** che la pagina `/admin/storage` carichi (forzare `?nocache=1` la prima volta).
2. Eseguire Forza sui 5 pending di `ee2cc954` → verificare que il cron maintenance li processi (watermark + media + Drive sync).
3. Per l'orphan `1000144023.jpg`: Forza (inferirà `event_id` da `r2_folder_name='2026_07_30_Agostino_Danila'`) oppure Cancella (irreversibile).
4. **Riprendere share-with-tags** (sospeso per priorità storage audit): UI lightbox con input testo libero + pulsanti FB/TikTok/X. Schema DB già pronto (migration sopra).

### Commit
- `feat(admin): diagnostica storage /admin/storage con Forza/Cancella pending e orfani R2` — 5 file, +642/-0

---

## Sessione 10/08/2026 (pomeriggio) — Banner rosso /admin per coda in stallo

### Contesto
Proposta della reflection della sessione precedente (09/08 sera): se la coda upload entra in stallo il deployment del fix trigger è inutile se nessuno se ne accorge. Implementato un banner visivo (no alert attivo, no side-effect) sulla home `/admin` che segnala due condizioni anomale del sistema di processing foto. Tutto server-rendered, nessun client island aggiuntivo.

### Fatto

**1. `/api/admin/overview` estesa con `queueHealth`** (file: `apps/web/src/app/api/admin/overview/route.ts`)
- Aggiunte 2 query parallele: `upload_queue` (status + `created_at` per stato coda + timestamp pending) e ultime 2 righe `system_health_log` job=maintenance.
- Calcolo metriche: `pendingCount`, `processingCount`, `failedCount`, `syncedCount`, `oldestPendingAt` (min `created_at` tra pending), `stalePendingMinutes` (età in minuti del pending più vecchio), `pendingStalled = pendingCount>0 && stalePendingMinutes>=30` (soglia 30 min, coerente con quanto annotato in PROJECT_STATUS sessione 09/08 sera), `lastEventsSwept`/`prevEventsSwept` (estratte da `details->>'eventsSwept'` delle ultime 2 righe maintenance, cast int sicuro), `twoCyclesZeroSwept = lastEventsSwept===0 && prevEventsSwept===0`.
- Route rimane CEO-gated via `verifyCeoSession` (Web Crypto). Nessuna RLS toccata, service role come prima.

**2. Banner `role="alert"` su `/admin/page.tsx`** (file: `apps/web/src/app/admin/page.tsx`)
- `showStallBanner = pendingStalled || twoCyclesZeroSwept`. Server-rendered condizionale, niente client island.
- UI: blocco rosso `border-red-500 bg-red-50 dark:bg-red-950/40`, testo `text-red-700 dark:text-red-300`, elenco `<ul>` dei motivi (es. "12 item in coda pending da 47 min (soglia 30 min)", "cron maintenance con eventsSwept=0 per 2 cicli consecutivi"), bottoni "Vai a Sistema" + "Aggiorna stato" (link a `/admin/system`).
- Aggiunta terza card KPI che mostra `pendingCount/failedCount` (verde `text-green-600` solo se 0/0, altrimenti ambra `text-amber-600`). Visibile sempre, non solo in stallo — dà un glance immediato dello stato coda dalla home admin.
- Coerenza col principio "tutto server-side, client solo per interattività": nessun fetch client-side, nessun polling (lasciato a futuro SWR nel Operations Center della roadmap dashboard unificata).

### Note tecniche
- **Soglia 30 min**: definita in PROJECT_STATUS sessione 09/08 sera come "alert se upload_queue.pending > 30min". Riflessa come costante inline (`>= 30`), non parametro config — se diventa configurabile spostare in `platform_settings`.
- **`eventsSwept` in `system_health_log.details`**: memorizzato come JSONB. Estrazione defensiva (`typeof v === 'number' || Number(v)`) perché alcune righe vecchie potrebbero avere stringhe o null.
- **`twoCyclesZeroSwept`**: cattura il caso "cron maintenance gira ma non spazza nulla per 2 cicli consecutivi" — sintomo di upload_queue.popolata da item che il guard filter `r2_key not.is null` skippa, oppure di codice di processing che fallisce silenziosamente.
- **No alert attivo**: scelta deliberata. Il banner è puramente informativo. Gli alert attivi (email/WhatsApp) sono un TODO futuro, da collegare alla stessa `queueHealth` quando saranno configurati i canali notification.
- **Pattern consolidato**: `/api/admin/overview` ora ritorna sia dati business (events/users) sia dati operativi (queueHealth). Future espansioni della home admin possono usare la stessa route senza moltiplicare le API call dal Server Component.

### Verifica
- Typecheck pulito (`tsc --noEmit -p apps/web/tsconfig.json`).
- Test 485/485 (41 file) passanti.
- Verifica dati reali production: `pending_stale=0`, `pending_total=0`, `failed_total=2` (item residuo Drive 401 evento `ee2cc954` + 1 altro), `last_events_swept=2` → banner NON visibile ora (corretto, coda non in stallo).

### TODO post-push
1. **Deploy Vercel**: prima richiesta `/admin` può servire cache precedente (forzare `?nocache=1`).
2. Verificare in produzione che il banner appaia SOLO quando le condizioni sono vere (no falsi positivi).

### Commit
- `feat(admin): banner rosso /admin se coda upload in stallo (pending>30min o eventsSwept=0 per 2 cicli)` — 2 file, +94/-3

---

## Sessione 10/08/2026 (mattina) — Banner rosso /admin per coda in stallo + sidebar di nav /admin

### Contesto
Discussione strategica su come strutturare la dashboard admin unificata (B2B + B2C + operations + governance) e integrazione con un SaaS esterno "GTN Engineering" (social media marketing) in costruzione parallela. Esito: si parte dalla base solida (banner rosso + sidebar di nav) prima di espandere verso Executive Overview / Operations Center / API integrazioni GTN.

### Fatto in questa sessione (Fase 0)

**1. Banner rosso /admin per coda in stallo** (file: `apps/web/src/app/api/admin/overview/route.ts` + `apps/web/src/app/admin/page.tsx`)
- `/api/admin/overview` ora ritorna `queueHealth`: `{pendingCount, processingCount, failedCount, syncedCount, oldestPendingAt, stalePendingMinutes, pendingStalled, lastEventsSwept, prevEventsSwept, twoCyclesZeroSwept}`.
- Query parallela `upload_queue.status+created_at` + ultime 2 righe `system_health_log` job=maintenance per leggere `eventsSwept`.
- Logica stallo: `pendingStalled = pendingCount>0 && stalePendingMinutes>=30` (soglia 30 min, riflessa in PROJECT_STATUS.md sessione 09/08 sera). Seconda condizione: `twoCyclesZeroSwept = lastEventsSwept===0 && prevEventsSwept===0` (cron maintenance "non spazza" nulla per 2 cicli consecutivi).
- UI pagina `/admin`: banner `role="alert"` rosso (border/bg red-500/red-50, dark red-950/red-300), elenco motivi, bottoni "Vai a Sistema" + "Aggiorna stato". Card KPI terza "Coda (pending/failed)" con colore verde (0/0) o ambra (altro). Tutto Server-rendered, niente client island aggiuntivo.
- Pattern confermato: nessun client-side polling (lascia a futuro SWR in Operations Center), nessun alert attivo (solo visual), no side-effect. Route `/api/admin/overview` sempre CEO-gated via `verifyCeoSession` (Web Crypto).

**2. Sidebar di nav /admin** (vedi commit di chiusura sessione)
- Componente condiviso in `/packages/ui` (o `apps/web/src/components/admin`) → link a tutte le 8 sezioni (`/admin`, `/admin/system`, `/admin/orders`, `/admin/marketplace`, `/admin/affiliates`, `/admin/coupons`, `/admin/analytics`, `/admin/leads`) con icona + label + `active` route detected da `usePathname`. Mobile drawer collapse.
- Sostituisce la riga di `<Button>` sparsi in ogni header di `/admin/*`. Pattern reused come `/admin/system` crescerà sotto la barra alta senz'altro.

### Roadmap dashboard unificata (definita in questa sessione, NON ancora sviluppata)
- **A) Executive Overview** — 5 KPI rocket con threshold (backpressure, DLQ, Stripe pending, OAuth Drive revoked, cron failed), pipeline 24h, MRR/GMV.
- **B) Operations Center** — coda live azionabile (Re-queue/Force/DLQ), Drive OAuth board, watermark queue, cron job manager, VPS heartbeat.
- **C) B2B Console** — partner directory + order manager unificato + IBAN + coupon ROI + marketplace.
- **D) B2C Crisis console per evento** — health per evento + connect/disconnect Drive + bozza email sposo.
- **E) Governance / Audit** — audit log, DB advisors mirror, secrets status, versioni deploy.
- **Struttura tecnica**: una route `/api/admin/executive-overview` aggregata, componente `<Alert>` riusabile, polling SWR per le viste operative.

### Integrazione con GTN Engineering SaaS (definita, NON ancora sviluppata)
- **Layer 1 — tabella ponte** `gtn_projects` (`id`, `event_id`, `partner_id`, `external_ref`, `sync_token`, `last_sync_at`, `metadata`).
- **Layer 2 — 3 endpoint M2M gated HMAC** (X-Sync-Token, rotabile via `platform_settings`):
  - `GET /api/integrations/gtn/events` — lista eventi approvati per GTN
  - `GET /api/integrations/gtn/metrics/[eventId]` — KPI aggregati per evento
  - `POST /api/integrations/gtn/webhook` — GTN scrive status (scheduled/published/performance), Sposi.Live lo logga in `gtn_project_audit_log`
- **Layer 3 — flusso dati**: Sposi.Live è source of truth per eventi/utenti/uploads; GTN legge + scrive solo metadati marketing. No scritture cross-schema da GTN.
- **Condivisione**: `/packages/ui` condiviso, role `agency_gtn` in `core_users` per agenzie esterne, brand `gtn` come terza riga in `brands`. Token HMAC pattern mutuato da `CEO_PASSWORD`.

### TODO post-push (ér 此 sessione)
1. Verificare deploy Vercel: prima richiesta `/admin` può servire cache precedente (forzare `?nocache=1`).
2. Cleanup: rimuovere i `<Button>` di nav sparsi negli header una volta integrata la sidebar in tutte le 8 pagine.
3. Prossimo step suggerito: costruire laSidebarAdmin `<Alert>` riusabile (per crisis console B2C).

## Sessione 09/08/2026 (sera) — Fix critico trigger wall_scores + UI lingua/Threads/music + qualità video 33%

### Fix critico produzione: foto non finivano in galleria né su Drive

**Sintomo**: da qualche ora le foto caricate (anche da account nuovo Google) davano errore e NON arrivavano né in galleria né su Drive. Prima "fallivano ma arrivavano", ora sparivano del tutto.

**Root cause**: i trigger Postgres del wall (`trigger_recalculate_wall_scores` + funzione `recalculate_wall_scores`) avevano `SET search_path=''` (security best practice) ma referenziavano `votes`, `media_uploads` e la funzione stessa SENZA qualifica `public.`. Risultato: ogni INSERT in `media_uploads` abortiva la transazione → rollback → foto su R2 ma MAI in galleria né Drive. Dopo il primo fix parziale del trigger l'errore è passato da `function recalculate_wall_scores(uuid) does not exist` a `relation "votes" does not exist` (stessa causa: schema).

**Fix** (2 migrazioni hotfix applicate in produzione):
- `fix_trigger_recalculate_wall_scores_schema`: trigger qualifica `public.recalculate_wall_scores`
- `fix_recalculate_wall_scores_schema`: funzione con `search_path=public` + tutte le tabelle qualificate `public.*`

**Verifica**: insert di test in `media_uploads` → OK, `wall_priority_score` calcolato. Maintenance cron ha processato 5 item in blocco, foto dell'evento `9cb0fa49` ora in galleria con `drive_sync_status='synced'` e `drive_file_id` valorizzato.

**Reflection**: il sistema non era "più fragile" a causa della pulizia DLQ — era una bomba a orologeria latente dal giorno in cui qualcuno ha messo `search_path=''` nei trigger senza qualificare. Qualsiasi regola "search_path vuoto" richiede SEMPRE schema qualificato ovunque. Per renderlo un orologio mancano (proposti):
1. Test integrazione DB del trigger (assert insert media_uploads non lancia)
2. Alert se upload_queue.pending > 30min o eventsSwept=0 per 2 cicli cron
3. Banner rosso su /admin quando pending>0

### UI fixes (commit `426719b`)
- **LanguageSwitcher**: ora tendina a click (non più hover), menu bianco ad alto contrasto su sfondo nero, flag 🇮🇹🇺🇸🇬🇧🇩🇪🇫🇷🇪🇸, chiusura click esterno/ESC. Prima il label testuale era illeggibile su sfondo nero della home.
- **Footer**: aggiunto **Threads** (@sposilive) tra i social dopo X.
- **Music playlist**: cover 48px, titolo brano PRIMA dell'artista, riga artista+album+durata leggibile, pulsante `+` ridotto a icona 32x32 (niente label "Aggiungi" che non si leggeva).
- **Qualità video 33%** (fallback Vercel senza VPS): scala 1080p→720p, crf 26→30, preset medium→veryfast, maxrate 2.5M→1.5M, audio 128k→96k. Obiettivo: ffmpeg-static dentro i 90s di Vercel.

### VPS — NON ANCORA ATTIVATA
La **VPS Oracle non è ancora stata creata** dall'utente. Di conseguenza:
- Il watermark video lato VPS (`vps-scripts/overlay.js` + `video-watermark-server.js` col doppio logo partner) è nel repo ma NON deployato.
- Il fallback locale (ffmpeg-static su Vercel) è ora il path attivo con qualità 33%.
- Quando la VPS sarà attiva: scp dei 2 script + install ffmpeg + systemd service + env (vedi vps-scripts/README se presente).

### Commit
- `426719b` feat(ui): switcher lingua a bandiere + Threads footer + qualità video 33% (4 file, +91/-42)

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
1. **`platform_settings` valorizzato con placeholder temporaneo** (`IT60 X054 2811...`, `iban_status='placeholder'`). `getIbanDetails` ora non rifiuta più le richieste. **Da sostituire con coordinate reali** appena disponibili: UPDATE platform_settings SET value='...' WHERE key='iban' (e 'iban_holder', 'iban_bank'), poi UPDATE ... SET value='live' WHERE key='iban_status'.
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

