# PROJECT STATUS — Sposi.live / JustMarry.live

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

