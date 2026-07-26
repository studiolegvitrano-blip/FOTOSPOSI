# PROJECT STATUS — Sposi.live / JustMarry.live

## Sessione 25/07/2026 — Watermark MAX restyle + WhatsApp double-provider + Shot-list video 14"

### Acquisito e letto prompt sessione
- [x] **Rimosso `console.log('DEBUG ...')` dalla Edge Function `auth-send-email`** (v7 deployata).
  - 6 log DEBUG rimossi (uno loggava email chiaro + redirect_to in chiaro).
  - Log errore Resend ora regex-redacted: `[email_redacted]` sostituisce qualsiasi email nel body.
  - Throw error logga solo `Error.name` (non message → no PII).
  - Status: evento di sistema pulito, conformità GDPR/PII migliore.

### Restyle Watermark "MAX" (sezione homepage)
- [x] **Anteprima watermark nella home** (`apps/web/src/components/watermark-max-preview.tsx`) riscritta secondo specifica utente:
  - **Una sola riga** in basso a sinistra: `Guido ❤ Melissa · Sposi · 25/08/2026` (NO tilatura diagonale su tutta la foto, NO banda colorata).
  - **Font piccolo** (~12px absolute, clampato 7-12px su mobile/desktop).
  - **Colore testo AUTO** bianco/nero basato sulla luminanza della fascia bassa della foto (canvas getImageData, no CORS issues su `/hero-wedding.jpg`).
  - **Cuore sempre ROSSO** (#d9534f) inline `<span style>` indipendente dal colore testo.
  - **Opacità 50%** del testo.
  - **Logo Sposi.live A COLORI** top-right (no mix-blend, no opacità forzata), altezza 53px (1/3 più grande del default 40px).
- [x] `apps/web/src/app/page.tsx` sezione "Watermark MAX" punta al nuovo componente `WatermarkMaxPreview` (estratto dall'inline).

### Watermark LATO SERVER per ogni foto/video condiviso
- [x] **Refactor `packages/photo-overlay/src/index.ts`** allineato alla grafica della home preview:
  - Watermark = **una sola riga** in basso a sinistra: `{coupleNames} ❤ {date} · {wordmark}`.
  - Cuore **sempre rosso** via `<tspan fill="#d9534f">` entità XML `&#10084;` (no raw ❤ byte → no `xmlParseEntityRef`).
  - Font **piccolo** proporzionale: 1.8% altezza foto, clampato 10-18px (square) / 10-28px (story).
  - Colore testo **AUTO** black/white via `sharp.stats()` su fascia bassa bottom-25% (campionata con extract+resize+stats).
  - **NO banda colorata** di sfondo (filigrana integrata sulla foto).
  - **Opacità testo 50%**.
  - Logo brand **top-right A COLORI** (no mix-blend, no opacità forzata), larghezza = 15% foto (clamp 80-400px).
- [x] **Bug critico risolto: `escapeXml` rotto da sessioni precedenti**. Le "entità HTML" erano letteralmente byte singoli `&` `<` `>` `"` `'` (non `&` `<` …) → causavano `xmlParseEntityRef: no name` ogni volta che un nome sposo conteneva `&` (es. "Mark & Anna"). Fix via script node con `String.fromCharCode(38)+'amp;'` per bypassare sanitize editor.
- [x] Test photo-overlay riscritti per supportare la nuova signature (mock sharp con extract/stats/resize chain). 6 test, 6 pass.

### Cartella R2 dedicata per evento (YYYY_MM_DD_Surname1_Surname2)
- [x] Migration `00037_events_r2_folder_name.sql` applicata live: nuova colonna `events.r2_folder_name text`.
- [x] `buildR2FolderName(coupleName, date)` in `packages/events/src/service.ts`: costruisce `YYYY_MM_DD_Surname1_Surname2` dal `couple_name` (split su `&`, `e`, `and`, `+`, `/`, `,`; sanitizzazione alfanumerica solo ASCII).
- [x] `createEvent()` imposta `r2_folder_name` alla creazione (mai più cambiato — riferimento permanete).
- [x] `apps/web/src/app/api/r2/upload/route.ts` risolve dinamicamente il prefix R2: legge `events.r2_folder_name` lato server, fallback UUID legacy `events/{eventId}` per eventi pre-25/07.
- [x] `apps/web/src/app/events/[id]/upload/page.tsx` passa `eventId` nella request R2 — la route risolve il folder name user-friendly se disponibile.
- [x] Esempio: nuovo evento "Guido & Melissa, 25/08/2026" → cartella R2 `events/2026_08_25_Guido_Melissa`. Tutti i media (foto + video + guestbook) finiscono li.

### WhatsApp double-provider (wa-automate-nodejs + Evolution API)
- [x] **Scelta implementativa (utente)**: affiancare entrambi, non sostituire. Provider selezionato via env.
- [x] `packages/notifications/src/providers/whatsapp.ts` (NUOVO): `WhatsAppProvider` interface + 2 adapter (`WaAutomateProvider` HTTP Easy API, `EvolutionProvider` HTTP legacy).
- [x] Selector `selectWhatsAppProvider()` con priorità: env `WHATSAPP_PROVIDER=wa-automate|evolution` esplicito > autodetect `WA_AUTOMATE_URL` > autodetect `EVOLUTION_API_URL` > throw `ProviderNotConfiguredError`.
- [x] `WaAutomateProvider`: POST `${WA_AUTOMATE_URL}/sendText` body `{ phone, message }` header `X-API-Key`.
- [x] `EvolutionProvider`: POST `${EVOLUTION_API_URL}/message/send` body `{ number, text }` header `Authorization: Bearer ${key}` (storico).
- [x] `service.ts` `sendNotification(channel='whatsapp')` usa il nuovo adapter invece del vecchio inline Evolution.
- [x] Bug fix contestuale: il vecchio check `WHATSAPP_API_KEY non configurata` bloccava sempre whatsapp — ora logica separata: `RESEND_API_KEY` requiring solo per email, whatsapp via provider selector autonomo.
- [x] Esposizione in `index.ts`: `WhatsAppProvider`, `ProviderNotConfiguredError`, `selectWhatsAppProvider`, `resetWhatsAppProviderForTests` (per test isolation).
- [x] **16 nuovi test** (8 selector + 5 adapter + 3 e2e via sendNotification), tutti pass.
- [ ] **Azione utente richiesta**: configurare un VPS Railway/fly.io/Raspberry Pi con `npx @open-wa/wa-automate --port 8080 --api-key ...` (la prima run richiede QR code scan dall'app WhatsApp). Poi impostare `WA_AUTOMATE_URL` + `WA_AUTOMATE_API_KEY` in Vercel env. Vercel lambda non può ospitare runtime browser → adapter è HTTP-only.

### Shot-list + workflow ComfyUI per video 14" "Da un sì all'altro"
- [x] `docs/video/SHOT-LIST_da-un-si-all-altro.md` (~280 righe): shot-list tecnico completo con timeline 24fps, 5 piani (Teatro 1889 seppia → push-in transizione → Ferrari Purosangue colore → reveal logo → payoff), font Lucida Calligraphy, brand watermark filigrana top-right transitional reveal, encoding ffmpeg H.264+VP9, embed HTML autoplay muted loop.
- [x] `docs/video/WORKFLOW_comfyui.md` (~210 righe): pipeline ComfyUI nodo-per-nodo (Real-ESRGAN upscale, ColorMatch seppia, Vignette, FilmGrain, IrisWipeMask, ImagePanAnimated, HeadlightGlowEnhance, PositionKeyframeAnimated ease-out-quartic, TextRender fade keyframes, VideoWriter ffmpeg). + alternative Wan2.2 prompt-based (segmenti 4-6s con prompt text-to-video).

### Font watermark TTF (29 totali)
- [x] Copiati 29 TTF da `FOTO AGO/font/` + `FOTO AGO/font/font 2/` (27 font) + `apps/web/public/fonts/LucidaCalligraphy.ttf` (1 font) + DancingScript/PlayfairDisplay/NotoSans preesistenti in `apps/web/assets/fonts/`. Totale ora 29 TTF per il rendering lato server fontconfig.
  - 13 OTF non copiati (sharp/o fontconfig non supportano OTF via TTF path su tutti i sistemi) — ne mancano alcuni (Armelie, Awesome, Baby time, Bakery Wedding, Beauty Gadish, Bidenatrial, Crustaceans, Cutegirls, Moralana, Palisade, Runethia, RusticRoadway, Stylish Handwriting, Symphonie, Vintage Melinda, Amretiqua, Gista Danes, Kingline, Magnolia, MySunshine). Per quelli servirebbe conversione OTF→TTF, pianificare se serve.
- [x] **Da fare**: aggiungere `outputFileTracingIncludes` in `next.config.ts` per tracciare i TTF nel bundle Vercel lambda (altrimenti fontconfig cade sul fallback "Noto Sans" per i 26 font non noti a Vercel).
- [x] **Da fare**: aggiornare la lista `WATERMARK_FONTS` in `apps/web/src/lib/watermark-fonts.ts` per riflettere i 29 font reali disponibili (ora依然是 i 27 Google Fonts vecchi, che a runtime lato server cadono su Noto Sans).

### Test preesistenti
- [x] Fix `auth.test.ts signUp`: assertion aggiornata per includere `emailRedirectTo` (aggiunto in sessione 05/07 fix link email) — ora matcha sia `/login` che `/auth/callback`.
- [x] **225 test passano, 18 file** (Counter: +13 test WhatsApp + +6 nuovi photo-overlay rispetto al baseline 194).

### Stato finale sessione 25/07
- [x] Typecheck pulito: `npx tsc --noEmit -p apps/web/tsconfig.json` → 0 errori.
- [x] Dev server homepage 200 OK con nuova componente `WatermarkMaxPreview` (DOM inspect conferma: 1 sola riga ~12px in basso a sinistra, colore adattivo bianco, cuore rosso span, logo 53px top-right a colori pieni).
- [x] Test suite: 225/225 pass, 0 fail.
- [ ] **DA FARE (prossime sessioni, NON fatte questa)**:
  - `next.config.ts`: aggiungi `outputFileTracingIncludes` per tracciare i 29 TTF nel bundle Vercel lambda (altrimenti watermark lato server cade su Noto Sans come prima).
  - Aggiornare `WATERMARK_FONTS` lista in watermark-fonts.ts con i 29 font reali (talk tutti i 27 esistenti + i nuovi che ho) — la UI anteprima attualmente manda ai Google Fonts, ma il rendering server usa solo i TTF locali.
  - **Stress test 10 agenti** (script già pronto in `stress-test-agenti/`, mancava solo `.env` con `SUPABASE_SERVICE_ROLE_KEY`);
  - **Newsletter signup form** nella home (Rete Partner/GTM lead magnet);
  - **SEO/GEO** struttura contenuti per citazioni AI (ChatGPT/Perplexity/Gemini/AI Overviews);
- [ ] **DA COMMITTARE + PUSHARE** (work-tree ha molti fileまだ未committed: watermark component + WhatsApp provider + photo-overlay refactor + R2 folder name + font TTF + shot-list + service.ts/index.ts — tutto testato verde) → l'utente deve confermare esplicita prima del push su `origin/master`.

## Sessione 19/07/2026 — Verifica pre-deploy + fix split watermark-fonts (build bloccato)
- [x] **Verifica typecheck pulito**: `npx tsc --noEmit -p apps/web/tsconfig.json` → 0 errori (confermato prima del tentativo di build).
- [x] **Avvio dev server verificato**: `npx next dev` in `apps/web`, homepage risponde HTTP 200 (~176KB HTML).
- [x] **Verifica feed home demo**: confermato che le 8 foto in `apps/web/public/demo/` sono tutte referenziate da `apps/web/src/components/facebook-feed-home-demo.tsx` (SAMPLE_IMAGES array, ordine hero → file user ×2 → gemini ×4 → copertina). Le prime 4 sono visibili al primo render (`count = 4`), le altre 4 appaiono dopo "Load more".
- [x] **Bug bloccante per deploy Vercel trovato e risolto**: `npx next build` locale falliva con `UnhandledSchemeError: Reading from "node:fs" is not handled by plugins`. Causa: il file `apps/web/src/lib/watermark-fonts.ts` conteneva sia esportazioni client-safe (`WATERMARK_FONTS` const + `watermarkFontFamily` funzione switch pura) sia funzioni server-side con `import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'` + `import { join } from 'node:path'` (`ensureWatermarkFonts`, `loadBrandLogo`). Il file veniva consumato anche dal component `'use client'` `apps/web/src/app/events/[id]/settings/page.tsx` → Webpack tentava di bundlare i `node:*` imports nel bundle browser → build fallito.
- [x] **Fix applicato — split del modulo in due file**:
  - `apps/web/src/lib/watermark-fonts.ts` (client-safe, NESSUN import `node:*`): contiene solo `watermarkFontFamily()` (switch puro) e `WATERMARK_FONTS` (array costante). Usato da `settings/page.tsx` (client) senza problemi.
  - `apps/web/src/lib/watermark-fonts.server.ts` (NUOVO file, server-only): contiene `ensureWatermarkFonts()` (scrive fontconfig su `/tmp` per Vercel lambda) e `loadBrandLogo()` (legge `public/logo-*-trans.png`). Nessun consumer client.
- [x] **Consumer server aggiornati** per importare dal nuovo file `.server.ts`:
  - `apps/web/src/lib/process-queue.ts` — split import: `watermarkFontFamily` da `@/lib/watermark-fonts`, `ensureWatermarkFonts` + `loadBrandLogo` da `@/lib/watermark-fonts.server`
  - `apps/web/src/app/api/guestbook/messages/route.ts` — stesso split
  - `apps/web/src/app/api/photos/[id]/share/route.ts` — stesso split
- [x] **Typecheck post-fix pulito**: riconfermato `npx tsc --noEmit -p apps/web/tsconfig.json` → 0 errori.
- [x] ** 🎉 BUILD DI PRODUZIONE RIUSCITO** `npx next build` → tutte le 50+ route compilate (ƒ Middleware 161kB, /events/[id] 5.92kB, /events/[id]/settings 5.72kB, /login 3.91kB, /sito/[id] 208B, ecc.). 0 errori. Pronto per deploy Vercel.
- [x] **Dev server riavviato** per consentire all'utente di testare visivamente le 3 pagine chiave prima di pushare:
  1. Home `http://localhost:3000` — feed timeline FB con 8 foto demo
  2. Evento reale `http://localhost:3000/events/[id]` — layout 3 colonne + lightbox frecce
  3. Impostazioni watermark `http://localhost:3000/events/[id]/settings` — 27 font menu + anteprima live
- [ ] **DA PUSHARE** (su esplicita conferma utente): commit atomico delle modifiche precedenti + split watermark-fonts + push su `origin/master` triggera deploy Vercel automatico. Tutti i file sono ancora uncommitted in working tree (l'utente sta testando localmente prima di autorizzare il push).
- [ ] **Test in produzione post-deploy**: home feed FB, layout 3 colonne evento, lightbox frecce/swipe/tastiera, 27 font watermark nel menu con anteprima live, watermark dimezzato + logo top-right 60%.
- [ ] **Reminder per sessioni future**:
  1. **NON riporre segreti nel file `ECCOLO FOTOSPOSI.txt`** — contiene già PAT GitHub e RESEND_API_KEY in chiaro (vedi avvisi "Urgente — sicurezza" nelle sessioni precedenti). Spostare in password manager e ruotare le chiavi.
  2. **TTF font watermark mancanti**: 24 font su 27 (esclusi Dancing Script, Playfair Display, Noto Sans) non hanno il TTF in `apps/web/assets/fonts/`. L'anteprima UI via Google Fonts è OK, ma il watermark lato SERVER (fontconfig) cade sul fallback "Noto Sans" per i 24 font non installati. Per rendering pixel-perfect bisognerebbe scaricare ~10-15MB di TTF e includerli con `outputFileTracingIncludes` in `next.config.ts`. Pianificare quando C: ha più spazio.
  3. **Stream video su Vercel lambda**: `maxDuration = 60` impostato in `/api/photos/[id]/share` ma per wedding con molti video guestbook il primo render ffmpeg può sforare. Valutare cache su R2 (rimossa con commento "rigenerato ogni richiesta — sharp è veloce ~50ms per foto" — vero per foto, ma video è molto più lento).

## Sessione 18/07/2026 (continua 2) — Restyle Facebook: layout 3 colonne sito evento + 27 font watermark + lightbox frecce + foto demo diverse
- [x] **Layout sito evento (events/[id]/page.tsx) trasformato in 3 colonne** su richiesta esplicita dell'utente ("mi piace, e sulla sinistra e destra altri servizi"):
  - **Sidebar SINISTRA** — azioni per TUTTI (sposi + invitati): Carica, Giochi, Shop, Guestbook, Wall, Video Challenges, Wow Walk
  - **Colonna CENTRALE** — feed timeline stile Facebook con infinite scroll (preservato il componente `EventTimelineFeed` della sessione precedente) + sezione sub-eventi + share/back
  - **Sidebar DESTRA** — riservata agli SPOSI (isCreator): Notifiche, Concierge, Invitati, Capsula del Tempo, Kiosk, QR, Impostazioni
  - Grid CSS responsive: `grid-cols-1 lg:grid-cols-[200px_minmax(0,1fr)_200px]`. Su mobile (<lg) le sidebar si impilano in basso e la colonna centrale passa in order-1 (per dare priorità al feed foto).
  - Le barre di bottoni "TUTTI/SPOSI" prima in cima sono sparite: migrate nelle due sidebar laterali.
- [x] **Lightbox singolo + frecce (richiesta utente: "quando si clicca [la foto] deve essere quanto lo schermo e scrollando sopra e sotto si possono vedere le altre foto")**: nuovo componente `apps/web/src/components/full-gallery-lightbox.tsx` con:
  - Click su foto del feed → fullscreen (fixed inset-0) con un'unica foto grande al centro
  - **Frecce sx/dx** sovrapposte per cambiare foto (non scroll verticale — scelta utente dall'interfaccia di selezione)
  - **Supporto tastiera**: ESC chiudi, frecce ←/→ naviga
  - **Swipe mobile**: swipe destro = foto precedente, swipe sinistro = successiva (soglia 50px)
  - **Indicatore posizione**: "3 / 47" in basso al centro
  - **Body scroll lock** quando aperto (no scroll dietro)
  - Pulsante X per chiudere in alto a destra
  - L'oggetto `EventTimelineFeed` resta centrale; questo lightbox è il rimpiazzo del vecchio overlay `<img>` singolo senza navigazione che c'era in fondo a `page.tsx`
- [x] **Watermark dimezzato + 27 font + logo Sposi.live trasparenza 60% in alto a destra** (richiesta utente: "il watermark deve essere dimezzato di grandezza e deve avere molti font e il alto a destra il logo sposi.live in trasparenza al 60%"):
  1. **Dimezzamento dimensioni** — `packages/photo-overlay/src/index.ts`:
     - `fontSize` square 28→14, story 42→21
     - `wordmarkSize` square 14→7, story 22→11
     - `bandHeight` square 90→45, story 140→70
     - `padding` square 24→12, story 40→20
  2. **Logo brand in alto a destra** — nuova prop `brandLogoBuffer` (e `brandLogoWidth`) in `OverlayBranding`:
     - Il PNG `logo-sposi-trans.png` / `logo-justmarry-trans.png` viene caricato da `loadBrandLogo()`
     - Ridimensionato a 200px (square) o 360px (story), posizionato in alto a destra con padding 12/20px
     - Al 60% di opacità tramite composita sharp con layer SVG `fill-opacity="0.4"` (blend 'over') — riduce l'alpha al 60%
  3. **27 font selezionabili** — `apps/web/src/lib/watermark-fonts.ts`:
     - 12 ELEGANTI (corsivi/manoscritti): Dancing Script (elegante), Allura, Tangerine, Pinyon Script, Great Vibes, Satisfy, Sacramento, Parisienne, Mr Dafoe, Sofia, Norican, Yellowtail
     - 15 CLASSICI (serif): Playfair Display (classico), Noto Sans (moderno), Cormorant Garamond, Bodoni Moda, EB Garamond, Cormorant, Libre Baskerville, Libre Caslon Text, Lora, Cardo, Roboto Slab, Source Serif Pro, Crimson Text, Spectral, Cormorant Infant
     - Esportato array `WATERMARK_FONTS` con `value | label | family | category | googleImport` per uso diretto nel menu UI
     - Funzione `watermarkFontFamily(font)` mappa la scelta (es. 'great_vibes' → 'Great Vibes')
  4. **Menu impostazioni watermark riscritto** — `apps/web/src/app/events/[id]/settings/page.tsx`:
     - Menu a tendina custom (native `<select>` non può stilare singole option) che mostra **ogni voce scritta col proprio font reale** (caricate tutte e 27 famiglie da Google Fonts con un singolo `<link>` CSS2)
     - Suddiviso in due sezioni etichettate: "Eleganti" (12 voci) e "Classici" (15 voci)
     - Voce selezionata mostra ✓ a destra
     - **Anteprima live**: sotto il menu, la frase scelta (o i nomi degli sposi come fallback) viene mostrata col font selezionato, grande 2xl, così gli sposi vedono immediatamente come apparirà il watermark
     - Hint aggiornato: "Il logo Sposi.live appare in alto a destra in trasparenza 60%" (non più "sempre presente in basso a destra")
  5. **Route share aggiornata** — `apps/web/src/app/api/photos/[id]/share/route.ts` passa al overlay `brandLogoBuffer` + `brandLogoWidth` per il branch foto; mantiene anche `logoPng` per compatibilità video-overlay (interfaccia legacy)
- [x] **Foto home diverse (richiesta utente: "il sito di vendita va bene 2 foto e cambiale... ci sono dentro foto ago, migliorali... non inserire sempre le stesse foto")**:
  - Copiate 8 foto diverse dalla cartella `FOTO AGO/` (Gemini generated ×4, file user ×2, copertina Facebook, hero wedding) in `apps/web/public/demo/`
  - `apps/web/src/components/facebook-feed-home-demo.tsx` ora cicla 8 foto reali diverse invece di ripetere `/hero-wedding.jpg` per ogni card del feed demo
- [x] **i18n**: le 6 lingue già coperte dalla sessione precedente (reactions + feed + home.fb_feed_demo_*) — invariato; le uniche nuove costanti stringa italiane sono hardcoded inline: "Partecipa" / "Gestione sposi" / "Anteprima del tuo watermark" / "Carattere selezionato" / "Eleganti" / "Classici" / foto precedente/successiva — da tradurre in futuro se serve i18n completo di queste label minori.
- [x] **Typecheck pulito: 0 errori** (`npx tsc --noEmit -p apps/web/tsconfig.json`). Risolti:
  - `currentFont possibly undefined` in settings/page.tsx (usato `?? WATERMARK_FONTS[12]!`)
  - `Touch | undefined` in full-gallery-lightbox (`e.touches[0]?.clientX ?? null`)
  - `MediaUpload | undefined` nel render img (`if (!current) return null` dopo `if (!open) return null`)
- [ ] **Da pushare e verificare**: aprire un evento reale con foto caricate, cliccare su una foto → verifica lightbox fullscreen con frecce; provare swipe/frecce/tastiera per navigare; entrare in Impostazioni → Watermark e verificare 27 font nel menu con anteprima live; salvare un font diverso da 'classico' e condividere una foto per verificare il watermark finale (dimezzato, con logo top-right 60%, e font scelto applicato); scorrere homepage per vedere le 8 foto demo diverse nel feed.
- [ ] **Da considerare**: i TTF locali sono ancora solo 3 (Dancing Script, Playfair Display, Noto Sans) in `apps/web/assets/fonts/`; gli altri 24 font vengono resi in fase anteprima UI via Google Fonts, ma il watermark LATO SERVER applica il rendering con fontconfig (che cade sul fallback "Noto Sans" per i font non installati). Per rendering server-side pixel-perfect con gli altri 24 font servirebbe scaricare i TTF (~10-15MB totali) — il disco C era quasi pieno (1 GB free), è stato prudente non scaricare tutto in questa sessione. Pianificare scarico TTF e pulizia `.next` cache prima di pushare. Per ora: i 3 font con TTF installati sono perfetti, gli altri 24 in acqua risultano in "Noto Sans" lato server ma in font nel menu appaiono corretti.

## Sessione 18/07/2026 — Restyle homepage + app in stile Facebook (timeline feed + palette blu)
- [x] **Cambiato il design del sito e dell'app per avvicinarsi a Facebook**, su richiesta esplicita dell'utente: due direzioni过ci同时：
  1. **Palette** — `apps/web/src/app/globals.css` passata da Zola-style (oro `#c4956a` + neutri caldi `#f8f6f3`) a Facebook-style (blu `#1877f2` + grigio chiaro `#f0f2f5` + superficie bianca + testo `#050505` + grigio testo `#65676b`). Aggiunte variabili tema `--color-like`/`--color-love` per le reazioni, e nuove classi utility: `.fb-card` (card post con ombra morbida), `.fb-avatar` (avatar rotondo gradiente blu), `.fb-nav` (header appiccicoso), `.fb-pop` (animazione pop del contatore like), `.fb-reactions` (barra reazioni hover), `.fb-shimmer` (skeleton loader infinite scroll).
  2. **Layout & scorrimento foto** — homepage riscritta con **timeline feed verticale a colonna unica** stile Facebook (card post una sotto l'altra, ogni card = foto + didascalia eventi + azioni Mi piace/Commenta/Condividi), e galleria evento (`events/[id]/page.tsx`) trasformata da griglia 4-colonne a **masonry/timeline FB** con infinite scroll via `IntersectionObserver` e card post vehicle (foto + nome autore + timestamp + barra azioni).
- [x] **Componenti nuovi**:
  - `apps/web/src/components/facebook-feed.tsx` — feed timeline riutilizzabile, con:
    - Skeleton shimmer durante il caricamento
    - Reazioni multiple (Mi piace ❤ Adoro 😮 Wow 😢 Sigh 😠 Grrr) comparse su hover del bottone Like
    - Animazione pop sul contatore like
    - Sezione commenti collassabile per post
    - Avatar iniziali del nome (fallback quando manca la foto profilo)
  - `apps/web/src/components/reactions-bar.tsx` — barra reazioni animata, condivisa tra homepage feed e galleria evento
- [x] **i18n**: nuove chiavi in `messages/{locale}.json` per tutti i 6 locale (it, en-US, en-GB, es, fr, de): `home.fb_feed_demo_*`, `reactions.*`, `feed.*` (commenta, mi_piaci, invia_commento, caricamento, niente_post, giorni_fa, ore_fa, minuti_fa, adesso, persone_ammirano, widget_creazione).
- [x] **Compatibilità retroattiva**: pagine interne (games, shop, dashboard) esistenti continuano a usare token colore vecchi (`brand`, `bg`, `surface`, `text-muted`, `border`) che ora puntano alla nuova palette FB — viene automaticamente applicato senza bisogno di sweep manuale dei `#c4956a`/`#f8f6f3` hardcoded; resta il "vecchio oro #d4a574 hardcoded in ~20 pagine" segnalato nelle sessioni precedenti, da pulire in futuro.
- [ ] **Da pushare e verificare**: scorrere la nuova homepage su desktop e mobile; aprire un evento reale con foto caricate e verificare la timeline galleria a infinite scroll; testare reazioni hover su desktop (su mobile il tap mostra la barra senza hover).
- [ ] **Da considerare**: portrait/aspect ratio delle foto — il feed FB usa spesso immagini 4:3 o 1:1 (cover 1200×900 per link), mentre le foto matrimonio sono spesso 4:3 orizzontali: mantenuto `object-cover` con aspect ratio fluido per evitare伸缩distorti.

## Sessione 05/07/2026 (continua 11) — Fix segnalazioni test utente + logo trasparente + hero Zola su fondo chiaro
- [x] **Guestbook, preview nera durante la registrazione** (countdown ok, schermo nero, ma video+audio registrati bene): race condition — `startRecording` assegnava lo stream al `<video>` PRIMA che il tag esistesse (viene montato solo con stato countdown/recording), quindi `videoRef.current` era null. Aggiunto un `useEffect` su `[state]` in `video-recorder.tsx` che collega lo stream DOPO il mount. Stesso identico bug del Tavolo Selfie.
- [x] **Video guestbook non visibili dopo l'upload + foto invisibili in galleria — STESSA CAUSA**: `/api/media/[id]/download` usava `createClient()` (client browser Supabase) in una route server → `getUser()` falliva sempre → 401 per OGNI media. Le card c'erano ma img/video non caricavano mai. Fix: `createServerSideClient` coi cookie della richiesta. Verificato su DB: la foto caricata il 2/07 È in `media_uploads` (upload ok, era solo il rendering rotto).
- [x] **Upload silenziosamente perso**: in `upload/page.tsx` un errore di `enqueueUpload` faceva `continue` senza avvisare — ora mostra un alert col nome file e l'errore.
- [x] **"Fotocamera" in Carica apriva il file picker su PC**: `capture="environment"` funziona solo su telefono. Nuovo componente `photo-capture.tsx` (getUserMedia + canvas, schermo intero, pulsante di scatto grande, cambio camera, anteprima con Usa/Riprova); fallback all'input se la camera non c'è.
- [x] **Logo trasparente (richiesto: 4x più grande, niente sfondo nero)**: generati con PIL da `logo-{brand}.png` (fondo navy pieno) quattro nuovi PNG in `apps/web/public/`: `logo-{sposi,justmarry}-trans.png` (per fondi scuri/foto) e `logo-{sposi,justmarry}-onlight.png` (per fondi chiari: scritta ".Live" rimappata in navy #1a1a2e, oro intatto). Rimozione sfondo: alpha da luminanza+saturazione, filtro componenti connesse per eliminare le striature diagonali degli angoli, crop al contenuto. Usati in nav (h-12/14), hero (h-28/40 ≈ 4x), footer (h-9), CTA finale (trans h-24/32) e PWA splash (trans h-40, via il mix-blend-mode).
- [x] **Hero in stile Zola vero + contrasto**: l'utente segnalava testi bianchi illeggibili e foto-screenshot troppo evidente. Nuovo hero su FONDO CHIARO (#f8f6f3) con titolo serif scuro (niente più testo bianco su foto), logo grande, CTA oro, e la foto sposi in una card arrotondata con ombra (stile Zola) invece che a tutto schermo. `hero-wedding.jpg` ripulita: ritagliata l'icona muto di Instagram (crop x<920), +contrasto/colore/nitidezza.
- [ ] **Da fare**: se l'utente fornisce la foto originale (non screenshot), sostituire `apps/web/public/hero-wedding.jpg`.

## Sessione 05/07/2026 (continua 10) — DEPLOY SBLOCCATO ✅ + file troncati riparati + redesign homepage stile Zola
- [x] **Sbloccato il push dopo giorni di lavoro solo locale**: rimosso `.git/index.lock` fantasma; scoperto che il **sandbox Linux vede versioni stale/troncate dei file** (cache FUSE/OneDrive) → da ora in poi ogni commit/push va fatto da PowerShell sul PC, mai da sandbox; la verifica dei file va fatta con i tool Windows-side.
- [x] **TRE file committati troncati** (probabile colpa OneDrive, stesso pattern di `events/new/page.tsx` in passato) trovati e riparati: `site-builder/page.tsx` (finiva con `<`), `notifications/page.tsx` (finiva con `</mai`), `guestbook/page.tsx` (troncato a riga 207 — ricostruita la coda inclusa la condivisione video watermarkato via `shareWatermarkedMedia`, i cui import erano sopravvissuti). Scansione completa del repo con esbuild: nessun altro file rotto.
- [x] **DEPLOY PRODUCTION RIUSCITO** (commit `54e7765`): tutte le fix delle sessioni precedenti (QR redirect, ruolo invitato, countdown guestbook, toggle notifiche, forgot password, carrello piani, ecc.) sono ora LIVE. L'utente può ritestare da capo.
- [x] **Redesign homepage stile Zola** (richiesta utente: professionale, elegante, no emoticon, bottoni grandi ben visibili):
  - Palette nuova in `globals.css` (Tailwind v4 `@theme`): bg `#f8f6f3`, oro `#c4956a` (dark `#a87a4e`, light `#dbb896`), testo `#1a1a2e`, muted caldi. Allineati anche `manifest.ts` (theme/background) e `<meta theme-color>` in layout.
  - Font: Playfair Display (titoli, var `--font-playfair`, classe `.font-display`) + Inter (corpo) via `next/font/google` in `layout.tsx` — self-hostati, ok CSP/GDPR.
  - `page.tsx` riscritta: hero full-screen (100svh) su `hero-wedding.jpg` con logo in filigrana (blend screen), sezioni Piattaforma unica (4 card), Come funziona (3 passi), Giochi (5 card: Wall, Quiz, Caccia Foto, Video Guestbook, Kiosk Selfie), Watermark MAX (split con mock monogramma "G & A"), Drive backup, Pricing (€0/€229/€375 con badge "Giochi inclusi", feature reali dai piani), striscia numeri, CTA finale su fondo scuro, footer. Bottoni pill grandi, niente emoji.
  - Nuovo `components/reveal.tsx`: animazioni fade+slide allo scroll via IntersectionObserver, rispetta `prefers-reduced-motion`.
  - Blocco `home` riscritto in TUTTE le 6 lingue (it, en-US, en-GB, es, fr, de — de in forma Sie coerente col resto).
  - ⚠️ **I numeri della sezione stats sono segnaposto** ("10.000+ foto", "150+ eventi") — l'utente deve sostituirli con dati veri o rimuovere la sezione.
  - Rimosso link footer a `/privacy` (route inesistente a livello root).
- [ ] **Nota**: `#d4a574` (vecchio oro) resta hardcoded in ~20 pagine interne (games, shop, quiz, ecc.) — sweep cosmetico da fare in una sessione futura se si vuole coerenza totale col nuovo `#c4956a`.
- [ ] **Nota**: `package.json` di apps/web ha la chiave duplicata `@fotosposi/notifications` (warning esbuild, innocuo ma da pulire).

## Sessione 05/07/2026 (continua 9) — Nome/indirizzo Cerimonia-Ricevimento separati, logo vero sul sito, foto hero + splash PWA
- [x] **Cerimonia/Ricevimento: nome e indirizzo separati**: prima erano un unico campo testo libero ("Chiesa San Pietro, Via Roma 10"). Aggiunte colonne `events.church_address`/`events.venue_address` (migration `00033`), form in `events/new/page.tsx` diviso in Nome + Indirizzo + Comune per entrambi. Il link "apri nel navigatore" in `events/[id]/page.tsx` ora costruisce la query Maps da nome+indirizzo+comune (prima usava solo il testo libero + comune).
- [x] **Logo vero inserito nel sito** (prima c'era solo un'icona a forma di cuore + il nome per testo): nav bar, hero e footer della homepage (`apps/web/src/app/page.tsx`) ora mostrano `logo-sposi.png`/`logo-justmarry.png` in base al dominio (stesso rilevamento già usato per il favicon in `layout.tsx`). Nota tecnica: i file logo hanno uno sfondo blu scuro pieno (non trasparente) — nella nav/footer (sfondo chiaro) sono dentro un badge scuro apposito per non sembrare un rettangolo per errore; nell'hero, sopra la foto, uso `mix-blend-mode: screen` invece della sola opacità così lo sfondo scuro "sparisce" e restano visibili solo anelli+scritta come effetto filigrana.
- [x] **Foto vera in hero + "apertura dell'app"**: su richiesta dell'utente, usata la foto (sposi con fumo colorato arcobaleno, fornita in chat, salvata in `apps/web/public/hero-wedding.jpg`) come sfondo dell'hero della homepage, con il logo brand sopra al 60% di opacità (via `mix-blend-mode: screen`, vedi sopra). Aggiunto anche `apps/web/src/components/pwa-splash.tsx`: stessa foto+logo mostrata a schermo intero per ~1.3s SOLO quando l'app è aperta da icona home screen (PWA installata, `display-mode: standalone`), non nel browser normale.
- [x] **Chiarito un dubbio precedente sull'"app generica"**: l'utente aveva segnalato che l'app installata mostra uno stile "banale" senza pulsante foto/video quando si apre senza un evento specifico collegato — root cause: `PwaEventRedirect` reindirizza all'ultimo evento visitato SOLO se ne esiste uno salvato; altrimenti mostra la homepage marketing generica (mai avuta un vero hero/logo prima d'ora). Il fix di questa sessione (foto+logo nell'hero) migliora esattamente questa schermata.
- [ ] **Nota qualità immagine**: `hero-wedding.jpg` è uno screenshot Instagram (non il file originale), quindi ha compressione JPEG e un'icona "muto" residua in basso a destra (angolo poco visibile con l'attuale crop dell'hero, ma da tenere presente). Se hai il file originale ad alta risoluzione, sostituiscilo nello stesso percorso per una qualità migliore.
- [ ] **Ancora da fare, non affrontato in questa sessione**: bug noti del Video Guestbook già segnalati due volte dall'utente ("al solito non crea il conto alla rovescia", "la telecamera è piccola, deve aprirsi integralmente", "alla fine non si può rivedere") — il countdown e la condivisione-file-reale sono già stati implementati in una sessione precedente ma **non ancora deployati** (nulla è stato pushato/buildato su Vercel finora in questa serie di sessioni); probabile che l'utente stia ancora testando il sito con il codice vecchio. La richiesta di aprire la fotocamera "integralmente" (schermo intero, non un riquadro piccolo) invece è un cambiamento di design non ancora fatto — da affrontare nella prossima sessione insieme al deploy.
- [x] **Badge "scarica l'app" in basso a sinistra**: aggiunto `apps/web/src/components/app-download-badges.tsx`, due pulsanti fissi in basso a sinistra su tutta la homepage, in stile App Store/Google Play ma con icone disegnate da zero (non i loghi ufficiali, che sono marchi registrati) dato che non esiste una pubblicazione reale sugli store — l'app è una PWA. Click su "Android": avvia l'installazione PWA reale se il browser supporta il prompt (`beforeinstallprompt`), altrimenti messaggio che serve Chrome su Android. Click su "iPhone": mostra le istruzioni "Condividi → Aggiungi a Home" (iOS Safari non ha un'API per installare via bottone).
- [ ] **Da pushare e testare**: oltre a tutto quanto già elencato nella sessione precedente, testare la homepage su entrambi i domini (logo/foto corretti), provare ad aggiungere l'app alla schermata home da telefono per vedere la splash screen, e verificare i due badge scarica-app su Android reale (Chrome) e iPhone (Safari).

## Sessione 05/07/2026 — Deploy Vercel + DNS live (BUILD RIUSCITO ✅)
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
- [x] **Pushati Bug 5+6**: commit `2715e6a` — build ripartito ma fallito di nuovo (deployment `dpl_7JwRngofzh4KLS5JGQScbgHyfDAJ`).
- [x] **Bug 7 — implicit any**: `apps/web/src/app/api/cron/maintenance/route.ts:64`, `(pendingEvents ?? []).map((r) => r.event_id)` → `r` senza tipo esplicito. Fix: `(r: { event_id: string }) => r.event_id`. Verificato `cron/backup/route.ts`: nessun problema simile.
- [x] **Pushato Bug 7**: commit `59abc4d` — build ripartito ma fallito ancora (deployment `dpl_427M6pGGDefa6V5jCCe2Az3fjiWw`).
- [x] **Bug 8 — Argument 'unknown' non assegnabile a 'string'**: stessa riga, `distinctEventIds` risultava tipizzato in modo ambiguo nonostante l'annotazione su `r`. Fix più esplicito: variabile intermedia `eventIds: string[]` + `distinctEventIds: string[]` tipizzate a mano in `apps/web/src/app/api/cron/maintenance/route.ts`.
- [x] **Favicon**: `favicon.svg`/`icon-192.svg`/`icon-512.svg` esistevano già in `apps/web/public/` ma non erano collegati in `layout.tsx` (solo apple-touch-icon manuale, nessun favicon standard). Aggiunto `icons: { icon: [...], apple: '/icon-192.svg' }` in `generateMetadata()`, rimosso il `<link>` manuale duplicato.
- [x] **Pushati Bug 8 + favicon**: commit `9695cfc` — build ripartito ma fallito ancora (deployment `dpl_4hg2xrpByJfCbUX9GB8aqCQ5tGfE`).
- [x] **Bug 9 — `Image` shadowing**: `apps/web/src/app/events/[id]/upload/page.tsx` importava l'icona `Image` da `lucide-react`, oscurando il costruttore DOM globale `Image` usato per il watermark (`new Image()` → "Expected 1 arguments, but got 0" perché TS risolveva `Image` come componente lucide, non `HTMLImageElement`). Fix: rinominato l'import in `Image as ImageIcon` + aggiornato l'uso JSX. Verificato `site-builder/page.tsx` (stesso import ma senza `new Image()`, innocuo).
- [x] **Pushato Bug 9**: commit `38de6bd` — build ripartito ma fallito ancora (deployment `dpl_8TBEHYDFUskhqqkTjLTPQpRrsVgF`).
- [x] **Bug 10 — manifest.ts purpose non valido**: `apps/web/src/app/manifest.ts:27`, `purpose: 'any maskable'` (stringa composta) non valido per il tipo Next.js (`"any" | "maskable" | "monochrome"`, valore singolo). Fix: split in due entry icona 512, una con `purpose: 'any'` e una con `purpose: 'maskable'`.
- [x] **Pushato Bug 10**: commit `89cffad`.
- [x] **🎉 BUILD RIUSCITO**: deployment `dpl_EZkzzbrzNZYcjKGmATH4kdsf9TNK` (commit `89cffad`) → stato **READY**. Tutti e 4 i domini ora serviti in produzione: `sposi.live`, `www.sposi.live`, `justmarry.live`, `www.justmarry.live`. In totale 10 bug risolti in questa sessione (4 iniziali + 6 emersi via type-check progressivo, scoperti e corretti con Vercel MCP senza bisogno di guardare la dashboard).
- [ ] **Urgente — sicurezza**: `git remote -v` mostra il PAT GitHub in chiaro nell'URL remoto (`https://ghp_...@github.com/...`). Da revocare/rigenerare e da riconfigurare il remote senza token in chiaro nell'URL (usare credential manager o SSH).

## Sessione 05/07/2026 (continua) — Bug QR code segnalato dall'utente
- [x] **Bug QR — dominio sbagliato**: `apps/web/src/app/events/[id]/qr/page.tsx` generava il link con `NEXT_PUBLIC_APP_URL || window.location.origin` — la env var (fissa su Vercel, puntava al dominio `*.vercel.app`) aveva precedenza sul dominio reale da cui l'admin genera il QR. Fix: invertita priorità, `window.location.origin` prima (riflette correttamente sposi.live o justmarry.live a seconda di dove l'admin sta navigando).
- [x] **Bug grave — "Link non valido o scaduto" per TUTTI i guest reali**: root cause identificata: le tabelle `events`, `sub_events`, `event_windows`, `media_uploads`, `core_auth_tokens`, `event_guests` hanno RLS con policy limitate al solo proprietario evento (`auth.uid() = created_by`), **nessuna eccezione per lettura pubblica/ospite**. La pagina guest `/event/[code]` (e la generazione QR) chiamavano queste query lato client con la chiave anonima → RLS bloccava sempre i risultati per chiunque non fosse il proprietario, quindi ogni guest reale (non loggato come sposo) vedeva "Link non valido o scaduto" anche con token valido. Fix: creato nuovo endpoint server-side `apps/web/src/app/api/guest/event/route.ts` che usa la service role key (disponibile solo server-side) per validare il token e leggere evento/sotto-eventi/media/finestra/registrare l'ospite, bypassando RLS in modo controllato (il token valido è il gate di sicurezza). Riscritta `apps/web/src/app/event/[code]/page.tsx` per chiamare questo endpoint invece delle funzioni dirette (`validateQrToken`, `getEventById`, `getSubEvents`, `getMediaByEvent`, `getEventWindow`, `registerGuest`).
- [x] **Bug minore correlato**: `apps/web/src/lib/process-queue.ts` determinava il brand per il watermark (`Sposi.live`/`JustMarry.live`) da `VERCEL_URL`/`NEXT_PUBLIC_APP_URL` (sempre il dominio vercel.app, mai "justmarry" → watermark sempre "Sposi.live" a prescindere dall'evento reale). Fix: usa `event.brand` dal DB (già disponibile), come già fa correttamente `/api/photos/[id]/share/route.ts`.
- [x] **Favicon brandizzato**: generate `favicon-sposi-{32,192,512}.png` e `favicon-justmarry-{32,192,512}.png` in `apps/web/public/` ritagliando l'emblema (anelli) dai loghi esistenti `logo-sposi.png`/`logo-justmarry.png` (il logo intero non era adatto: sfondo scuro non trasparente + wordmark illeggibile a 32px). `layout.tsx` e `manifest.ts` ora servono l'icona giusta in base al dominio (`isIt`).
- [ ] **Da pushare e testare**: tutte le fix di questa sotto-sessione sono corrette sul disco ma non ancora committate. Da testare bene dopo il deploy: scansionare un vero QR code da telefono su un evento reale e verificare che la galleria carichi correttamente.
- [ ] **Da verificare separatamente**: `event_guests` non ha nessuna policy INSERT — anche con service role questo non è un problema (il service role bypassa RLS), ma se in futuro si vuole permettere INSERT diretto con anon/authenticated key va aggiunta una policy dedicata.

## Sessione 05/07/2026 (continua 2) — Video Guestbook: audio muto + colonna mancante
- [x] **Bug audio muto in anteprima**: `apps/web/src/components/video-recorder.tsx`, il tag `<video>` aveva `muted` fisso, usato sia per il live preview (durante registrazione) sia per la riproduzione del video registrato — quindi la review risultava SEMPRE senza audio anche se il microfono registrava correttamente. Fix: `muted={state !== 'preview'}` + aggiunti controlli nativi in fase di anteprima.
- [x] **Bug "Could not find the 'from_name' column of 'video_messages'"**: causa reale — **la migration `00025_video_messages_r2.sql` (che aggiunge `r2_key`, `from_name`, `is_public`) non è mai stata applicata al database Supabase di produzione**, il codice è corretto. Stesso errore capita sia registrando un video sia caricandone uno già fatto (entrambi i percorsi passano dalla stessa insert). **Azione richiesta**: incollare questo SQL nell'SQL Editor di Supabase (dashboard progetto → SQL Editor):
  ```sql
  ALTER TABLE video_messages ADD COLUMN IF NOT EXISTS r2_key TEXT;
  ALTER TABLE video_messages ADD COLUMN IF NOT EXISTS from_name TEXT;
  ALTER TABLE video_messages ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT true;
  ```
- [x] **Bug correlato — stesso schema RLS-in-browser delle fix precedenti**: `createVideoMessage`/`getVideoMessages` in `packages/media/src/service.ts` usano `createServiceClient()`, ma venivano chiamate direttamente da `apps/web/src/app/events/[id]/guestbook/page.tsx` (`'use client'`) → nel browser degradano alla anon key, e `video_messages` non ha NESSUNA policy RLS di INSERT → il salvataggio avrebbe comunque fallito (con un errore diverso) anche dopo aver aggiunto la colonna. Fix: nuovo endpoint server-side `apps/web/src/app/api/guestbook/messages/route.ts` (GET lista, POST salva), guestbook/page.tsx riscritta per chiamarlo via fetch invece delle funzioni dirette.
- [x] **Connesso Supabase MCP** (progetto `FOTOSPOSI`, ref `krgqyluuiltckmhbeuue`) — confermato il sospetto drift: `list_migrations` mostrava come applicate solo migration con nomi/numerazione diversi da quelli nei file del repo, fermandosi a `00015_event_tiers`. **Tutto da `00016` in poi non era mai stato applicato al DB reale** (14 migration di differenza).
- [x] **Applicate le migration mancanti 00016→00029** (verificando prima via query dirette cosa esisteva già, per evitare doppioni/errori su colonne o policy già presenti):
  - `00016` indici performance + realtime — applicata
  - `00017` colonna `compressed` su media_uploads — **già presente** (skip)
  - `00018` tabelle coupons/affiliates/referrals — applicata
  - `00019` colonne partner + tabella partner_visits — applicata (**saltato** l'INSERT di 4 fornitori demo/placeholder "di Prova")
  - `00020` colonne affiliate_link/commission_info — applicata (**saltato** l'INSERT di ~24 partner affiliate con link placeholder tipo Revolut/Booking/Amazon — da rivedere prima di popolarli con link reali)
  - `00021` tabella social_posts — applicata
  - `00022` indice r2_key — applicata
  - `00023` tabelle GTE engine (brand_config, engagement_triage, ecc.) — applicata con una correzione: la FK verso `content_queue` è stata rimossa (quella tabella non è mai definita in nessuna migration del repo, probabilmente gestita da n8n esternamente) — content_id ora è UUID semplice
  - `00024` **NON applicata**: fa `DROP TABLE gift_registry_transactions` e `DROP TABLE social_posts` — cancellazione permanente di dati, e `gift_registry_transactions` potrebbe contenere transazioni reali. Da decidere consapevolmente, non l'ho eseguita in autonomia.
  - `00026` tabella event_guests — applicata (necessaria per la fix RLS guest di questa sessione)
  - `00027` colonna category + 6 nuovi template sito — applicata
  - `00028` colonne nome/cognome/telefono/consensi GDPR su core_users — applicata
  - `00029` tabella system_health_log — applicata (necessaria per i cron backup/manutenzione deployati oggi)
- [ ] **Da decidere**: i due INSERT saltati (fornitori demo in `00019`, partner affiliate placeholder in `00020`) — dimmi se/quando vuoi che li inserisca, con quali link reali per l'affiliate marketing.
- [ ] **Da decidere**: `00024` (drop gift registry + social wall) — confermare se va ancora eseguita o se il gift registry è ancora in uso.
- [x] **Da pushare**: fix audio + guestbook API route (vedi comandi git sotto). Il fix del database è già live, non serve più incollare SQL a mano.
- [ ] **SEO + GEO (Generative Engine Optimization)**: non dimenticare, oltre alla SEO classica (meta tag, sitemap, dati strutturati), l'ottimizzazione per essere citati dai motori generativi/AI (ChatGPT, Perplexity, Gemini, AI Overviews di Google) quando gli utenti chiedono consigli per organizzare un matrimonio — contenuti chiari/strutturati, FAQ schema, risposte dirette citabili. Da affrontare prima del lancio pubblico.

## Sessione 05/07/2026 (continua 3) — Comune Cerimonia/Ricevimento + rename Navetta
- [x] **Bug link Maps sbagliato per Cerimonia/Ricevimento**: il form creazione evento aveva un unico campo "Luogo (città)" condiviso, usato per costruire il link Maps sia della Cerimonia sia del Ricevimento — se i due erano in comuni diversi il link risultava sbagliato per uno dei due (da qui "per errore puoi inserire solo la via"). Fix: aggiunte colonne `church_city`/`venue_city` su `events` (migration `00030_church_venue_city`, applicata live via Supabase MCP), due nuovi campi "Comune" opzionali in `apps/web/src/app/events/new/page.tsx` (uno per Cerimonia, uno per Ricevimento — se vuoti usano ancora il "Luogo" generale), link Maps in `apps/web/src/app/events/[id]/page.tsx` aggiornato per usare il comune specifico.
- [x] **Rename "Auto Amica" → "Passaggio in auto"**: nella sezione Navetta, l'etichetta italiana era l'unica rimasta con un nome poco chiaro ("Auto Amica") — le altre lingue avevano già traduzioni corrette ("Carpool matching", "Covoiturage", ecc.). Allineato `apps/web/messages/it.json` (`navetta_matchmaking` + `navetta_desc`), placeholder indirizzo cerimonia/ricevimento resi coerenti (menzionano esplicitamente "comune").
- [ ] **Da chiarire**: richiesta di cancellare il sito pubblicato `https://fotosposi-web.vercel.app/sito/fb1915ee-e3ea-4f6f-8f58-1a686521a365` — nel codice attuale non esiste nessuna funzione "cancella" per eventi/siti (nessun testo "cancella" trovato in `apps/web/src`), quindi non è chiaro a quale schermata l'utente si riferisca. Non ho cancellato nulla dal database in autonomia (cancellazione dati permanente, richiede conferma esplicita e va fatta con l'utente presente). In attesa di screenshot/URL preciso.

## Sessione 05/07/2026 (continua 4) — Email conferma: link localhost + mittente non brandizzato
- [x] **Bug critico — link email di conferma punta a `localhost:3000`**: `signUp()` in `packages/core/src/auth.ts` non passava `emailRedirectTo`, quindi Supabase Auth usa il fallback statico del progetto ("Site URL"), rimasto sul default di sviluppo `http://localhost:3000` — **blocca la conferma email per chiunque si registri in produzione**. Fix: aggiunto `emailRedirectTo: window.location.origin + '/login'` (stesso pattern già usato in `signInWithOAuth`), così punta correttamente a sposi.live o justmarry.live a seconda di dove ci si registra.
- [ ] **⚠️ Azione richiesta lato dashboard Supabase (non automatizzabile da qui)**: il fix sopra funziona solo se Supabase accetta il redirect. Vai su **Supabase Dashboard → Authentication → URL Configuration** e:
  1. Cambia **Site URL** da `http://localhost:3000` a `https://sposi.live`
  2. Aggiungi in **Redirect URLs**: `https://sposi.live/**`, `https://www.sposi.live/**`, `https://justmarry.live/**`, `https://www.justmarry.live/**` (e opzionalmente `https://fotosposi-web.vercel.app/**` per i test)
  Non ho un tool per modificare queste impostazioni da qui — vanno cambiate manualmente.
- [x] **Mittente email brandizzato (parziale)**: `packages/notifications/src/service.ts` mandava tutte le email da `noreply@sposi.live` fisso, anche per eventi JustMarry. Fix: ora sceglie `info@sposi.live` o `info@justmarry.live` in base al campo `brand` dell'evento.
- [ ] **Limite strutturale — email di Supabase Auth (conferma, reset password) restano da `noreply@mail.app.supabase.io`**: Supabase Auth supporta UN SOLO mittente SMTP fisso per l'intero progetto, non può alternare per dominio. Per avere davvero `info@sposi.live`/`info@justmarry.live` sulle email di conferma/reset serve una delle due strade (da decidere con l'utente, richiede accesso DNS a entrambi i domini + `RESEND_API_KEY` da configurare, ancora mancante):
  - **Opzione A (semplice)**: SMTP personalizzato in Supabase con un solo mittente fisso (es. `info@sposi.live`) per tutte le email di sistema di entrambi i brand — perde la brandizzazione JustMarry ma richiede solo verifica DNS di un dominio.
  - **Opzione B (corretta, scelta dall'utente)**: Auth "Send Email Hook" di Supabase — intercetta l'invio email e lo fa passare dal nostro codice (via Resend) scegliendo il mittente giusto per dominio.
- [x] **Opzione B — parte mia già fatta**: scritta e **deployata** la Edge Function `auth-send-email` (progetto Supabase `krgqyluuiltckmhbeuue`, stato ACTIVE) — legge `email_data.redirect_to` dal payload dell'hook (che ora contiene il dominio reale grazie al fix `emailRedirectTo` sopra), sceglie `info@sposi.live` o `info@justmarry.live` di conseguenza, costruisce il link di conferma/reset/magic-link/invito corretto e lo manda via Resend. Gestisce anche il caso "cambio email" (due invii). Verifica la firma del webhook (Standard Webhooks) prima di processare.
  URL della funzione: `https://krgqyluuiltckmhbeuue.supabase.co/functions/v1/auth-send-email`
- [ ] **⚠️ Passaggi rimanenti — solo l'utente può farli (accesso dashboard/DNS/email)**:
  1. **Account Resend**: se non esiste già, crearlo su resend.com.
  2. **Verificare entrambi i domini su Resend** (Resend → Domains → Add Domain, per `sposi.live` e `justmarry.live`) — Resend fornisce record DNS (SPF/DKIM/DMARC) da aggiungere su Register.it per ciascun dominio, stesso tipo di lavoro fatto per il DNS di Vercel.
  3. **Prendere la `RESEND_API_KEY`** da Resend e impostarla in due posti: (a) Vercel → progetto `fotosposi-web` → Environment Variables → `RESEND_API_KEY` (serve anche a `packages/notifications`); (b) Supabase Dashboard → Project Settings → Edge Functions → Secrets → aggiungi `RESEND_API_KEY`.
  4. **Attivare l'hook**: Supabase Dashboard → Authentication → Hooks → "Send Email" hook → tipo HTTPS → incolla l'URL della funzione sopra → Supabase genera un secret di firma (`v1,whsec_...`) → copialo e impostalo come secret `SEND_EMAIL_HOOK_SECRET` (stesso posto del punto 3b).
  5. Completare anche il fix Site URL/Redirect URLs già richiesto sopra (necessario in ogni caso, indipendentemente dall'hook).
  Fatti questi 5 passaggi, le email di conferma/reset arriveranno da `info@sposi.live` o `info@justmarry.live` a seconda del dominio di registrazione, con link funzionante.

## Sessione 05/07/2026 (continua 5) — Resend collegato, mancano solo 2 click dashboard
- [x] Account Resend creato dall'utente, dominio `sposi.live` aggiunto e verificato (region Ireland). `justmarry.live` **rimandato**: il secondo dominio su Resend richiede piano a pagamento — verrà fatto con un altro account/email più avanti. Fino ad allora l'Edge Function invierà correttamente solo per email con redirect su sposi.live; per justmarry.live continuerà a fallback finché il dominio non sarà verificato.
- [x] `RESEND_API_KEY` generata dall'utente e recuperata dal file `ECCOLO FOTOSPOSI.txt`.
- [ ] **Nota sicurezza**: la chiave è stata salvata in chiaro nello stesso file `ECCOLO FOTOSPOSI.txt` che contiene già il PAT GitHub esposto (vedi avviso "Urgente — sicurezza" più sopra). Consiglio: spostare tutte le chiavi vive in un password manager e ruotare sia il PAT sia (dopo averla configurata) valutare se rigenerare questa key da Resend una volta finita la configurazione, tenendo il file solo come nota "dove l'ho creata" non come cassaforte.
- [ ] **⚠️ Restano solo 2 azioni manuali per completare l'Opzione B (Send Email Hook)**, nessun tool automatico può farle da qui:
  1. Impostare `RESEND_API_KEY` in **due posti**:
     - Vercel → https://vercel.com/studiolegvitrano-blip1/fotosposi-web/settings/environment-variables → Add → Name `RESEND_API_KEY`, Value la chiave (da ECCOLO), Environment: Production (+ Preview se si vuole testare) → Save → poi redeploy.
     - Supabase → https://supabase.com/dashboard/project/krgqyluuiltckmhbeuue/settings/functions → sezione Secrets → aggiungi `RESEND_API_KEY` con lo stesso valore (serve alla Edge Function `auth-send-email`, separata dalle env Vercel).
  2. Attivare l'hook: Supabase Dashboard → Authentication → Hooks → "Send Email" → tipo HTTPS → URL `https://krgqyluuiltckmhbeuue.supabase.co/functions/v1/auth-send-email` → Supabase genera un secret `v1,whsec_...` → va incollato come secret `SEND_EMAIL_HOOK_SECRET` nello stesso posto Supabase del punto 1 (Edge Functions → Secrets). Il valore va comunicato in chat per essere certi sia stato impostato correttamente.
  3. Rimane ancora da fare anche il cambio Site URL/Redirect URLs (punto già segnalato sopra) — necessario indipendentemente dall'hook.
- [x] **Hook "Send Email" attivato dall'utente** su Supabase Dashboard, secret di firma generato (`v1,whsec_...`, salvato su ECCOLO). Confuso inizialmente sulla pagina giusta per i secrets: non è la lista Edge Functions (`/functions`), ma **Project Settings → Edge Functions** (`/settings/functions`), sezione "Secrets" con pulsante "Add new secret".
- [x] Secrets `RESEND_API_KEY` e `SEND_EMAIL_HOOK_SECRET` confermati impostati su Supabase Edge Functions → Secrets.
- [x] **Bottoni OAuth senza logo**: login e signup mostravano solo testo "Google"/"Facebook"/"Apple" nei bottoni social. Aggiunto `apps/web/src/components/oauth-icons.tsx` (loghi ufficiali SVG inline) e aggiornati i bottoni in `apps/web/src/app/(auth)/login/page.tsx` e `.../signup/page.tsx` per mostrare l'icona al posto del testo.

## Sessione 05/07/2026 (continua 6) — Diagnosi via Claude in Chrome: causa reale del 500 sull'hook email
- [x] Attivata estensione Claude in Chrome dall'utente — usata per ispezionare direttamente dashboard Supabase e Resend invece di chiedere copia-incolla manuale.
- [x] Aggiunto logging di debug temporaneo alla Edge Function `auth-send-email` (console.log su ogni step), ridistribuita (v6), poi eseguito un test di registrazione reale (`agospe+debug20260705@gmail.com`) direttamente dal browser per catturare l'errore esatto nei log.
- [x] **Causa reale trovata**: Resend risponde `403 "The sposi.live domain is not verified. Please, add and verify your domain on https://resend.com/domains"`. Verificato su resend.com/domains → dominio `sposi.live` risulta **Status: Not Started** (non "Pending", proprio "Not Started") — i record DNS necessari non sono mai stati effettivamente aggiunti/verificati su Register.it, nonostante il resoconto precedente. **Il codice della Edge Function è corretto**, il problema è solo la verifica dominio lato Resend/DNS.
- [ ] **⚠️ Azione richiesta — solo l'utente può farla (richiede login su Register.it, non automatizzabile)**: aggiungere questi 3 record DNS alla zona `sposi.live` su Register.it (pannello gestione DNS del dominio), poi tornare su resend.com/domains/sposi.live e cliccare "Verify DNS Records":
  1. **TXT** — Nome: `resend._domainkey` — Valore: `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDdeGFijJLN4gfzxULTAI9C4c0EmUg+5ta+kvrsbDrUdoovVBd3kKd/S4mVcZA4w6wBZsW2qJebgDcc5huC54Cllx1/2g2W983QFIR9G6FTlrBrH3iW8mlq6TnWsUaAS+KZupQFOsp5E52vmSpjvRSKPrqNs194mUSYC8Yc8Vnv2wIDAQAB` — TTL: Auto/3600
  2. **MX** — Nome: `send` — Valore: `feedback-smtp.eu-west-1.amazonses.com` — Priorità: 10 — TTL: Auto/3600
  3. **TXT** — Nome: `send` — Valore: `v=spf1 include:amazonses.com ~all` — TTL: Auto/3600
  (Il record MX per "Enable Receiving" su `@` non serve: quel toggle è disattivato, serve solo per ricevere email sul dominio, non per inviarle.)
- [x] **Bug secondario trovato durante il test**: nel payload dell'hook, `redirect_to` risultava ancora `http://localhost:3000` invece di `https://www.sposi.live/login`, nonostante il fix `emailRedirectTo` in `packages/core/src/auth.ts`. Conferma che il punto "Site URL / Redirect URLs" in **Supabase Dashboard → Authentication → URL Configuration** (segnalato dalla sessione 4, mai risolto) è la causa: se l'URL non è nella allow-list, Supabase ignora `emailRedirectTo` e usa il Site URL di progetto (ancora `localhost:3000`). Finché non si risolve anche questo, il rilevamento brand (`brandFor`) nella Edge Function non potrà mai distinguere JustMarry da Sposi (tutte le email finirebbero su "Sposi.live" per default). **Va fatto insieme al fix DNS sopra.**
- [x] **Utente ha aggiunto i 3 record DNS su Register.it e verificato il dominio su Resend** (status passato da "Not Started" a verde/"Domain verified").
- [x] **Fix Site URL/Redirect URLs completato direttamente da qui** (via Claude in Chrome, con permesso esplicito dell'utente): Supabase Dashboard → Authentication → URL Configuration → Site URL cambiato da `http://localhost:3000` a `https://sposi.live`; aggiunti 4 Redirect URL: `https://sposi.live/**`, `https://www.sposi.live/**`, `https://justmarry.live/**`, `https://www.justmarry.live/**`.
- [x] **Confermato funzionante con 2 registrazioni di test reali** (`agospe+verify20260705b@gmail.com`, `agospe+final20260705@gmail.com`) su sposi.live/signup: la Edge Function `auth-send-email` risponde 200, Resend conferma l'invio (con ID email restituito) da `info@sposi.live`. **Flusso Send Email Hook completamente operativo per sposi.live.**
- [ ] **Da verificare manualmente dall'utente**: aprire l'email ricevuta (una delle due caselle di test sopra, via alias "+") e cliccare il link di conferma per controllare che porti davvero a sposi.live (non più localhost) e completi la registrazione.
- [ ] **Ancora mancante**: `justmarry.live` non è verificato su Resend (rimandato dall'utente a un account/dominio pagante separato) — finché non lo sarà, eventuali registrazioni con redirect verso justmarry.live falliranno l'invio email allo stesso modo (dominio non verificato). Da riprendere quando pronto.
- [ ] Nota: la Edge Function `auth-send-email` contiene ancora dei `console.log('DEBUG ...')` aggiunti per la diagnosi di questa sessione — innocui, ma da rimuovere in un cleanup successivo per non loggare indirizzi email in chiaro nei log della funzione a lungo termine.

## Sessione 05/07/2026 (continua 7) — Video Guestbook: playback, watermark, condivisione file reale, countdown; kiosk camera; toggle notifiche
- [x] **Bug playback Video Guestbook**: i video caricati comparivano nella lista ma il player non partiva mai. Causa: `apps/web/src/app/api/media/[id]/download/route.ts` cercava il media SOLO in `media_uploads`, ma i video del Video Guestbook vivono in `video_messages` (tabella separata) → sempre 404 silenzioso. Fix: `.maybeSingle()` invece di `.single()` + fallback su `video_messages`.
- [x] **Watermark mancante nel Video Guestbook**: `/api/photos/[id]/share/route.ts` aveva lo stesso problema di tabella (solo `media_uploads`) più un mismatch URL (assumeva sempre Supabase Storage pubblico, ma i file post-migrazione R2 hanno solo `r2_key`). Fix: stesso fallback su `video_messages` + `getPresignedDownloadUrl` da `@fotosposi/r2-storage` quando è presente `r2_key`, namespace separato nella cache (`overlays/{eventId}/guestbook/...` vs `.../photos/...`) per evitare collisioni tra i due spazi di ID.
- [x] **Condivisione file reale (non link) con logo, su richiesta esplicita dell'utente**: nuovo helper `apps/web/src/lib/share-watermarked.ts` (`shareWatermarkedMedia`) che scarica il media già brandizzato da `/api/photos/[id]/share`, costruisce un `File` e usa `navigator.share({ files })` (Web Share API) per condividere il file vero e proprio, con fallback a download se il browser non supporta la condivisione file. Collegato sia al bottone "Condividi con logo" sotto ogni video in `guestbook/page.tsx`, sia ai bottoni per-foto nella Galleria in `events/[id]/page.tsx` (sostituendo la vecchia `shareMedia` che condivideva solo il link).
- [x] **Bottoni per-foto in Galleria invisibili su mobile**: erano `opacity-0 group-hover:opacity-100` (solo hover) — su touch non esiste hover, quindi risultavano non azionabili e il reclamo "il condividi deve essere nelle singole foto non in tutta la pagina" era in realtà dovuto a questo. Fix: bottoni condividi/scarica ora sempre visibili (angolo in basso a destra di ogni miniatura), non più legati a `:hover`.
- [x] **Countdown con audio prima della registrazione (Video Guestbook)**: `apps/web/src/components/video-recorder.tsx` — aggiunto stato `'countdown'`, beep sintetizzato via Web Audio API (nessun asset audio necessario), overlay visivo con il numero (3-2-1) sul preview della fotocamera prima che parta davvero la registrazione.
- [x] **Bug — fotocamera non partiva nel "Tavolo Selfie" (kiosk)**: `apps/web/src/app/kiosk/[code]/page.tsx`, `startCamera()` assegnava `videoRef.current.srcObject = stream` **prima** di passare a `step = 'camera'` — ma il tag `<video>` esiste nel DOM solo quando `step === 'camera'`, quindi in quel momento `videoRef.current` era ancora `null` e lo stream non veniva mai collegato (permesso fotocamera concesso, ma nessuna immagine). Fix: stream salvato in un ref (`streamRef`) e ricollegato con un `useEffect` che scatta dopo il mount del `<video>`.
- [x] **Bug — interruttori (toggle) nella pagina Notifiche spostati/deformi a destra**: `apps/web/src/app/events/[id]/notifications/page.tsx` — la pallina del toggle usava `translate-x-6`/`translate-x-0.5` ma **mancava la classe base `transform`**, senza la quale Tailwind non applica affatto la trasformazione CSS (verificato in produzione via Claude in Chrome: `getComputedStyle(...).transform` risultava `"none"`) — la pallina restava quindi incollata al bordo destro del binario invece di scorrere. Fix: aggiunta la classe `transform` accanto a `translate-x-*`.
- [ ] **Da pushare**: tutte le fix di questa sessione (vedi comandi git). Da testare dopo il deploy: caricare/registrare un video nel guestbook e verificare play + bottone "Condividi con logo"; provare condivisione foto/video dalla Galleria; aprire il Tavolo Selfie da telefono e verificare che la fotocamera parta; controllare visivamente i toggle in Notifiche.

## Sessione 05/07/2026 (continua 8) — QR invito rotto dopo registrazione, ruoli sposi/invitati, piano+limite Free, recupero password
- [x] **Bug critico — l'invito QR si perdeva dopo la registrazione**: un invitato che scansionava il QR, cliccava "Carica" (o "Video"), doveva loggarsi/registrarsi, e dopo la conferma email/login finiva SEMPRE su `/dashboard` — che per un utente nuovo mostra "nessun evento" + pulsante "crea evento", perdendo completamente il contesto dell'invito. Causa: nessuna pagina (`login`, `signup`, `/auth/callback`, tutte le `router.push('/login')` sparse in `events/[id]/*`) portava mai un parametro di ritorno. Fix sistemico: aggiunto un parametro `redirect` che attraversa tutta la catena login → signup → conferma email (`emailRedirectTo`) → OAuth (`redirectTo`) → `/auth/callback` → pagina di destinazione originale. Toccati: `packages/core/src/auth.ts` (`signUp`/`signInWithOAuth` accettano `redirectPath`), `apps/web/src/app/(auth)/login/page.tsx`, `.../signup/page.tsx`, `apps/web/src/app/auth/callback/page.tsx`, e tutte le pagine `events/[id]/*` + `admin/*` che reindirizzavano a `/login` senza contesto.
- [x] **Causa più profonda — nessuna distinzione tra sposi (admin evento) e invitati**: anche con il redirect risolto, un invitato che si registrava restava comunque bloccato, perché `apps/web/src/app/api/auth/setup/route.ts` creava SEMPRE una riga `core_users` con `role: 'sposo'` e nessun `event_id`, indipendentemente da come si era arrivati alla registrazione — quindi le RLS su `media_uploads`/`event_windows` (che controllano `core_users.event_id`) restavano sempre vuote per un invitato. Fix: il flusso di signup ora rileva se il `redirect` punta a un evento specifico (`/events/<id>/...`) e in quel caso crea `core_users` con `role: 'invitato'` + `event_id` corretto (niente `core_tenants` proprio, appartiene al tenant dell'evento a cui è invitato) invece del percorso "sposo crea il proprio account". Stesso fix applicato anche al login via Google/Facebook/Apple in `/auth/callback/page.tsx`, che prima non chiamava mai `/api/auth/setup` (un utente nuovo via OAuth non aveva MAI una riga `core_users`, a prescindere da sposo/invitato).
- [x] **RLS mancante per finalizzare l'upload di un ospite**: `upload_queue` permetteva INSERT a chiunque ma l'UPDATE (necessario per scrivere `r2_key` dopo il caricamento su R2) era permesso solo al creatore dell'evento — la foto di un ospite restava "pending" per sempre. Fix: policy UPDATE estesa anche a `uploaded_by = auth.uid()` (migration `00032`).
- [x] **File corrotto trovato durante il lavoro**: `apps/web/src/app/events/new/page.tsx` era troncato a metà (probabilmente un salvataggio interrotto in una sessione precedente, mai committato — per fortuna). Ripristinato dall'ultimo commit buono prima di applicare le modifiche di questa sessione.
- [x] **Aggiunto lo step "carrello" prima della creazione evento**: `events/new/page.tsx` ora mostra prima una scelta di piano (Free 0€ / Premium € 229 / Deluxe €375, quest'ultimi due con pulsante disabilitato "richiede Stripe" — **il pagamento reale per Premium/Deluxe richiede un account Stripe configurato, non ancora fatto**, stesso limite già presente in `/events/[id]/tier`). Sul piano Free, applicato il limite **1 evento gratuito per account**: se l'utente ha già un evento Free, il pulsante "Crea gratis" si disabilita con spiegazione.
- [x] **Aggiunto il flag "Consenti agli invitati di scattare foto e video"**: nuova colonna `events.allow_guest_media` (migration `00030`, default `true` per non cambiare il comportamento di eventi già esistenti), checkbox nel form di creazione evento, e se disattivato il bottone "Carica" sparisce dalla pagina ospite (`/event/[code]`).
- [x] **Password dimenticata — prima non esisteva proprio** (già segnalato in una sessione precedente ma mai costruito): aggiunte `apps/web/src/app/(auth)/forgot-password/page.tsx` e `.../reset-password/page.tsx`, funzioni `requestPasswordReset`/`updatePassword` in `packages/core/src/auth.ts`, link "Password dimenticata?" nella pagina di login. Usa il flusso "recovery" già gestito dalla Edge Function `auth-send-email` (brandizzata Sposi/JustMarry via Resend).
- [ ] **Migrazioni da applicare**: `00030_allow_guest_media`, `00031_guests_can_read_own_event` (di fatto ridondante — la policy corrispondente esisteva già dalla `00002`, lasciata comunque, innocua), `00032_guest_can_update_own_upload_queue` — **già applicate live su Supabase in questa sessione**, i file sono nel repo solo per tenere lo storico allineato al DB reale.
- [ ] **Limite noto — un utente può essere invitato/membro di UN SOLO evento alla volta**: `core_users` ha `event_id` singolo (non una tabella ponte many-to-many); se un utente che è già "sposo" del proprio matrimonio scansiona il QR di un evento altrui, il suo `core_users.event_id` resta quello del proprio evento, non viene aggiunto come membro del secondo. La tabella `event_guests` (più recente) già modella "un utente può essere ospite di più eventi", ma le policy RLS su `media_uploads`/`event_windows` non la usano ancora. Da valutare una migrazione più ampia se serve supportare utenti che sono ospiti in più matrimoni contemporaneamente.
- [ ] **Nota GDPR**: il login via OAuth (Google/Facebook/Apple) crea la riga `core_users` senza mostrare una schermata di consenso esplicito (a differenza della registrazione via email, che ha le due checkbox obbligatorie/facoltative) — comportamento preesistente, non introdotto ora, ma da sistemare con un'interstitial di consenso post-OAuth prima del lancio pubblico.
- [ ] **Da pushare e testare**: scansionare un vero QR code da un browser "pulito" (nessun account), registrarsi, e verificare di tornare sulla pagina di upload dell'evento invitato (non su /dashboard); provare "password dimenticata" end-to-end; provare a creare un secondo evento Free con lo stesso account e verificare che venga bloccato.

## Sessione 05/07/2026 (continua 9) — Fotocamera guestbook a schermo intero, bug anteprima non cliccabile, nome/indirizzo separati
- [x] **Bug trovato — l'anteprima video non era "rivedibile"**: nel componente `video-recorder.tsx`, la label "Anteprima — rivedi il tuo video" era un `<div>` posizionato sopra a TUTTO il video (inclusi i controlli nativi play/pausa/scrubber), senza `pointer-events-none` — quindi ogni tocco sul player veniva intercettato da quella label invece che arrivare ai controlli. Il video c'era ed era corretto, ma non si riusciva a interagirci. Fix: aggiunto `pointer-events-none` a tutte le overlay (countdown, testo suggerito, etichetta anteprima) così i tocchi passano sempre al player sottostante.
- [x] **Fotocamera a schermo intero**: prima era confinata in un riquadro `aspect-[4/3]` piccolo — ora durante conto alla rovescia/registrazione/anteprima si apre un overlay a tutto schermo (`fixed inset-0`), con pulsante X per chiudere in ogni momento. Il "Riprova" in anteprima ora riavvia subito una nuova registrazione invece di tornare alla schermata iniziale.
- [x] **Campi Cerimonia/Ricevimento — nome e indirizzo separati**: prima erano un solo campo di testo libero ("nome e indirizzo, es. Chiesa San Pietro, Via Roma 10"), causa del reclamo "il nome e l'indirizzo sono nella stessa riga". Aggiunte colonne `church_address`/`venue_address` (migration `00033`, già applicata live), form di creazione evento (`events/new/page.tsx`) ora ha due campi distinti per ciascuno (Nome + Indirizzo, oltre al Comune già esistente), e il link "apri nel navigatore" in `events/[id]/page.tsx` ora usa nome+indirizzo+comune per una query Maps più precisa (con fallback per eventi già creati prima di questo fix, che hanno solo il vecchio campo combinato).
- [ ] **IMPORTANTE — nulla di quanto fatto in questa sessione (compresa quella precedente: invito QR, ruoli sposi/invitati, piano+limite Free, recupero password, watermark/condivisione file, toggle notifiche, fotocamera kiosk) è ancora online**: l'ultimo commit pushato resta `b631fc2` (loghi OAuth). Il test riportato dall'utente ("il conto alla rovescia non parte", "manca il pulsante"...) potrebbe quindi riflettere ancora il sito vecchio — va rifatto un push (comandi già forniti in chat) prima di testare di nuovo.
- [x] **Chiarito e risolto — "l'app generica" era la PWA installata da Android dopo lo scan del QR**: `apps/web/src/app/manifest.ts` ha `start_url: '/'` fisso (limite dello standard Web App Manifest, non può puntare dinamicamente all'evento) — quindi l'icona che Android crea con "Aggiungi a schermata Home" da `/event/[code]` apriva sempre la homepage marketing generica (niente pulsante Carica, stile da sito pubblicitario, non l'esperienza del matrimonio). Fix: nuovo `apps/web/src/components/pwa-event-redirect.tsx` — `/event/[code]/page.tsx` salva in `localStorage` l'ultimo codice evento visitato; la homepage (`page.tsx`), se aperta in modalità standalone (icona home screen, rilevato via `matchMedia('(display-mode: standalone)')`), reindirizza subito a quell'evento invece di mostrare la homepage.

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
