# PROJECT STATUS — Sposi.live / JustMarry.live

## Sessione 02/08/2026 — Sfondo immagine countdown + titolo di benvenuto con nomi sposi

### Sfondo immagine countdown (mobile + desktop)
**Richiesta utente**: "vorrei mettere una bella immagine nello sfondo countdown" + "la foto la fornisco io ma devi cambiarla per il cellulare".

**Nota importante**: questo modello NON supporta input immagini → non posso vedere foto né screenshot. Ho usato **sharp con crop saliency automatico** (`position:'attention'`) e verificato la resa via DOM/browser (Playwright), non visivamente.

**L'utente ha poi fornito 2 PNG già nelle proporzioni giuste** in `G:\Il mio Drive\Scambio file\` (Google Drive esterno al repo):
- `countdown-bg-mobile.png` (941×1672 ≈ 9:16, brightness ~182/157/126)
- `countdown-bg-desktop.png` (1672×941 ≈ 16:9, brightness ~168/129/79)

Convertite in WebP (85% quality) e installate in `apps/web/public/`:
- `countdown-bg-mobile.webp` → 720×1280, 66KB
- `countdown-bg-desktop.webp` → 1600×900, 102KB

**Modifiche al componente `packages/ui/src/countdown.tsx`** (commit `add2fa5`, PUSHATO):
- Nuove props opzionali `backgroundImageMobile` / `backgroundImageDesktop`.
- Se presenti → render 2 `<img>` absolute (mobile `md:hidden`, desktop `hidden md:block`) + overlay scuro `bg-gradient-to-b from-black/50 via-black/30 to-black/70` + testo bianco con `drop-shadow-md` per contrasto.
- Se assenti → fallback al gradiente originale (retrocompatibile, nessun altro consumer rotto).
- Testo adattivo: `mutedClass`/`brandTextClass`/`headingClass` cambiano in bianco quando `hasBgImage`.

**Integrazione `apps/web/src/app/events/[id]/page.tsx`**: passa `backgroundImageMobile="/countdown-bg-mobile.webp"` e `backgroundImageDesktop="/countdown-bg-desktop.webp"` (path relativi alla root → funzionano identici su sposi.live E justmarry.live, stesso progetto Vercel).

**Verifica JustMarry**: `https://www.justmarry.live/countdown-bg-mobile.webp` → HTTP 200, 67658 bytes (identico al file). Nessun intervento aggiuntivo: il Countdown è la stessa pagina condivisa da entrambi i domini.

### Titolo di benvenuto con nomi sposi
**Richiesta utente**: "devi scrivere Benvenuti al Matrimonio di <nome sposa> e <nome sposo> esempio Elena e Mario, e il countdown 'Ci sposiamo tra' ... invece di 'Ci sposiamo tra Agostino Spera & Danila Villa'".

**Implementazione** (IN WORK-TREE, NON ancora commit/push):
- `packages/ui/src/countdown.tsx`: nuova prop opzionale `welcomeTitle` → se presente, l'h1 mostra `welcomeTitle` invece di `coupleName`.
- `apps/web/src/app/events/[id]/page.tsx`: calcola `welcomeTitle` dai campi `groom1/groom2_*`:
  - `brideName` = first_name del partner con `role==='bride'` (groom1 o groom2), fallback groom1.
  - `groomName` = first_name del partner con `role==='groom'` (groom1 o groom2), fallback groom2.
  - Se entrambi presenti → `t('cd_welcome_prefix', { bride, groom })`, altrimenti fallback a `couple_name`.
  - Evento test `ee2cc954` (groom1=Agostino/groom, groom2=Danila/bride) → "Benvenuti al Matrimonio di Danila e Agostino".
- i18n: nuova chiave `events.cd_welcome_prefix` con placeholder `{bride}`/`{groom}` in 6 lingue:
  - it: "Benvenuti al Matrimonio di {bride} e {groom}"
  - en-US/en-GB: "Welcome to the Wedding of {bride} and {groom}"
  - de: "Willkommen zur Hochzeit von {bride} und {groom}"
  - fr: "Bienvenue au Mariage de {bride} et {groom}"
  - es: "Bienvenidos a la Boda de {bride} y {groom}"

**Stato verifica titolo**: typecheck 0 errori (web+ui), JSON 6 lingue validi. La verifica browser NON era conclusa quando la chat si è interrotta (dev server riavviato, Playwright non più disponibile) — da confermare visivamente con la prossima chat.

### File modificati sessione 02/08
```
apps/web/public/countdown-bg-mobile.webp     NEW (720×1280 WebP, commit add2fa5)
apps/web/public/countdown-bg-desktop.webp    NEW (1600×900 WebP, commit add2fa5)
packages/ui/src/countdown.tsx                +45 (backgroundImage*, welcomeTitle, testo adattivo, commit add2fa5 + work-tree)
apps/web/src/app/events/[id]/page.tsx        +20 (props sfondo + calcolo brideName/groomName/welcomeTitle)
apps/web/messages/{it,en-US,en-GB,de,fr,es}.json  +1 chiave ciascuno (events.cd_welcome_prefix)
```

---

## Sessione 01/08/2026 (continua) — Widget meteo automatico Open-Meteo (giorno evento, 3 giorni prima)

### Richiesta
"il sistema deve lavorare automaticamente, gli sposi devono inserire meno cose possibili" + widget meteo che appare 3 giorni prima dell'evento (countdown widget + sito pubblico). Dopo analisi: 3B Meteo NON ha API pubblica (serve incollare codice embed generato dal wizard → passo manuale → viola il vincolo "meno cose possibili"). L'utente ha scelto **Open-Meteo** (gratis, senza API key, geocoding incluso).

### Decisione architetturale (differente dal piano 3B)
- **Niente campo nuovo nel site-builder**: la città si legge dai campi GIÀ inseriti nella creazione evento (`venue_city` / `church_city` / `location`) → zero input extra per gli sposi.
- **Widget appare SOLO da 3 giorni prima dell'evento** (fino al giorno dopo — wake-up invitati). Prima di 3 giorni è inutile (forecast non affidabile) e la finestra garantisce che la data sia sempre entro i 16 giorni di forecast Open-Meteo.
- Il meteo mostrato è quello del **giorno ESATTO della cerimonia** (start_date=end_date=eventDate), non "oggi" come farebbe il widget 3B.
- **Provider**: Open-Meteo `https://api.open-meteo.com/v1/forecast` + `https://geocoding-api.open-meteo.com/v1/search`. Gratis, senza key, no rate-limit per uso moderato.

### Cosa è stato fatto

**1. NUOVO package `packages/weather`** (`@fotosposi/weather@0.1.0`):
- `shouldShowWeather(eventDate, now?)` → true se oggi è in `[eventDate - 3gg, eventDate + 1gg]` (costanti `WEATHER_DAYS_BEFORE=3`, `WEATHER_DAYS_AFTER=1`). Date vuote/non valide → false.
- `weatherCodeToInfo(code)` → WMO weather code → `{ labelKey, emoji }` (19 condizioni mappate, fallback unknown).
- `buildOpenMeteoUrls(city, date)` → URL geocoding + closure forecast(lat, lon) con `start_date=end_date=date`.
- `fetchWeatherForEvent(city, eventDate, fetchFn?)` → geocoding → forecast → `{ city, date, code, tMax, tMin, rainProb }`. `fetchFn` iniettabile per test. Errori chiari: città vuota / data non valida / città non trovata / HTTP error / dati incompleti.
- **19 test** (`packages/weather/src/__tests__/index.test.ts`).

**2. Route `apps/web/src/app/api/weather/route.ts`** (GET `?city=&date=`):
- Valida param (city obbligatorio, date `YYYY-MM-DD`).
- Gate `shouldShowWeather(date)` → 404 se fuori finestra (non chiama Open-Meteo inutilmente settimane prima).
- `Cache-Control: public, s-maxage=3600` (il forecast non cambia ogni secondo).
- Errori → 404 con messaggio pulito (no stack).

**3. Componente client `apps/web/src/components/weather-widget.tsx`**:
- Props: `city?`, `eventDate?`.
- Gate client `shouldShowWeather(eventDate)` → render `null` se fuori finestra.
- Fetch `/api/weather` → card compatta: emoji condizione + città + max/min °C + % pioggia (se >0).
- Stati: loading (skeleton), unavailable (errore), data. i18n via `useTranslations('weather')`.

**4. Integrazione `apps/web/src/app/events/[id]/page.tsx`** (countdown widget):
- `weatherCity = event.venue_city || event.church_city || event.location` (priorità alle città specifiche di cerimonia/ricevimento).
- `<WeatherWidget city={weatherCity} eventDate={event.date} />` iniettato come `children` del `Countdown`, sotto `AddToCalendarMenu`.

**5. Integrazione `apps/web/src/app/sito/[id]/page.tsx`** (sito pubblico):
- La query `getDraft` ora fa select anche su `events.location, venue_city, church_city`.
- Imposta `content.eventCity` (priorità venue_city → church_city → location).
- Se `c.date && c.eventCity` → `<WeatherWidget>` nella hero sotto il pulsante "+ Calendario".

**6. i18n 6 lingue** (`apps/web/messages/{it,en-US,en-GB,de,fr,es}.json`): nuovo namespace `weather.*` con 23 chiavi (title, loading, unavailable, rain, sunny, mostly_sunny, partly_cloudy, cloudy, fog, drizzle, freezing_drizzle, light_rain, rain, heavy_rain, freezing_rain, light_snow, snow, heavy_snow, snow_grains, showers, snow_showers, thunderstorm, hail, unknown). Iniettate via script one-shot node (rimosso dopo l'esecuzione). Fix post-script: `rain_heavy` rinominata in `heavy_rain` (allineata a `weatherCodeToInfo`).

### Verifica
- Test: **361/361 verdi** (era 342 → +19 nuovi `packages/weather`). 29 file.
- Typecheck: `npx tsc --noEmit -p apps/web/tsconfig.json` → 0 errori. `packages/weather` → OK.
- Build: `npx next build` (apps/web) → OK, route `/api/weather` compilata.
- Test reale Open-Meteo: `fetchWeatherForEvent('Palermo', +10gg)` → `{city:'Palermo', code:0, tMax:32, tMin:27.5, rainProb:15}`. Nota: data a +29gg → HTTP 400 (Open-Meteo copre max 16 giorni) — NON è un bug: il gate 3 giorni impedisce chiamate fuori finestra.
- `npm install` eseguito (workspace `@fotosposi/weather` linkato + dep aggiunta in apps/web/package.json).

### File modificati
```
packages/weather/package.json                        NEW (modulo @fotosposi/weather)
packages/weather/tsconfig.json                       NEW
packages/weather/src/index.ts                        NEW (shouldShowWeather + weatherCodeToInfo + buildOpenMeteoUrls + fetchWeatherForEvent)
packages/weather/src/__tests__/index.test.ts         NEW (19 test)
apps/web/src/app/api/weather/route.ts                NEW (GET meteo con gate finestra)
apps/web/src/components/weather-widget.tsx           NEW (card meteo client, gate 3 giorni)
apps/web/src/app/events/[id]/page.tsx                +8 (weatherCity + WeatherWidget in Countdown children)
apps/web/src/app/sito/[id]/page.tsx                  +15 (select city + content.eventCity + WeatherWidget hero)
apps/web/package.json                                +1 (dep @fotosposi/weather)
apps/web/messages/{it,en-US,en-GB,de,fr,es}.json     +23 chiavi ciascuno (weather.*)
package-lock.json                                    rigenerato
PROJECT_STATUS.md                                    +80 righe (questa sezione)
```

### TODO post-push (prossima sessione)
1. **Verifica in produzione**: aprire `/events/[id]` di un evento con countdown_widget attivo e città valorizzata quando mancano ≤3 giorni → appare la card meteo col meteo del giorno esatto; il sito pubblico `/sito/[id]` mostra la stessa card nella hero. Prima dei 3 giorni → nessun widget.
2. **Commit + push atomico** (work-tree contiene anche sessione 31/07 + 01/08 countdown: 18+ file).
3. Se un evento non ha `venue_city`/`church_city`/`location` → il widget non appare (comportamento voluto, niente città = niente meteo).
4. Open-Meteo è gratuito ma con TOS da rispettare per volume — per l'uso "3 giorni prima" è abbondantemente sotto i limiti.

---

## Sessione 01/08/2026 — Countdown 3-phase + AddToCalendar (Google/Outlook/Apple iCal) milestone

### Richiesta
Completare il modulo countdown milestone iniziato nella sessione precedente:
- Helper calendario (Google URL, Outlook URL, ICS) già in `packages/site-builder/src/index.ts` (9/9 test).
- Da completare: componente `AddToCalendarMenu` + estensione `Countdown` con 3 phase (countdown → benvenuto cerimonia → ricevimento) + integrazione in `events/[id]/page.tsx` + i18n.
- Decisione: orari default cerimonia `11:00` e ricevimento `13:00` per il phase detection **senza migration DB**.

### Cosa è stato fatto

**1. `getEventPhase()` in `packages/site-builder/src/index.ts`** (helper puro, testato):
- 4 fasi: `countdown` (now < ceremonyStart) → `ceremony` (finestra ±2h dall'inizio cerimonia) → `reception` (da receptionStart fino a +24h wedding day) → `ended` (dopo +24h).
- Fallback orari hardcoded: cerimonia `11:00`, ricevimento `13:00` (nessuna colonna DB nuova — decisione milestone).
- Rispetta `SiteContent.ceremonyTime`/`receptionTime` e il `time` legacy come ceremonyTime.
- Caso gap (cerimonia conclusa ma ricevimento non iniziato) → resta `ceremony` (benvenuto).

**2. `packages/ui/src/countdown.tsx` esteso** (4 phase render, API retrocompatibile):
- Nuove props opzionali: `ceremonyTime`, `receptionTime`, `time`, `ceremonyAddress`, `receptionAddress`, `labels` (i18n passate dal caller), `children` (slot per AddToCalendarMenu).
- Phase `countdown` → countdown classico. Phase `ceremony` → card "💍 Benvenuti alla cerimonia!". Phase `reception` → card "🥂 Benvenuti al ricevimento!". Phase `ended` → card "❤️ Grazie a tutti!".
- Default labels IT hardcoded (fallback se caller non passa `labels`), nessuna dipendenza next-intl nel package UI.
- `packages/ui/package.json`: aggiunta dep `@fotosposi/site-builder@0.1.0` (dedup verificata con `npm ls`).

**3. `apps/web/src/components/add-to-calendar-menu.tsx` (NUOVO)**:
- Dropdown con 3 voci: Google Calendar (icona brand color), Outlook (icona brand), Apple Calendar `.ics` (download file).
- Usa `getCalendarLinks()` da `@fotosposi/site-builder` → 3 link generati da un'unica chiamata.
- Chiusura su click-esterno, varianti default/outline/ghost, size sm/default/lg. i18n via `useTranslations('calendar_menu')`.

**4. Integrazione in `apps/web/src/app/events/[id]/page.tsx`**:
- `Countdown` esteso con `time`/`ceremonyTime`/`receptionTime` + labels i18n + indirizzi cerimonia/ricevimento.
- `AddToCalendarMenu` iniettato come `children` dentro la card countdown (visibile in tutte le phase): link `Matrimonio <coppia>` con address cerimonia + nota ricevimento.

**4b. Orari reali dal SiteContent (FIX dopo review utente)**:
- Inizialmente il phase detection usava solo il fallback 11:00/13:00 perché la route `details` non ritornava gli orari. L'utente ha fatto notare che gli orari li impostano gli sposi nel site-builder → `apps/web/src/app/api/events/[id]/details/route.ts` ora legge `site_drafts.content` (JSONB, ultimo draft) e ritorna `ceremonyTime`/`receptionTime` nel payload.
- `events/[id]/page.tsx` legge quei campi dalla risposta details in `useState` (niente più cast locale `as WeddingEvent & {...}`).
- Risultato: funziona anche per cerimonie serali (es. 18:00) e orari qualsiasi — il phase detection è agnostico rispetto all'ora. Fallback 11:00/13:00 scatta solo se il draft non ha gli orari.

**5. i18n in 6 lingue** (`apps/web/messages/{it,en-US,en-GB,de,fr,es}.json`):
- 13 chiavi `events.cd_*` (countdown 3-phase: intro, unità tempo, enter_app, ceremony/reception/ended title+subtitle).
- Nuovo namespace `calendar_menu.*` (4 chiavi: add_to_calendar, google, outlook, apple).
- Iniettate via script one-shot node (rimosso dopo l'esecuzione, non lasciato nel repo).

### Verifica
- Test: **342/342 verdi** (era 314/316 → +13 nuovi `event-phase` + 2 skipped integrazione invariati; 28 file).
  - Nuovo `packages/site-builder/src/__tests__/event-phase.test.ts`: 13 test (countdown/ceremony/reception/ended, fallback orari, legacy time, gap ceremony, invalid date, Date.now fallback, eventi passati).
  - Esistenti `calendar-links.test.ts`: 9/9 invariati.
- Typecheck: `npx tsc --noEmit -p apps/web/tsconfig.json` → 0 errori. `packages/ui` typecheck OK.
- `npm install` eseguito (lockfile aggiornato per dep ui→site-builder).

### File modificati
```
packages/site-builder/src/index.ts                       +55 (getEventPhase + EventPhase type)
packages/site-builder/src/__tests__/event-phase.test.ts  NEW (13 test)
packages/ui/src/countdown.tsx                            riscritto (4 phase + labels + children + props orari)
packages/ui/package.json                                 +1 (dep @fotosposi/site-builder)
apps/web/src/components/add-to-calendar-menu.tsx         NEW (dropdown 3 provider calendario)
apps/web/src/app/events/[id]/page.tsx                    +30 (Countdown esteso + AddToCalendarMenu children)
apps/web/src/app/api/events/[id]/details/route.ts        +15 (ceremonyTime/receptionTime dal SiteContent)
apps/web/messages/{it,en-US,en-GB,de,fr,es}.json         +17 chiavi ciascuno (events.cd_* + calendar_menu.*)
package-lock.json                                        rigenerato
PROJECT_STATUS.md                                        +60 (questa sezione)
```

### TODO post-push (prossima sessione)
1. **Verifica in produzione** dopo commit/push: apertura `events/[id]` con countdown_widget attivo → countdown classico pre-evento; il giorno della cerimonia compare la card benvenuto cerimonia; dal ricevimento in poi card ricevimento; il dropdown AddToCalendar genera 3 link funzionanti (testare Google/Outlook/ICS su telefono).
2. **Orari reali dal SiteContent**: ✅ RISOLTO — la route details ritorna `ceremonyTime`/`receptionTime` dal draft. Se il draft non li ha, fallback 11:00/13:00. Verificare con un evento che ha ceremonyTime impostato (es. 18:00 serale) che il phase detection rispetti l'orario.
3. Commit + push atomico (work-tree contiene anche la sessione 31/07 non ancora pushato — 18+ file).


### Richieste utente (4 distinte)
1. **"la registrazione google non funziona"** — dopo OAuth Google "reindirizzamento in corso" poi torna a `/login`. Bug critico bloccante per ogni login social.
2. **Form post-OAuth per Google/Apple/Facebook** — dopo autenticazione social, chiedere nome, cognome, email (precompilata se il provider la fornisce), telefono obbligatorio, ruolo (Testimone/Parente/Amico/Altro manuale). Nome+cognome precompilati da Facebook (90% ha entrambi editabili), URL potendo mostrare nome uploader accreditato su ogni foto.
3. **"lo sposo o un suo delegato può cancellare delle foto dalla galleria"** + **"watermark in galleria ma NO in Google Drive"** (originale conservato grow up backup permanente dello sposo).
4. **"una volta registrato dal browser o dall'app deve rimanere collegato con il suo account"** — sessione persistente, niente re-login continuo.

### Diagnosi Google OAuth (root cause FINALE)
Log Supabase auth (via Supabase MCP `get_logs` service=api) confermano:
- `21:48:36` `GET /auth/v1/authorize?provider=google` HTTP 302 → Google
- `21:48:48` `GET /auth/v1/callback?code=4/0AXEQxICjk...` HTTP 302 → sposi.live/auth/callback
- `21:48:50` `POST /auth/v1/token?grant_type=pkce` **HTTP 200 ✅** (scambio code session riuscito!)
- `21:48:51` `GET /rest/v1/core_users?id=eq.ddd8e40e...` (route setup ha completato, riga creata)

**Quindi OAuth Google funzionava dal lato server.** L'utente tornava a /login perché:
- Middleware `getUser()` veniva invocato su `/auth/callback` PRIMA che i cookie authfossero propagati al server → `user = null` → redirect a `/login`.
- La callback client faceva `router.push('/dashboard')` ma al primo render il middleware (sul path /dashboard) vedeva cookie auth non ancora idratati → redirect /login.

### Fix applicati (work-tree NON ancora pushato)

**1. `/auth/callback` escluso dal middleware** (`apps/web/src/middleware.ts`):
```ts
if (request.nextUrl.pathname === '/auth/callback') return response;
```
+ `matcher` regex aggiornato per escludere `auth/callback`.

**2. `router.refresh()` prima del push finale** (`apps/web/src/app/auth/callback/page.tsx`):
```ts
async function finalizeAndRedirect(target: string) {
  setState('redirecting');
  router.refresh();  // ← forza Next a rifetchare la route lato server, cookie auth idratati
  await new Promise((r) => setTimeout(r, 50));  // ← tick per persistere cookie
  router.push(target);
}
```
Così al render di `/dashboard` il middleware vede i cookie auth appena settati da `exchangeCodeForSession`.

**3. Middleware con `flowType: 'pkce'` + auto-refresh** (`apps/web/src/middleware.ts`):
```ts
const supabase = createServerClient(url, anonKey, {
  cookies: { getAll, setAll },
  flowType: 'pkce', // ← FIX sessione persistente: refresh automatico access_token
});
```
Senza questo, dopo 1h (scadenza access_token) l'utente risulta non-authenticato finché non fa refresh manuale. `getUser()` invoca refresh autonomamente quando serve.

**4. Redirect con passaggio `redirect` param al login fallito** (`apps/web/src/middleware.ts`):
```ts
const loginUrl = new URL('/login', request.url);
loginUrl.searchParams.set('redirect', request.nextUrl.pathname + request.nextUrl.search);
return NextResponse.redirect(loginUrl);
```

**5. Gestione errore scambio code** (`apps/web/src/app/auth/callback/page.tsx`):
Se `exchangeCodeForSession` fallisce (es. code reuse, PKCE verifier perso quando l'utente chiude/riapre tab durante OAuth), redirect a `/login?error=oauth_failed` invece di restare bloccato a "reindirizzamento" in eterno.

### Form post-OAuth onboarding (NUOVO, solo invitati via QR)

**Strategia**: il form appare SOLO quando queste 3 condizioni sono verificate simultaneamente:
1. OAuth avuto successo (Google/Facebook/Apple).
2. RUechsirotspande nessuna riga `core_users` esistente per questo userId.
3. Il `redirect` punta a `/events/{id}/...` (cioè l'utente è atterrato lì da un QR code → invitato).

In tutti gli altri casi (sposo che si registra da /signup senza invito, login successivo di utente già registrato), il form NON appare — si va direttamente al redirect.

**Implementazione** (`apps/web/src/app/auth/callback/page.tsx`):
- Componente `OnboardingForm` inline nel file (no cartella separata). Campi: Nome, Cognome, Email (prefill da OAuth `user_metadata.full_name`), Telefono (obbligatorio), Ruolo (select: Testimone/Parente/Amico/Altro), customRole (input testo quando ruolo="Altro").
- Pre-fill intelligente: splitta `full_name` da Google in first/last name; Facebook dà `name`+`email`; Apple dà solo `email` (nasconde nome per privacy).
- Submit → POST `/api/auth/setup` con `roleAtEvent` → riga `core_users` creata con role='invitato' + role_at_event + event_id dell'evento invitato.
- Pre-check via POST `/api/auth/check-user` → se l'utente ESISTE già in core_users, salta diretto al redirect (no form).

**Route NUOVA `/api/auth/check-user`** (`apps/web/src/app/api/auth/check-user/route.ts`): POST con `{userId}` → ritorna `{exists: boolean, user: {role_at_event, first_name, last_name, phone} | null}`. Usa service role per bypassare RLS.

### Migration 00042 — `core_users.role_at_event`

**File**: `supabase/migrations/00042_core_users_role_at_event.sql`.

```sql
ALTER TABLE core_users ADD COLUMN IF NOT EXISTS role_at_event TEXT;
COMMENT ON COLUMN core_users.role_at_event IS
  'Ruolo dell''utente RELATIVO al matrimonio a cui è invitato (Testimone/Parente/Amico/Altro manuale). NULL per sposi/amministratori. Distinto da `role` che è il ruolo nella piattaforma.';
```

**Applicata live via Supabase MCP** (`apply_migration`) + `NOTIFY pgrst, 'reload schema'` (regola ferrea AGENTS.md). Verificata colonna presente nel DB.

### `role_at_event` propagato in `/api/auth/setup` route

`apps/web/src/app/api/auth/setup/route.ts` ora accetta `roleAtEvent` nel body e lo persiste su `core_users.role_at_event` quando crea la riga invitato (path `event` truthy). Per sposo (no eventId), `role_at_event` resta NULL (corretto: lo sposo non ha un ruolo "alle nozze", è ego chi organizza).

Se `core_users` esiste già (re-onboarding raro), fa UPDATE di first_name/last_name/phone/role_at_event invece di errore (silently idempotente).

### Cancellazione foto da galleria (NUOVO, sposo/delegato/uploader)

**Funzione `deleteMediaById(mediaId)` in `@fotosposi/media`** (`packages/media/src/service.ts`):
1. Legge `media_uploads` per ottenere `r2_key` e `original_r2_key`.
2. Best-effort cancella da R2 sia la key watermarked sia quella originale.
3. Best-effort cancella da Google Drive se `drive_file_id` presente e token Drive evento attivo.
4. **DELETE da `media_uploads`** (unico passo NON best-effort — se fallisce ritorna errore).

Esportata in `packages/media/src/index.ts`.

**Route `DELETE /api/media/[id]`** (`apps/web/src/app/api/media/[id]/route.ts`):
Autorizzazione: **solo sposo (events.created_by), delegato (event_managers con permission edit/admin), o uploader (uploaded_by === userId)** possono cancellare. Invitato ordinario NON può cancellare foto di altri (per evitare abusi).

Pattern "cestino" dei social: la foto sparisce dal feed ma resta nello storage permanente Drive dello sposo (il `deleteObject` Drive è best-effort — se fallisce non blocchiamo il DB delete).

### `canManage` esteso in `details` API + UI

**`/api/events/[id]/details` route** ora ritorna `{isCreator, isGuest, isManager, canManage}`:
- `isManager` = `event_managers` con permission edit/admin per questo evento.
- `canManage = isCreator || isManager` → controlla visibilità bottone "Cancella" in UI.

**`EventTimelineFeed`** (`apps/web/src/components/event-timeline-feed.tsx`) riceve `canManage` + `onDeleteMedia` props e le propaga a `FacebookFeed`.

**`FacebookFeed`** (`apps/web/src/components/facebook-feed.tsx`):
- Show bottone "Cancella" (Trash2 icon) nella barra azioni solo se `canManage && onDeleteMedia`.
- Click → pannello conferma inline (rosso chiaro) con "Annulla / Cancella" buttons.
- `deletingId` state disabilita il bottone durante la DELETE in corso.
- Chiave i18n `feed.cancella` aggiunta in 6 lingue (it, en-US, en-GB, de, fr, es).

**`apps/web/src/app/events/[id]/page.tsx`**:
- `canManage` state letto da `/api/events/[id]/details` (`d.canManage ?? d.isCreator`).
- Passa `canManage` + `onDeleteMedia` callback al `EventTimelineFeed`.
- La callback fa `fetch DELETE /api/media/[id]` + aggiorna lo state `media`/`videos` locali rimuovendo l'item cancellato (no refetch overhead).

### Drive sync con ORIGINALE NON WATERMARKED (FIX 31/07/2026)

**Modifica in `apps/web/src/lib/process-queue.ts`** (riga ~570, blocco Drive sync):

```ts
let driveBuffer: Buffer = buffer;
if (hasDrive && folders) {
  if (!isVideo) {
    try {
      const originalGetUrl = await getPresignedDownloadUrl(originalKey, 600);
      if (originalGetUrl) {
        const origResp = await fetch(originalGetUrl);
        if (origResp.ok) driveBuffer = Buffer.from(await origResp.arrayBuffer()) as Buffer;
      }
    } catch (origErr) {
      console.warn(...);
      driveBuffer = buffer; // fallback watermarked — meglio imperfetto che niente
    }
  }
}
// ... drive multipart body ora usa driveBuffer invece di buffer
```

Strategia: l'originale NON watermarked è già salvato su R2 in `originals/${r2_key}` (riga 469, introdotto da FIX 29/07/2026). Per le FOTO, scarichiamo l'originale e lo mandiamo a Drive pulito. Per i VIDEO, il watermark è insito nel buffer ffmpeg (video-overlay applica overlay in-place, l'originale non è salvato su R2 per video >100MB) → Drive riceve il video watermarked (limite architetturale documentato).

### Accreditamento uploader in galleria (FIX 31/07/2026)

**`/api/events/[id]/media` route** ora arricchisce ogni record media con `uploader_name` e `uploader_role_at_event`:
- Singola query su `core_users` per gli `uploaded_by` distinti.
- `uploader_name = first_name + ' ' + last_name` se entrambi presenti, fallback a `name`.
- Mappatura in memoria O(n) — nessun join DB additional.

**`EventTimelineFeed`** usa `uploader_name + ' — ' + role_at_event` come author del post feed → "Mario Rossi — Testimone" appare in fronte al post foto, invece del fallback `couple_name`.

Interfaccia `MediaUpload` in `packages/media/src/index.ts` estesa con `uploader_name?: string` e `uploader_role_at_event?: string | null` (campi arricchiti lato API route, NON popolati da `createMediaRecord`).

### Verifica

- **Typecheck**: `npx tsc --noEmit -p apps/web/tsconfig.json` → **0 errori**.
- **Test**: `npx vitest run` → **314/316 verdi** (2 skipped librsvg/fontconfig invariati dalla sessione precedente). Nessun test nuovo per queste feature ( sono pull UI/service — saranno testati manualmente in produzione).
- **Migration 00042 applicata live** + `NOTIFY pgrst, 'reload schema'` eseguito.
- **Work-tree NON ancora commit/pushato** — 18 file modificati + 4 nuovi.

### File modificati

```
supabase/migrations/00042_core_users_role_at_event.sql    NEW (colonna role_at_event)
apps/web/src/app/api/auth/check-user/route.ts             NEW (POST existence check)
apps/web/src/app/api/media/[id]/route.ts                 NEW (DELETE handler)
apps/web/src/app/auth/callback/page.tsx                   ~+120 (OnboardingForm + router.refresh + finalizeAndRedirect)
apps/web/src/app/api/auth/setup/route.ts                  +20 (roleAtEvent + UPDATE existing)
apps/web/src/app/api/events/[id]/details/route.ts         +15 (isManager + canManage)
apps/web/src/app/api/events/[id]/media/route.ts            +25 (enrich uploader_name/role_at_event)
apps/web/src/app/events/[id]/page.tsx                     +25 (canManage state + handleDeleteMedia)
apps/web/src/components/event-timeline-feed.tsx           +20 (canManage/onDeleteMedia props, author with uploader)
apps/web/src/components/facebook-feed.tsx                 +50 (Trash2 icon, confirm inline, deletingId state, canManage/onDeleteMedia props)
apps/web/src/lib/process-queue.ts                         +35 (driveBuffer = originale NO watermark)
apps/web/src/middleware.ts                                +10 (flowType pkce + auth/callback escluso + redirect param)
packages/media/src/index.ts                               +15 (MediaUpload uploader_name/role_at_event fields, deleteMediaById export)
packages/media/src/service.ts                             +50 (deleteMediaById function)
apps/web/messages/{it,en-US,en-GB,de,fr,es}.json          +1 riga ciascuno (chiave feed.cancella)
```

### TODO post-push (prossima sessione)

1. **VERIFICARE IN PRODUZIONE** dopo commit/push:
   - Login Google → arriva al redirect corretto, NON torna a /login.
   - Form onboarding appare SOLO al primo login invitati via QR.
   - Sessione resta dopo refresh/chiusura tab (cookie persistente PKCE flow).
   - Bottone "Cancella" in galleria per sposo/delegato (non invitati). Conferma inline. Foto sparisce + R2 cleanup + originale Drive resta.
   - Foto nuova su Drive scaricata SENZA watermark; foto in galleria CON watermark.
   - "Mario Rossi — Testimone" appare come author del post feed foto (se l'uploader ha compilato role_at_event).

2. **Commit + push atomico** da PowerShell (vedi PROMPT-PROSSIMA-CHAT.md per comandi).

3. **Facebook OAuth** — utente abilita in Supabase Dashboard (Authentication → Providers → Facebook). Solo azione manuale.

4. **Apple OAuth** — richiede Apple Developer Account $99/yr. Solo se l'utente vuole.

5. **Drive doppi evento ee2cc954** — se ancora segnalati, scaricare lista file Drive reale per confronto.

6. **Bug brand hardcoded Sposi.live** in `apps/web/src/app/api/auth/google/callback/route.ts:47` — passa `'Sposi.live'` invece di `event.brand`. Fix 1 riga.

7. **Foto vecchie ee2cc954 senza original_r2_key** (28 foto) — scaricarle → cancellare → ricaricare per popolare original_r2_key.

### Note tecniche importanti

- **Best-effort R2 in `deleteMediaById`**: se il delete R2 fallisce (transient o key mancante per record pre-migration), il record DB viene comunque cancellato. Questo è preferibile: la foto sparisce dalla galleria (obiettivo utente) anche se resta un orphaned file su R2 (che verrà riciclato dal R2 lifecycle se configurato, o vivrà come垃圾). Meglio di un DB con record GM ma R2 inesistente (foto morta in galleria).
- **Best-effort Drive in `deleteMediaById`**: se Drive 401/404, il file resta orphan su Drive ma il record sparisce da DB → foto non più visibile in galleria. Il backup originale Drive dello sposo resta accessibile (non toccato).
- **Codice `exchangeCodeForSession` fallito ≠ bug sistema**: se l'utente chiude/riapre il tab durante OAuth Google, il `code_verifier` PKCE salvato in `sessionStorage` si perde → lo scambio fallisce. La callback ora gestisce questo con redirect a `/login?error=oauth_failed` dando feedback visibile (prima loop morto).
- **`flowType: 'pkce'` nel middleware** è CRITICO per sessione persistente. Senza questo, dopo 1h di access_token scaduto, `getUser()` non refresha → utente sloggato. Con PKCE flow, getUser refresha automaticamente.

---

## Sessione 30/07/2026 (continua 2) — FIX 8 cuore PNG inline + misurazione real testo

### FIX 8 ✅ PUSHATO (commit `743bdd6`, deploy Vercel Ready in 1m)
**Richiesta utente**: "NIENTE CUORE SEMPRE IN BASSO ADDIRITTURA FUORI FOTOE SPAZI ECCESSIVO, INOLTRE LA SCRITTA è PICCOLA QUINDI AUMENTA DEL +75%" (dopo deploy `f506fa6` che non aveva risolto).

**Root cause (FINALE) identificata con test render reali**:
1. **librsvg su Vercel lambda NON renderizza correttamente `<path transform="translate(x y) scale(s)">`** — il path SVG con scaling viene renderizzato disallineato (cuore più alto del previsto) e più piccolo del scale richiesto. Test in locale: cuore a 200×200 → render via `<path transform>` → cuore renderizzato 19×16 px invece di 21×39 come richiesto da width/height del transform.
2. **Stima `CHAR_WIDTH_ESTIMATE = textPx * 0.55` era inaccurata di 43px** per font Georgia 39px (real = 16.7px/media, stima = 21.45) → cuore posizionato 43px troppo a destra rispetto al limite reale del testo → "gap eccessivo".

**Soluzione**:
1. **PNG cuore pre-generato** (`packages/photo-overlay/src/heart-png.ts`): 200×200 px rosso #d9534f, embeddato come base64 (4644 char). Generato via script in `packages/photo-overlay/scripts/gen-heart-png.js` da `HEART_PATH_DATA` (normalizzato 20×20 viewBox → sharp renderizza a 200×200 PNG).
2. **Cuore renderizzato via `<image href="data:image/png;base64,..." preserveAspectRatio="none">`** al posto del `<path transform>`. Test librsvg: cuori a 20/40/60/100 px producono 226/930/2115/5893 pixel rossi su questa macchina (rendering deterministicamente corretto, scala proporzionale al quadrato).
3. **Misurazione REAL della larghezza dei segmenti di testo** (pre-pass con sharp): renderizza ogni segmento su un canvas di prova alto `actualTextPx * 2 + 8`, trova il rightmost pixel non-bianco (valore luma > 128), usa quella misura REAL per posizionare il cuore subito dopo il testo (no gap, no overlap). Padding di 2px per evitare che il cuore tocchi l'ultimo carattere. Fallback su stima empirica `* 0.85` se la misurazione fallisce.
4. **Cuore quadrato** (`width = actualTextPx, height = actualTextPx`) come un glifo quadrato del font.

**Verifica**:
- Typecheck: `npx tsc --noEmit -p apps/web/tsconfig.json` → 0 errori.
- Test: **314/316 verdi** (2 skipped integration: librsvg/fontconfig richiede FONTCONFIG_PATH completo non disponibile in vitest+jsdom).
- Deploy: commit `743bdd6` pushato → Vercel deployment `fotosposi-1lx880i4d` Ready in 1m.
- **ANCORA NON TESTATO IN PRODUZIONE dall'utente** — la fix vera è quella di questo commit.

### OAuth Google/Facebook — diagnosi via API

**Test diretto** `/auth/v1/authorize?provider=X` con anon key:

| Provider | Stato Supabase | Azione richiesta |
|----------|----------------|------------------|
| Google | ✅ **Abilitato e funzionante** — 2 utenti reali registrati via Google (`ilpostoce@gmail.com` 29/07, `immobilagent76@gmail.com` 28/07). OAuth redirect a `accounts.google.com` con Client ID `846532943146-...apps.googleusercontent.com`. | URL redirect autorizzati in Google Cloud Console. |
| Facebook | ❌ **NON abilitato** in Supabase Dashboard. API ritorna 400 body vuoto. | **Attivare** in Supabase Dashboard → Authentication → Providers → Facebook → Enabled + App ID/Secret di Meta Developers. |
| Apple | ❌ **NON abilitato** in Supabase Dashboard. API ritorna 400. | Richiede setup Apple Developer Account ($99/yr). |

**Per abilitare Facebook** (manuale, solo utente può farlo):
1. https://developers.facebook.com/ → Create App → tipo "Consumer" → nome "Sposi.live".
2. App Settings → Basic → ottieni **App ID** e **App Secret**.
3. Facebook Login → Setup → web → Aggiungi Valid OAuth Redirect URI:
   `https://krgqyluuiltckmhbeuue.supabase.co/auth/v1/callback`
4. Supabase Dashboard → Authentication → Providers → Facebook → toggle Enabled → incolla App ID + App Secret → Save.
5. Facebook App deve essere "Live": App Review → permissions `email`, `public_profile`.

**Importante**: Google OAuth usa lo stesso Client ID (`846532943146-...`) per entrambi i flussi:
1. Custom Drive Backup (`/api/auth/google/callback`) — scope `drive.file email`.
2. Supabase Auth login (via `signInWithOAuth('google')`) — redirect `https://krgqyluuiltckmhbeuue.supabase.co/auth/v1/callback`.

Entrambi devono essere elencati in Google Cloud Console → Credentials → OAuth 2.0 Client ID `846532943146-...` → "Authorized redirect URIs".

### Drive doppi — diagnosi DB

- Evento `ee2cc954`: 100 foto in `media_uploads`, **0 duplicati** su stesso `r2_key` (unique constraint `uniq_media_event_r2key` OK).
- 71/100 foto senza `original_r2_key` (pre-migration 00040, watermark sovrapposto se ri-processate).
- 28/100 foto marchiate `watermark_missing = true`.

Naming Drive: `${YYYY_MM_DD_HH_MM_SS}_${uploaderName}_${safeOriginal}` → ogni caricamento è UNIVOCO. I "doppi" su Drive NON sono duplicati r2_key → cause possibili:
1. Cron retry: se Drive POST ha fallito a metà (POST inviato, response non ricevuto) il secondo tentativo ri-uploada. Auto-cleanup (riga 426-430) protegge gli item con `drive_file_id` già presente.
2. Documenti iPhone camera con stesso nome (`1000144023.jpg`): due invitati diversi caricano foto distinte con stesso nome → due file su Drive diversi uploader → apparentemente "doppi" ma contenuti diversi.

Verifica raccomandata: scaricare la lista file Drive via OAuth, confrontare con `media_uploads`. Da affrontare prossima sessione se serve.

### Test integration — stato

314 test verdi totali. 2 test **SKIPPED** in `packages/photo-overlay/src/__tests__/index.integration.test.ts`:
- `il cuore ❤ è SEMPRE rosso ed e rilevabile anche senza font di sistema disponibili`
- `con fontBuffer embeddato, logo e nomi sono rilevati insieme al cuore`

Richiedono librsvg con fontconfig completo non disponibile in ambienti vitest+jsdom. Su shell standalone `node` con sharp diretto il PNG cuore viene renderizzato correttamente (418 pixel rossi totali su 800×600 canvas). Da riattivare in futuro in ambiente CI dedicato.

### File modificati

```
packages/photo-overlay/src/heart-png.ts                            NEW (export base64 4644 char)
packages/photo-overlay/src/index.ts                                ~+140/-100 righe (PNG + misurazione real)
packages/photo-overlay/src/__tests__/heart-inline.test.ts          +/-20 (5 test a <image>)
packages/photo-overlay/src/__tests__/index.test.ts                +/-25 (2 test a <image>)
packages/photo-overlay/scripts/gen-heart-png.js                    NEW (rigenera PNG)
packages/photo-overlay/scripts/heart-200-base64.txt                NEW (artifact)
packages/photo-overlay/scripts/heart-base64.txt                    NEW (artifact)
packages/photo-overlay/scripts/test-heart-png.js                   NEW (test harness)
packages/photo-overlay/scripts/.gitignore                          NEW (esclude *.png *.jpg)
PROJECT_STATUS.md                                                  +60 righe
```

### TODO post-push (prossima sessione)

1. **VERIFICA URGENTE utente produzione** — scaricare una foto recente su evento `ee2cc954` e verificare:
   - Cuore visibile e allineato verticalmente col testo (baselineY)
   - Testo "Agostino ❤ Danila — 30/07/2026" più grande (+75%)
   - Gap tra testo/cuore/testo minimo (≤2-3px)
   - Se ancora non funziona: leggere log Vercel `/api/r2/process-queue` per `misurazione testo: segments=... widths=...`.

2. **Drive doppi** — se ancora presenti:
   - Scaricare lista file Drive OAuth per evento `ee2cc954`
   - Confrontare con `media_uploads.r2_key`

3. **OAuth Facebook** — utente deve abilitare Facebook in Supabase Dashboard (vedi istruzioni sopra). Solo azione manuale.

4. **OAuth Google Cloud Console** — verificare "Authorized redirect URIs" includa:
   ```
   https://krgqyluuiltckmhbeuue.supabase.co/auth/v1/callback  (Supabase OAuth login)
   https://www.sposi.live/api/auth/google/callback              (Drive backup custom)
   https://sposi.live/api/auth/google/callback
   https://www.justmarry.live/api/auth/google/callback
   https://justmarry.live/api/auth/google/callback
   http://localhost:3000/api/auth/google/callback
   ```

5. **Bug residuo brand hardcoded** in `/api/auth/google/callback/route.ts:47` — passa `'Sposi.live'` invece di `event.brand` a `ensureDriveFolders`. Per JustMarry.live le cartelle si chiamano "Sposi.live". Fix rapido (1 riga).

### Architettura finale rendering watermark (post-FIX 8)

```
applyOverlay(imageBuffer, branding)
    │
    ├── 1. story/square resize (1080x1920 + image inside)
    ├── 2. sharp.stats bottom-25% → autoText black/white
    ├── 3. split coupleNames su ❤ (strippa U+FE0F VS16)
    ├── 4. SAFETY CHECK: actualTextPx*0.92 se > maxWidth
    ├── 5. Font embeddato @font-face + data URI base64 (fontBuffer)
    ├── 6. MISURAZIONE REAL testo:
    │      - Render ogni segmento su canvas prova 600x(actualTextPx*2+8)
    │      - Flatten nero + greyscale + rightmost pixel > 128
    │      - segmentWidths[i] = rightmost + 2px padding
    │      - Fallback stima*0.85 se misurazione fallisce
    ├── 7. SVG watermark:
    │      - <text> per ogni segmento (x,y absolute)
    │      - <image href="data:image/png;base64,HEART_PNG_BASE64"
    │        preserveAspectRatio="none" x=cursorX y=baselineY-actualTextPx
    │        width=actualTextPx height=actualTextPx/> per ogni cuore
    │      - viewBox="0 0 imgWidth imgHeight" esplicito
    ├── 8. Logo brand top-right A COLORI (sharp resize 25.5% clamp 135-680)
    └── 9. Sharp composite(.jpeg({quality:92}).toBuffer())

HEART_PNG_BASE64 = PNG 200x200 px rosso #d9534f
                   generato una tantum via gen-heart-png.js
                   <image width height preserveAspectRatio=none>
                   per riempire slot quadrato deterministiquement
```

---

## Sessione 30/07/2026 — FIX 6 cuore come carattere + inizio FIX 7 solidità operativa

### FIX 6 ✅ PUSHATO (commit `6172bb2`)
**Richiesta utente**: "il cuore ed eventuale emoticon nel watermark deve essere come un carattere, quindi nessuna sovrapposizione nessuno spazio aggiuntivo".

**Cosa è cambiato in `packages/photo-overlay/src/index.ts`**:
- `HEART_PATH_DATA`: costante con path cuore normalizzato bounding-box 20×20 (origine top-left).
- `applyOverlay`: il cuore ❤ viene ora renderizzato come `<path fill="#d9534f">` SEPARATO dal `<text>` MA con `transform="translate(...) scale(...)"` posizionato esattamente al centro di uno slot largo `CHAR_WIDTH_ESTIMATE` (= larghezza media di un carattere del font). Niente gap, niente offset.
- `heartSize` ora = `textPx` (non più `0.85 * textPx`): il cuore è grande quanto un singolo carattere del font scelto, integrato nel layout tipografico.

**Iterazione scartata**: avevo provato prima con `<tspan dx="0" dy="0">` wrappando il path del cuore dentro `<text>`, ma `librsvg` su sharp NON rendeva il path annidato (restituiva 0 pixel rossi → `detectWatermark.hasHeart = false`). La soluzione "due elementi separati" (text + path) è quella che funziona realmente.

**Test**: 18/18 verdi per `packages/photo-overlay` (incluso integration test `hasHeart=true` su sharp reale, fixture `Agostino ❤ Danila`).

### FIX 7 ✅ PUSHATO (commit `78b13c3`, deploy READY)
**Richiesta utente**: "i messaggi di errori in fase di caricamento aumentano, ricorda il sistema deve essere solido resistente, deve gradualmente gestire migliaia di matrimoni con centinaia di invitati se un solo invitato da problemi immagine in fase operativa".

**Scelta implementativa**: Retry esponenziale + DLQ + Isolamento per-batch + Telemetry.

**Cosa è cambiato** (`apps/web/src/lib/process-queue.ts`):
1. **`processSingleItem(item, ctx)` estratto** dal `for` inline: ogni item processato da una funzione isolata che NON Propaga errori (outer catch → `return false`).
2. **`Promise.allSettled` concorrenza 4** invece del for seriale: un item corrotto/lento (240MB video ffmpeg) NON blocca gli altri del batch né gli eventi successivi. Chunking inline `for (i=0; i<n; i+=CONCURRENCY)` → niente `pLimit` né nuove dipendenze.
3. **Backoff esponenziale puro** `computeProcessingBackoffMs(retry)` esportato: 1s→2s→4s→8s→16s→32s→60s (cap). Cumulativo 1..7 = 123s.
4. **`moveToDeadLetter(supabase, item, failureClass, msg)`**: dopo `MAX_RETRY_COUNT=7` fallimenti, copia l'item in `upload_queue_dead_letter` e lo cancella da `upload_queue`. La coda principale resta snella anche con migliaia di matrimoni.
5. **`logFailure(supabase, {eventId, fileName, failureClass, errorMessage, retryCount})`**: scrive una riga in `system_health_log` (tabella già esistente, migration 00029) per ogni fallimento. Best-effort: se la insert fallisce, log warning ma NON blocca.
6. **`failure_class` enum-style**: `r2_download_failed | watermark_apply_failed | drive_sync_failed | detect_watermark_missing | invalid_image | other`. Dashboard admin può aggregare per categoria.

**Route NUOVA `apps/web/src/app/api/cron/dlq-retry/route.ts`** (auth Authorization Bearer CRON_SECRET):
- Ogni 6 ore (vercel.json `0 */6 * * *`) legge DLQ items con `dlq_next_retry_at NULL o <= now` e `dlq_retry_count < 5`.
- Per ognuno: re-inserisce un nuovo item in `upload_queue` (status pending, retry_count 0) e aggiorna la DLQ con `dlq_retry_count++` e `dlq_next_retry_at` calcolato con backoff più lento (1h→2h→4h→8h→24h max 5). Dopo 5 tentativi DLQ resta come storico (non più ripescato).
- Logga in `system_health_log` con `job='dlq-retry'`.

**`apps/web/vercel.json` aggiornato**:
```json
{ "crons": [
  { "path": "/api/cron/backup", "schedule": "0 4 * * *" },
  { "path": "/api/cron/maintenance", "schedule": "20 4 * * *" },
  { "path": "/api/cron/dlq-retry", "schedule": "0 */6 * * *" }
]}
```

**Test (`apps/web/src/lib/__tests__/process-queue-fix7.test.ts`)**: 13 nuovi test verdi:
- `computeProcessingBackoffMs`: 0→retry_count<=0, 1→1s, 2→2s, ..., 6→32s, 7→60s (cap, non 64s), 8+→60s costante, negativi→0.
- Sequence cumulativa 1..7 = 123000ms (1+2+4+8+16+32+60).
- Determinismo: stesso input → stesso output (no jitter, importante per test ripetibili).

**Verifica**:
- Typecheck: `npx tsc --noEmit -p apps/web/tsconfig.json` → 0 errori.
- Test: **313/313 verdi** (era 300: +13 nuovi FIX 7, era 281 inizio sessione → +32 totali sessione).
- Deploy Vercel `78b13c3` → **Ready** (build OK in 21s).
- `.gitignore` aggiornato con `.playwright-mcp/` (artefatti MCP non committibili).

### Architettura finale del processing upload (post-FIX 7)
```
upload_queue (pending/failed)
        │
        ▼
processQueueForEvent (cron ogni 4:20 UTC + trigger upload page)
        │
        ├── LEGGE items (status in [pending,failed], retry_count < 7, limit 5)
        │   NB: cron sweep ogni 4:20 su TUTTI gli eventi con pending;
        │   trigger upload page solo per l'evento attivo in realtime.
        │
        ├── CHIAMA processSingleItem PER OGNI item
        │   CONCORRENZA 4 (Promise.allSettled + chunking)
        │   │
        │   ├── 1. mark status='processing'
        │   ├── 2. download R2 (presigned URL)
        │   ├── 3. salva originale in originals/<r2_key>
        │   ├── 4. applyWatermark (foto) / applyVideoOverlay (video)
        │   ├── 5. upload watermarked su R2 (sovrascrive)
        │   ├── 6. detectWatermark verify (self-healing)
        │   ├── 7. createMediaRecord (con original_r2_key)
        │   ├── 8. Drive sync (se OAuth collegato)
        │   └── 9. update status='synced' o 'failed'
        │
        ├── SU SUCCESSO → status='synced' + retry_count=0
        │
        └── SU FALLIMENTO
            ├── retry_count++ < 7 → status='failed' (cron retry con backoff atteso)
            │                    + logFailure(system_health_log)
            └── retry_count++ >= 7 → moveToDeadLetter
                                     + logFailure(system_health_log)
                                     + DELETE da upload_queue

upload_queue_dead_letter (DLQ)
        │
        ▼
/api/cron/dlq-retry (ogni 6h, auth CRON_SECRET)
        │
        ├── LEGGE DLQ items (dlq_next_retry_at NULL o <= now, dlq_retry_count < 5)
        │
        ├── PER OGNI item:
        │   ├── RE-INSERT in upload_queue (status='pending', retry_count=0, nuovo id)
        │   └── UPDATE DLQ (dlq_retry_count++, dlq_next_retry_at = now + 1h/2h/4h/8h/24h)
        │
        └── DOPO 5 tentativi DLQ → item resta in DLQ come storico (non più ripescato)

system_health_log
        │
        ├── Ogni fallimento: kind='upload_processing_failure', event_id, file_name,
        │   failure_class, error_message, retry_count
        │
        └── Ogni run cron: job='maintenance'/'dlq-retry'/'backup', status, details
```

### TODO post-FIX-7
1. Test in produzione: caricare una foto corrotta MIME (es. .txt con estensione .jpg) e verificare che dopo 7 retry vada in DLQ e che `system_health_log` registri le 7 righe.
2. Verificare `/api/cron/dlq-retry` risponde `{"status":"ok","retried":0,...}` con curl auth Bearer.
3. Dashboard admin `/admin/system` per visualizzare `system_health_log` aggregato per failure_class, eventi top, ecc. (NON ancora implementato, prossimo passo).
4. **Foto vecchie `ee2cc954`**: le 28 foto pre-migration 00040 non hanno `original_r2_key`. suggerimento: scaricarle dalla galleria, cancellare `media_uploads`, ricaricare così `original_r2_key` sarà popolato dal nuovo processing.

### File modificati in questa sotto-sessione
```
 packages/photo-overlay/src/index.ts                                     | +120/-40 righe (HEART_PATH_DATA + refactor cuore)
 packages/photo-overlay/src/__tests__/index.integration.test.ts           | +5/-5 righe (rimozione debug log)
 packages/photo-overlay/src/__tests__/heart-inline.test.ts                | NEW (95 righe, 4 test FIX 6)
 supabase/migrations/00041_upload_queue_dead_letter.sql                   | NEW (68 righe, FIX 7 — migration applicata)
 PROJECT_STATUS.md                                                        | +70 righe (questa sezione)
```

### Comando vercel per prossima chat
```powershell
$env:VERCEL_TOKEN = "<vedi ECCOLO FOTOSPOSI.txt>"
vercel ls --prod | Select-String "Ready|Error"
vercel inspect fotosposi-rbqf5hrh7-studiolegvitrano-blip1.vercel.app
```

---

## Sessione 29/07/2026 (continua 1) — FIX watermark_text custom ignorato (priorità invertita)

### Contesto
Dopo il push del fix sharp (sessione precedente), l'utente testa l'evento `ee2cc954-98d7-4e11-828b-668a52e738e2` (Agostino e Danila). Le foto ora hanno watermark applicato (logo + scritta cuore), MA il testo è **sempre** "Agostino Spera ❤ Danila Villa" invece del testo custom impostato nei settings: **"W gli Sposi! Agostino Spera & Danila Villa 30/07/2026 ❤️"**.

### Diagnosi
Verificato l'evento nel DB:
- `events.watermark_text = 'W gli Sposi! Agostino Spera & Danila Villa 30/07/2026 ❤️'`
- `events.watermark_font = 'classico'`
- `events.watermark_names = true`
- `events.groom1_first_name = 'Agostino'`, `groom1_last_name = 'Spera'`
- `events.groom2_first_name = 'Danila'`, `groom2_last_name = 'Villa'`

Root cause: in `apps/web/src/lib/process-queue.ts` (e nella copia in `repairWatermarkForEvent`) la priorità era:

1. `groom1 + groom2` → "Agostino Spera ❤ Danila Villa" (VINCENTE)
2. `watermark_text` custom → ignorato se i campi groom sono compilati
3. `couple_name` → fallback legacy

Scelta del 27/07/2026 per gestire automaticamente la formattazione "Nome ❤ Nome" senza costringere l'utente a scriverla. MA questo **sovrascrive il testo custom** che l'utente ha esplicitamente scelto (inclusa la data 30/07/2026 e la frase "W gli Sposi!"), che è proprio il caso d'uso principale dei settings.

Inoltre, il testo custom dell'utente contiene già un cuore ❤️ (U+2764) — questo è OK perché `applyOverlay` (packages/photo-overlay) ora splitta il cuore e lo renderizza come path vettoriale rosso indipendente dai font (fix 28/07), quindi non cade su font Dingbats mancanti.

Il font `"classico"` viene risolto correttamente da `watermarkFontFamily('classico')` → `'"Playfair Display"'`, e `loadWatermarkFontBuffer('classico')` → `Buffer` del TTF `PlayfairDisplay-Regular.ttf` da `apps/web/public/fonts/`. **Il font è stato sempre passato, il bug era solo nel testo**.

### Fix applicato
**1. Estratto helper puro `composeWatermarkLine1(event)` in `apps/web/src/lib/process-queue.ts`** (esportato, testabile). Logica prioritaria INVERTITA:

```ts
if (!namesEnabled) return '';
const customText = (event.watermark_text || '').trim();
if (customText) return customText;            // 1. custom VINCE
const groom1 = [event.groom1_first_name, event.groom1_last_name].filter(Boolean).join(' ').trim();
const groom2 = [event.groom2_first_name, event.groom2_last_name].filter(Boolean).join(' ').trim();
if (groom1 && groom2) return `${groom1} ❤ ${groom2}`;   // 2. nomi separati (formattazione automatica)
return (event.couple_name || '').trim();                  // 3. fallback legacy
```

**2. Rimosse le duplicazioni inline** in `processQueueForEvent` e `repairWatermarkForEvent` (entrambi ora chiamano `composeWatermarkLine1(event)` — singola fonte di verità).

**3. 13 nuovi test** in `apps/web/src/lib/__tests__/process-queue-watermark-priority.test.ts`:
- `watermark_text` custom vince sempre sui nomi separati
- `watermark_text` whitespace-only cade su nomi separati
- `watermark_names=false` → stringa vuota anche con custom presente
- Caduta su `couple_name` se custom vuoto e groom mancanti
- Trim applicato ovunque
- Scenario esatto utente (Agostino+Danila+30/07/2026) — verifica presenza di ❤️ e data nel risultato
- `event null/undefined/vuoto` → stringa vuota
- Default `watermark_names` (undefined) si comporta come true

### Verifica
- Typecheck: `npx tsc --noEmit -p apps/web/tsconfig.json` → 0 errori.
- Test: **281/281 verdi** (era 268: +13 nuovi).
- Work-tree pronto per commit. **Da pushare + verificare su Vercel**.

### TODO post-push
- [ ] Pushare il fix
- [ ] Curl `/api/r2/repair-watermark` su evento `ee2cc954-...` per ri-applicare watermark alle 28 foto con il nuovo testo custom
- [ ] Verificare galleria: foto devono mostrare "W gli Sposi! Agostino Spera & Danila Villa 30/07/2026 ❤️" in basso a sinistra, font Playfair Display (classico), logo Sposi.live top-right
- [ ] Risolto anche il bug utente su eventuali altri eventi che avevano customText impostato ma nomi separati compilati (impossibile identificarli dal DB senza uno scan sistematico — applicare la fix al volo su ogni evento futuro tramite il processing)

### File modificati in questa sotto-sessione
```
 apps/web/src/lib/process-queue.ts                                 | +35 righe (helper composeWatermarkLine1 esportato + sostituzione inline)
 apps/web/src/lib/__tests__/process-queue-watermark-priority.test.ts | NEW (150 righe, 13 test)
 PROJECT_STATUS.md                                                 | +60 righe (questa sezione)
```

---

## Sessione 29/07/2026 — FIX SHARP BUILD: dedup versione 0.34.5 (bug critico monorepo)

### Contesto
Build Vercel falliva con:
```
Module not found: Can't resolve '@img/sharp-libvips-dev/include' in
  '/vercel/path0/packages/photo-overlay/node_modules/sharp/lib'
```
Tre commit precedenti (sharp/@img in outputFileTracingIncludes, serverExternalPackages, deps esplicite di apps/web) non avevano risolto. Causa scoperta leggendo i build log: `packages/photo-overlay/package.json` dichiarava `sharp: ^0.33.0`, mentre `apps/web/package.json` (hoisted root) richiedeva `^0.34.5`. Range non sovrapponibili → npm installava una **seconda copia annidata** dentro `packages/photo-overlay/node_modules/sharp@0.33.5` (con `libvips` nativo vecchio, senza i binding `@img/sharp-libvips-dev` di 0.34). webpack, compilando `packages/photo-overlay/src/index.ts` (è in `transpilePackages`), risolveva `import('sharp')` dalla copia annidata locale → serverExternalPackages non bastava a escludere la risoluzione nidificata.

### Fix
- `packages/photo-overlay/package.json`: `sharp: ^0.33.0` → `^0.34.5`.
- `npm install` → `npm ls sharp` mostra **una sola copia deduplicata** (`sharp@0.34.5 deduped`, 0 nested).
- `package-lock.json` rigenerato: rimossi tutti i `@img/sharp-*@0.33.5`.

### Verifica
- Typecheck: 0 errori.
- Test: **268/268 verdi** (+3 nuovi integration test su sharp reale).
- `npm ls sharp` conferma dedup completa.

### Commit
- Da pushare atomicamente (photo-overlay/package.json + package-lock.json).

## Sessione 28/07/2026 (continua 4) — BUG #1 RISOLTO: PostgREST schema cache stale → watermark_missing "inexistent column"

### Contesto
L'utente segnala: upload di 28 foto (Free tier, max 400KB ciascuna) → 9 falliti con errore "Could not find the 'watermark_missing' column of 'media_uploads' in the schema cache", 19 in attesa (timeout 10 min).

### Diagnosi
- DB verifica: colonna `media_uploads.watermark_missing boolean DEFAULT false` **esiste** (migration 00039 applicata con `execute_sql` in sessione 3).
- Codice `createMediaRecord` (`packages/media/src/service.ts:30`) passa correttamente `watermark_missing: params.watermark_missing ?? false`.
- Root cause: **PostgREST tiene uno schema cache in memoria** e NON si refresha automaticamente dopo `ALTER TABLE`. Risultato: il client Supabase (che passa attraverso Data API → PostgREST) continua a vedere lo schema pre-migration → rifiuta upsert con `42703 column "watermark_missing" does not exist` (come se la colonna non esistesse).
- Questo spiega anche perché le **19 foto "in attesa"** non venissero processate: il cron sweep provava le stesse upsert → stessa errore → status stuck a pending.
- L'errore `400` di PostgREST con message "schema cache" è il segnale inequivocabile di cache stale.

### Fix applicato

**1. Refresh schema cache via NOTIFY pgrst** (azione immediata):
```sql
NOTIFY pgrst, 'reload schema';
```
Eseguito via Supabase MCP. Da quel momento `createMediaRecord` ha ricominciato a funzionare.

**2. Reset degli item falliti** per farli riprovare con schema cache fresh:
```sql
UPDATE upload_queue
SET status = 'pending', retry_count = 0, error = NULL
WHERE status = 'failed' AND error LIKE '%watermark_missing%';
```
→ 9 item + 19 pending = 28 item tornati tutti `pending, retry_count=0, error=NULL`.

**3. Processati manualmente via cron maintenance** (auth `Authorization: Bearer <CRON_SECRET>`):
- 1 sweep iniziale → 5 item processati → risultati: `{"eventsSwept":1,"itemsProcessed":5,"perEventErrors":{}}`.
- 4 sweep consecutivi → 5+5+5+3 item processati.
- Totale: **28/28 synced** in `media_uploads`, **0 watermark_missing**, **28 drive_file_id** assegnati (Drive sync OK anche senza `event_drive_tokens` — l'utente ha collegato Google OAuth nel browser prima di questo test, il token è stato registrato).

**4. Cleanup eventi duplicati**:
- Verificato: l'utente aveva per errore creato 4 eventi identici ("Agostino e Danila", 21:19:24 / 21:19:27 / 21:19:38 / 21:19:49 — 25 secondi di clic multipli).
- Solo l'ultimo (`ee2cc954`) aveva upload collegati (28).
- I 3 eventi vuoti (0 uploads, 0 sub_events, 0 tokens) sono stati cancellati: `DELETE FROM events WHERE id IN ('4ec5a4ab...', '648beb10...', '1418d78e...');`.
- Root cause del doppio click: pagina `/events/new` non disabilita il bottone "Crea evento" durante la POST. Da fixare in sessione futura con `useState` + `disabled={submitting}`.

### Verifica finale DB

```sql
-- upload_queue
{"status":"synced","n":28}

-- media_uploads
{"total":28,"watermark_missing":0,"drive_synced":28,"photos":28,"videos":0}
```

Tutti e 28 gli item passati da `failed/pending` a `synced` → le foto sono ora visibili in galleria all'URL `/events/ee2cc954-98d7-4e11-828b-668a52e738e2` (l'utente può verificare subito).

### Regola ferrea per future migrations (added to AGENTS.md)

`apply_migration` su Supabase MCP applica le DDL ma **NON refresha la cache PostgREST**. Consequenza: qualsiasi nuovo `ALTER TABLE / ADD COLUMN` via migration MCP è invisibile al Data API finché non si esegue manualmente:
```sql
NOTIFY pgrst, 'reload schema';
```
Documentato in AGENTS.md sezione "Migrazioni DB".

### TODO post-fix
- [ ] L'utente verifica galleria evento Agostino e Danila → 28 immagini visibili con watermark (se mancanti, lanciare `/api/r2/repair-watermark` con `eventId=ee2cc954...`).
- [ ] Verificare in produzione che OAuth Google signup ora funzioni (commit `3322c48` deploy dovrebbe essere live).
- [ ] Fix UX: disabilitare bottone "Crea evento" durante POST per evitare duplicati (vedi `apps/web/src/app/events/new/page.tsx`).

---

## Sessione 28/07/2026 — Watermark self-healing (detectWatermark) + Compressione video 1/5

### Contesto
Commit `25e6541` pushato con i fix delle 6 sessioni precedenti. Work-tree pulito.

L'utente richiede due miglioramenti:
1. **Verifica automatica che il watermark sia applicato**: senza self-healing check, schede upload_queue risultano 'synced' ma la foto su R2 potrebbe non avere watermark (es. applyOverlay fallito in silenzio per librsvg/fontconfig tofu, foto raramente watermarked in produzione).
2. **Compressione video 1/5 senza perdere qualità**: ogni minuto di video occupa ~100MB. 10min = 1GB. Tier Free R2 ha 10GB storage → 5-10 eventi massimo. Serve riduzione dimi 5x.

### Fix 1 — Self-healing watermark check con `detectWatermark`

**Strategia**: dopo che processQueueForEvent ha caricato il file watermarked su R2, scarica di nuovo lo stesso file e verifica che il watermark sia EFFETTIVAMENTE presente. Se no → status='failed' + media_uploads.watermark_missing=true.

**Detect euristico (no ML, no OCR)** in `packages/photo-overlay/src/index.ts`:
- Estrae 2 regioni di test:
  - **Logo top-right** (15% width×height, posizione top:2%/right:2%) → calcola stddev dei pixel greyscale. Soglia: `LOGO_STDDEV_THRESHOLD = 12`. Se sopra → logo presente.
  - **Nomi bottom-left** (35% width, 5% height, posizione bottom:1.2%/left:1.2%) → calcola stddev + edge transitions orizzontali (passaggi luma > 40 su 255). Soglie: stddev ≥ 6, edges ≥ 8. Se sopra → testo presente.
- `confidence` = combinazione pesata (0.6 nomi + 0.4 logo), clampato 0-1.
- Limiti noto (documentati nel codice): foto con coriandoli/luci festa → falso positivo, foto monocromatiche (cerimonia religiosa) → falso negativo. La funzione è strutturale, NON tenta OCR (sarebbe lento in lambda).

**Integrazione in `apps/web/src/lib/process-queue.ts`**:
- Dopo `PutObjectCommand` (upload a R2), scarica di nuovo il file, chiama `detectWatermark`, logga `[process-queue] watermark OK su <file_name>: confidence=...` oppure `[process-queue] WATERMARK MANCANTE su <file>: presence=...` se mancante.
- Status finale dell'item è guidato da `watermarkMissing`:
  - Drive OK + watermark OK → 'synced'.
  - Drive OK + watermark mancante → 'failed' con errore chiaro "Watermark non applicato"
  - Drive failed + watermark mancante → 'failed' con errore composto (per debug).
- `media_uploads.watermark_missing` aggiornato in `createMediaRecord` → flag persistente per UI/alerting.

**Miglioramento parallelo a `applyWatermark`**: rimosso `buffer as Buffer` cast che creava mismatch `Buffer<ArrayBufferLike>` vs `Buffer<ArrayBuffer>` in TypeScript strict (fixato in typecheck).

### Fix 2 — Helper one-shot `repairWatermarkForEvent` + route `/api/r2/repair-watermark`

**Esporta da `apps/web/src/lib/process-queue.ts`**: funzione `repairWatermarkForEvent(eventId, limit=50)` che:
1. Legge `media_uploads` per `event_id = ? AND watermark_missing = true AND type = 'photo'` (NON upload_queue — quegli item sono synced/non esistenti).
2. Per ogni record: download R2 → `applyWatermark` → upload su stessa r2_key → verify con `detectWatermark` → update `watermark_missing = false`.
3. Non tocca upload_queue né drive_sync_status (preserva stato esistente).
4. Ritorna `{ repaired, skipped, errors }`.

**Route `apps/web/src/app/api/r2/repair-watermark/route.ts` (NUOVA)**: POST auth `X-Cron-Secret` (come altre route admin-one-shot). Body `{ eventId, limit? }`. maxDuration 300s.

**Uso tipico**:
1. Applica migration 00039 (vedi sotto) per colonna `watermark_missing`.
2. Esegui unlock-shaped SQL: `UPDATE media_uploads SET watermark_missing = true WHERE event_id = '<UUID>' AND type = 'photo';` (marchia tutte le foto di un evento passato come sospette — la repair verifica e ri-applica).
3. `curl -X POST https://sposi.live/api/r2/repair-watermark -H 'X-Cron-Secret: <CRON_SECRET>' -d '{"eventId":"<UUID>","limit":100}'`
4. Output mostra quanti records sono stati effettivamente ri-watermarkati vs quanti skip (gia' ok o irrecuperabili).

### Fix 3 — Compressione video H.264 crf 26 + preset medium (–1/5 dimensione)

**Richiesta utente**: 10min video = 1GB su R2/Drive insostenibile (Free tier 10GB). Riduzione target 5x senza perdita qualità percepita.

**Approccio**: aggiornamento settings ffmpeg (no codec nuovo, no infrastruttura nuova). Stesso encoding applicato in due posti:

1. **`packages/video-overlay/src/index.ts`** (lambda path, usato da `/api/photos/[id]/share` e `processQueueForEvent`):
   - `-crf 26` (era `23`): ~50% riduzione bit rate, qualità percepita quasi identica (YouTube stesso target).
   - `-preset medium` (era `veryfast`): encoding più lento ma bitrate ottimale per stessa qualità.
   - `-maxrate 2.5M -bufsize 5M`: VBV cap, stabilizza dimensione su clip lunghi.
   - `-pix_fmt yuv420p` esplicito: max compatibilità.
   - Watermark in unicit passaggio via `-filter_complex overlay` (no re-encoding).

2. **`vps-scripts/video-watermark-server.js`** (VPS sidecar, video >100MB): stessi settings applicati al path remoto (utente ha già VPS ready per wa-automate).

**Risultato atteso**: video iPhone 1080p H.264 high bitrate (8-12Mbps) → crf 26 medium → ~200KB/s = ~200MB per 10min. Watermark nel medesimo passaggio (zero overhead, zero duplicazioni).

**Verifica** (dopo push): scaricare un video 10min watermarked dalla route `/api/photos/[id]/share?format=square`, dimensione deve essere ~200-300MB (era ~1GB). Qualità percepita su iPhone/Android = indistinguibile da originale per clip wedding (movimenti smooth, no bitrate-killer scene tipo esports).

### Stato finale sessione
- Typecheck: `npx tsc --noEmit -p apps/web/tsconfig.json` → 0 errori.
- Test: **256/256 verdi** (era 252: +4 nuovi `detectWatermark` test).
- Work-tree NON ancora committato (in attesa push final sessione).

### ⚠️ AZIONE UTENTE RICHIESTA — Migration 00039 via Dashboard SQL Editor
DNS blocca `supabase db push` dalla macchina utente (come per 00037/00038). Esegui su https://supabase.com/dashboard/project/krgqyluuiltckmhbeuue/sql/new:

```sql
ALTER TABLE media_uploads
  ADD COLUMN IF NOT EXISTS watermark_missing BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN media_uploads.watermark_missing IS
  'True quando process-queue ha caricato il file su R2 ma detectWatermark ha verificato che il watermark NON è effettivamente presente (self-healing check, sessione 28/07/2026).';
```

(NB: migrations 00037 e 00038 della sessione precedente sono ancora pending — vanno applicate tutte e 3 se non lo sono ancora.)

### TODO post-push
- [ ] Verificare che le foto nuove del evento 13b5d266 abbiano watermark OK (logs Vercel `/api/r2/process-queue`), altrimenti vedremo `WATERMARK MANCANTE su <file>` e dovremo diagnosticare la vera causa ambientale (sharp stats? librsvg tofu? fontconfig su Vercel lambda?).
- [ ] Se confermato watermark mancante in produzione: marcare foto vecchie come `watermark_missing = true` via SQL Editor e lanciare `repairWatermarkForEvent` via curl → foto corrette senza ri-upload completo.
- [ ] Testare compressione video: caricare un video 5min (~500MB or originale iPhone), processo queue → vedi size finale su R2 (~100-150MB).
- [ ] Verificare qualità percepita video post-compressione su iPhone Safari, Android Chrome, desktop — confrontare con originale.

### File modificati in questa sessione
```
 apps/web/src/lib/process-queue.ts                         | +60 righe (verify post-upload, watermarkMissing propagation, repairWatermarkForEvent helper)
 apps/web/src/app/api/r2/repair-watermark/route.ts        | NEW (25 righe, route one-shot X-Cron-Secret)
 packages/photo-overlay/src/index.ts                      | +120 righe (detectWatermark + computeStddev + computeHorizontalEdges + clamp01)
 packages/photo-overlay/src/__tests__/index.test.ts       | +60 righe (+4 test detectWatermark uniforme/watermark/confidence/stddev)
 packages/video-overlay/src/index.ts                      | +14 righe (crf 26, preset medium, maxrate/bufsize, pix_fmt yuv420p)
 packages/media/src/service.ts                            | +3 righe (param watermark_missing in createMediaRecord)
 packages/media/src/index.ts                              | +1 riga (campo watermark_missing su MediaUpload interface)
 vps-scripts/video-watermark-server.js                    | +14 righe (stesso crf 26 / preset medium settings lato VPS sidecar)
 supabase/migrations/00039_media_uploads_watermark_missing.sql | NEW (15 righe, ALTER TABLE + COMMENT)
 PROJECT_STATUS.md                                        | +80 righe (questa sezione)
```

### Sessione 28/07/2026 (continua 1) — Auto-retry backoff esponenziale upload (SW + client)

**Contesto**: commit `5097fd9` pushato. L'utente chiede sviluppo continuo. Affrontato il TODO più impattante per scenari wedding reali: connessione ballerina (WiFi venue affollato, copertura cellulare debole in campagna).

**Problema risolto**: il client `uploadSingleFile` ritentava UNA volta sola l'upload su R2; il Service Worker ritentava solo quando scattava `online`/`sync`/`flush-now` event → nessun backoff, banda sprecata per retry ravvicinati, e potenziale ban da R2 per troppe PUT in poco tempo.

**Soluzione applicata**:

1. **Helper testabile `computeBackoffMs(retryCount)` in `apps/web/src/lib/upload-queue.ts`**:
   - Sequenza esponenziale: `1s → 2s → 4s → 8s → 16s → 32s → 60s (cap)` (`BACKOFF_CAP_MS`).
   - `+ jitter 0..BACKOFF_BASE_MS` per evitare thundering herd su riconnessioni di molti client insieme.
   - `BACKOFF_MAX_RETRIES = 5` per il client (gli invitati non possono aspettare oltre).
   - Esportato + 9 test verdi (attempt 1/2/3/6/7+/0/-5, jitter random, cap esponente).

2. **Retry con backoff in `uploadSingleFile`**:
   - PUT verso R2: max 5 tentativi con sleep cancellabile via `AbortSignal` tra uno e l'altro.
   - POST `/api/upload/init`: stesso pattern (raro fallire ma cold start Vercel lambda).
   - Sleep helper `sleep(ms, signal?)` che rigetta con `AbortError` se l'utente annulla.

3. **Backoff persistente nel Service Worker `apps/web/public/sw.js`**:
   - `flushOne(record)` salta il record se `Date.now() < record.nextRetryAt`.
   - Su fallimento: persistenza su IndexedDB di `retryCount++`, `nextRetryAt = Date.now() + computeBackoffMs(retryCount)`, `lastError`.
   - `updateUploadRecord(record)` helper (IndexedDB.put su stessa keyPath).
   - `BACKOFF_MAX_RETRIES = 20` per il SW (~1h max di backoff cumulativo prima di lasciare il record per ispezione manuale).
   - Su successo: il record viene rimosso (retryCount si resetta automaticamente).

**Limitazione documentata**: il SW ha una copia inline della logica `nextBackoffMs` (non può importare da moduli TS — file standalone). Stessi numeri di `BACKOFF_BASE_MS/CAP_MS` per coerenza lato client/SW. Se cambiamo le costanti nel client, vanno aggiornate anche nel SW.

**Verifica**:
- Typecheck: 0 errori.
- Test: **265/265 verdi** (era 256: +9 nuovi test backoff).
- Build: `next build` OK.
- `next start` (production): homepage 200 OK, /events/[id] 200 OK.

### File modificati in questa sotto-sessione
```
 apps/web/public/sw.js                          | +50 righe (nextBackoffMs, updateUploadRecord, backoff persistente su IndexedDB, skip se nextRetryAt futuro)
 apps/web/src/lib/upload-queue.ts               | +60 righe (computeBackoffMs esportato, sleep cancellabile, retry PUT + init con backoff)
 apps/web/src/lib/__tests__/upload-backoff.test.ts | NEW (+9 test computeBackoffMs deterministici)
 PROJECT_STATUS.md                              | +50 righe (questa sotto-sessione)
```

### Sessione 28/07/2026 (continua 3) — Reset totale DB+R2 + 3 migration applicate + Fix OAuth callback

**Contesto**: dopo il reset totale fatto dall'utente (TRUNCATE di tutte le tabelle + DELETE auth.users + 323 oggetti R2 cancellati), l'utente testa la registrazione da cellulare. Rileva 2 bug:
1. **OAuth Google signup → "reindirizzamento" → ritorna a /signup**: bug fixato in questa sessione.
2. **Salvataggio impostazioni evento (nome/cognome sposi) → "could not find the 'groom1_first_name' column"**: bug fixato da migration 00038 applicata in questa sessione.

**Migration applicate (via Supabase MCP apply_migration + execute_sql)**:
- **00037** `uniq_media_event_r2key`: PRIMO tentativo via apply_migration → errore "already exists" fuorviante (era solo un INDEX con stesso nome, non un CONSTRAINT). Risolto con DROP INDEX + ADD CONSTRAINT. Ora unique constraint vero.
- **00038** `grooms_first_last_name`: 6 colonne nuove su events + backfill best-effort da `couple_name`. ✅
- **00039** `watermark_missing`: applicata con execute_sql (apply_migration conflict su version tracking). ✅
- Tutte e 3 confermate: `groom_cols=6`, `watermark_col=1`, `unique_constraint=1`.

**Bug OAuth fix — root cause finale**:
La callback `/auth/callback/page.tsx` per Google/Facebook/Apple NON chiamava `supabase.auth.exchangeCodeForSession(code)` che è il passaggio richiesto dal **Authorization Code Flow** per trasformare il `?code=...` (dalla query string OAuth) in una sessione Supabase valida. Risultato: l'utente completava Google OAuth → redirect a `/auth/callback` → callback NON scambiava il code → `getSession()` ritornava null → `getCurrentUser` ritornava null → `/dashboard` redirect a `/login`. L'utente vedeva "Reindirizzamento in corso..." per un istante (il messaggio iniziale del componente prima del useEffect) e poi... in realtà la pagina dice "Reindirizzamento in corso..." come testo del return JSX, MA contemporaneamente `router.push(redirect || '/dashboard')` parte in useEffect — quindi l'utente mobile vede brevemente "Reindirizzamento in corso..." poi va a `/dashboard` e siccome la sessione non c'è → `/login`.

**Fix applicato** in `apps/web/src/app/auth/callback/page.tsx`:
```ts
const code = searchParams.get('code');
if (code) {
  const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeErr) console.error('[auth/callback] exchangeCodeForSession fallito:', exchangeErr);
} else if (window.location.hash) {
  await supabase.auth.getSession();  // confirm email flow (token in hash)
}
```
- `code` da query string → OAuth Google/Facebook/Apple (PKCE flow)
- `hash` (#access_token=...) → conferma email dal magic link

**Bug "Free scelto, tu trasforma in Deluxe"** — FALSO ALLARME:
Verificato `createEvent` in `packages/events/src/service.ts`: `tier: params.tier ?? 'free'` rispetta sempre il parametro passato dal client. `events/new/page.tsx:18` ha `useState<Tier>('free')` come default e `setSelectedTier(tier)` su `choosePlan(tier)`. Non c'è logica che forza Deluxe. Probabilmente l'utente ha cliccato Premium o Deluxe per sbaglio nella scelta iniziale (UI mostra i 3 piani).

**Verifica**:
- Migration: tutte applicate e verificate nel DB.
- OAuth fix: typecheck OK, build OK.
- Test: 265/265 verdi (non toccati dal fix).

### File modificati in questa sotto-sessione
```
 apps/web/src/app/auth/callback/page.tsx                | +6 righe (exchangeCodeForSession per OAuth flow)
 PROJECT_STATUS.md                                       | +30 righe (questa sezione)
```


**Contesto**: commit `a7f46ed` pushato (backoff SW+client). L'utente chiede sviluppo continuo. Affrontati 2 TODO post-push 25e6541:
- **Notifica push "upload completato"**: l'invitato che scansiona il QR, carica 5 foto, chiude il tab pensando "ok fatto" — se il SW sta ancora processando la coda, non ha feedback.
- **Compressione foto automatica >2MB**: foto iPhone/Android moderne 4-8MB saturano la banda venue (150 invitati collegati al WiFi insieme).

**Soluzione applicata**:

1. **Notifica locale "upload completato" (no VAPID/push server)** in `apps/web/public/sw.js`:
   - `flushAll()` ora, dopo aver flushato tutti i record con successo E con `clients.length === 0` (nessuna finestra aperta), chiama `self.registration.showNotification('Foto caricate', { body: '${okCount} foto salvate con successo.', tag: 'fotosposi-upload-complete' })`.
   - Fallback gracioso se `Notification.permission !== 'granted'` → `console.warn` silenzioso (no NotAllowedError throw).
   - Handler `notificationclick`: porta in primo piano una finestra già aperta O apre `/` (PwaEventRedirect reindirizza all'ultimo evento).
   - **Nessuna nuova infrastruttura push server richiesta**: è una notifica locale (in-app), non push remoto.
   - In `apps/web/src/app/events/[id]/upload/page.tsx`: dopo il primo `stats.synced >= 1`, chiede `Notification.requestPermission()` con delay 1.5s (non infastidisce l'utente mentre festeggia l'upload OK). Controlla `Notification.permission !== 'default'` per non richiedere due volte.

2. **Compressione foto automatica >2MB** in `apps/web/src/app/events/[id]/upload/page.tsx`:
   - **Tier Free**: SEMPRE comprime a 1200px (già esistente, mantenuto).
   - **Tier Premium/Deluxe**: NUOVO — comprime SOLO se `file.size > 2MB` a 1920px lato lungo. Risultato: foto iPhone 8MB → ~800KB (-90%), qualità visiva praticamente identica per display web/social. Skip sotto 2MB (non spreca CPU per foto piccole).
   - Video skippati (già compressi H.264, ulteriore riduzione richiederebbe re-encode = troppa CPU client).

**Verifica**:
- Typecheck: 0 errori.
- Test: **265/265 verdi** (invariato: niente test cambiati, sono feature UI/service).
- Build `next build`: OK.
- Nessuna rotta nuova, nessuna migration DB.

### Limitazioni documentate
- La notifica è **locale** (no push remoto) → se l'utente chiude completamente il browser, la notifica ovviamente non arriva (i Service Worker di Chrome persistono solo se il SW è registrato e il browser non è stato "killato"). Per push vero serve VAPID keys + tabella `push_subscriptions` + API dedicate (roadmap post-MVP).
- La compressione client usa Canvas (`compressImage` in `@fotosposi/media`) → su foto >20MB può richiedere 2-3s prima dell'upload. Se l'utente ha fretta può annullare (non implementato esplicitamente, ma il default behaviour è "show progress + cancella con X").

### File modificati in questa sotto-sessione
```
 apps/web/public/sw.js                          | +30 righe (showNotification in flushAll + notificationclick handler)
 apps/web/src/app/events/[id]/upload/page.tsx  | +25 righe (compressione >2MB + useEffect Notification.requestPermission)
 PROJECT_STATUS.md                              | +30 righe (questa sotto-sessione)
```

---

## Sessione 27/07/2026 (continua 6) — Upload resiliente (Service Worker + IndexedDB) + Drive naming convention

### Contesto
Commit `736a0a0` pushato. Testando l'utente su evento `13b5d266...` dopo i fix della sessione precedente, emersi 2 problemi extra:

1. **Upload non resilienti**: l'utente carica più foto, naviga su altre app → le foto restanti in coda NON vengono caricate (il fetch asincrono del browser si interrompe quando il tab perde visibilità o viene chiuso).
2. **Naming Drive non significativo**: i file finiscono su Drive con il nome originale del dispositivo (es. `DSC_0001.jpg`, `camera_1785185694.jpg`) → impossibile sapere CHI ha caricato cosa e QUANDO.

### Fix 5 — Upload resiliente con pattern Immich (Service Worker + IndexedDB + Background Sync)

**Architettura a 3 livelli (ispirata a Immich https://github.com/immich-app/immich):**

1. **`apps/web/public/sw.js` (NUOVA VERSIONE completa)**: Service Worker che gestisce IndexedDB queue + Background Sync API + periodicsync + online event.
   - Cache offline aggiornata (versione bumped a `spositive-v2`).
   - IndexedDB store `fotosposi-upload-queue.pending` con auto-increment ID.
   - Handler `sync` con tag `fotosposi-upload` → Chrome/Edge possono rischedulare l'upload anche con tab chiuso, fino a quando il sistema operativo non dà connettività.
   - Handler `periodicsync` → retry periodici anche con tab completamente chiuso (Chrome desktop).
   - Handler `online` → retry immediato al tornare online.
   - Handler `message` → API dal client: `queue-upload` (metti in coda blob+presigned URL), `flush-now` (ritenta adesso), `skip-waiting` (forza update SW).
2. **`apps/web/src/app/layout.tsx` (MODIFICATO)**: rimosso lo script che unregister-ava TUTTI i service worker (era il bug che impediva al SW di funzionare anche in passato, non solo per gli upload). Ora c'è lo script che REGISTRA `/sw.js` correttamente. Lo script è commentato per spiegare perché serve (iOS Safari non supporta Background Sync → fallback IndexedDB + retry lato client).
3. **`apps/web/src/lib/upload-queue.ts` (NUOVO modulo)**: helper client che esegue upload con:
   - 3 step: presign → PUT R2 (XHR per progress) → POST `/api/upload/init`.
   - Su errore di rete: push automatico al SW via postMessage per background retry (best-effort).
   - Hook `useUploadResilience()` per ascoltare online/offline/visibilitychange e triggerare `flush-now` automaticamente.
   - Progress callback per UI (0-100%).

**Limitazioni browser documentate nel codice**:
- Background Sync API funziona SOLO se il sito è installato come PWA (`beforeinstallprompt` + manifest valid). Su browser non-PWA fallback a IndexedDB + retry visibility.
- iOS Safari NON supporta Background Sync API (né periodicsync) → solo fallback IndexedDB + retry su `online`/visibility event dal client.
- Chrome Android supporta Background Sync SOLO se il sito è "installabile" (ha manifest + icone + display: standalone).

### Fix 6 — Drive file naming convention `AAAA_MM_GG_HH_MM_SS_NOME_COGNOME_<original>`

**Modifica in `apps/web/src/lib/process-queue.ts`**:
1. Query aggiuntiva: dopo aver letto gli `items` da `upload_queue`, prelevo i `core_users.first_name/last_name/email` degli `uploaded_by` distinti in un `uploaderMap` (la colonna `upload_queue.uploaded_by` non ha FK formale, quindi due query separate sono più affidabili di un join PostgREST).
2. Costruzione del nome Drive:
   ```
   const now = new Date();
   const pad = n => String(n).padStart(2, '0');
   const datePrefix = `${now.getFullYear()}_${pad(now.getMonth()+1)}_${pad(now.getDate())}_${pad(now.getHours())}_${pad(now.getMinutes())}_${pad(now.getSeconds())}`;
   const uploaderName = [first_name, last_name].filter(Boolean).join(' ').trim()
     .replace(/\s+/g, '_')              // spazi → underscore
     .replace(/[\/\\?%*:|"<>]/g, '');    // Drive non ammette questi caratteri
   const safeOriginal = (file_name || 'file').replace(/[\/\\?%*:|"<>]/g, '_');
   const driveName = `${datePrefix}_${uploaderName}_${safeOriginal}`;
   ```
3. Esempio output: `20260727_143015_Giuseppe_Vitrano_DSC_0001.jpg`
4. Fallback: se l'utente non ha nome+cognome compilati (es. guest anonimo), usa la parte locale dell'email (`agospe@blu.it` → `agospe`) o `Anonimo`.

### Stato finale sessione
- Typecheck: `npx tsc --noEmit -p apps/web/tsconfig.json` → 0 errori.
- Test: **252/252 verdi** (invariato: nessun test cambiato per questi fix, sono feature nuove a UI/service).
- Working tree NON ancora committato (in attesa commit finale sessione).

### TODO post-push
- [ ] Testare da telefono reale: installare la PWA dal browser (Chrome Android → "Aggiungi a Home"), caricare 3-5 foto, navigare su un'altra app o spegnere lo schermo per 30 secondi → verificare che tutte le foto arrivino comunque su R2 e in galleria. Monitorare la console del SW (`chrome://serviceworker-internals` per debug).
- [ ] Verificare Drive per l'evento test: dopo un nuovo upload, il file Drive deve chiamarsi `20260728_HHMMSS_NOME_COGNOME_<original>`. Per Agostino Sabrina che usa account `agospe@blu.it` senza first/last name, deve risultare `20260728_HHMMSS_agospe_<original>`.
- [ ] Applicare migration 00037 + 00038 (ancora pending, DNS blocca `db push`).

### TODO sessioni future
- [ ] **Auto-retry con backoff esponenziale** nello SW: ora il sync ritenta su `online` event, ma per connessioni instabili serve un backoff (1s → 2s → 5s → 10s).
- [ ] **Notifica push "upload completato"** quando il SW finisce la coda in background (utile per invitati che chiudono subito).
- [ ] **Compressione foto automatica lato client** (già presente in alcuni path, verificare copertura): per foto >2MB, riduci a 1920px lato lungo prima dell'upload → risparmio banda e storage R2.
- [ ] **Progress UI nativa iOS**: iOS Safari non supporta progress in `<progress>` se il file è via Service Worker. Workaround: stimare con ETA basato su dimensione/velocità media upload.

### File modificati in questa sessione
```
 apps/web/public/sw.js                                 | COMPLETA REWRITE (156 righe, da 52 → 208)
 apps/web/src/app/layout.tsx                           | 4 righe (rimozione unregister + script register SW)
 apps/web/src/lib/upload-queue.ts                      | NEW (160 righe, helper upload + hook resilience)
 apps/web/src/lib/process-queue.ts                     | +35 righe (uploaderMap query + drive naming logic)
 PROJECT_STATUS.md                                     | +80 righe (questa sezione)
```

---

## Sessione 27/07/2026 (continua 5) — Watermark NON applicato (root cause trovata) + Nome/Cognome separati + Video guestbook doppio upload

### Push eseguito
- Commit `736a0a0` della sessione precedente pushato — 248/248 test verdi.
- L'utente testa su evento `13b5d266-a020-41ed-b4ad-a14f894b0f4b` (Agostino Sabrina, Premium).
- Migration 00037 (unique constraint `event_id,r2_key`) NON ancora applicata dall'utente (DNS blocca supabase CLI su questa macchina; utente deve applicarla via Dashboard SQL Editor).

### Bug segnalati (test live dopo commit 736a0a0)
1. **Video Guestbook: stessa registrazione caricata 2 volte**
2. **Watermark NON applicato a NESSUN media** — né foto 100KB, né foto 5MB, né video 21MB, né video 240MB
3. **Nuova feature richiesta**: campo Nome + Cognome SEPARATI per i due sposi, termini neutri per matrimonio stesso-sesso
4. **Watermark**: usare SOLO i nomi (no data, no wordmark)

### Bug 1 (FIXED) — Watermark non applicato: root cause trovata
- **Sintomo**: nessun media ha il watermark applicato, neanche foto piccole (100KB, 5MB).
- **Root cause *(FINALE)***: `apps/web/src/lib/process-queue.ts:76-79` aveva un **catch silente**:
  ```ts
  } catch (err) {
    console.error('applyWatermark overlay fallito:', err);
    return buffer;  // ← ritornava l'originale senza watermark
  }
  ```
  Se `applyOverlay` falliva per qualsiasi motivo (sharp, font mancanti, librsvg, ecc.), il codice loggava l'errore ma restituiva il buffer ORIGINALE → veniva caricato su R2 senza watermark → galleria mostrava foto senza watermark, senza alcun errore visibile all'utente.
- **Verifica locale**: `applyOverlay` funziona perfettamente in dev locale (con sharp + 29 TTF + logo `public/logo-sposi-trans.png`), quindi il bug è ambientale (Vercel), MA soft-catch silente è comunque la root cause del "watermark sempre mancante": mai sapremo quale fase di ambiente falle senza log.
- **Fix applicato**:
  1. **`apps/web/src/lib/process-queue.ts` (applyWatermark)**: rimosso il catch silente. Ora se `applyOverlay` lancia errore, l'errore si propaga. Il caller conserva try/catch indipendente per NON perdere la foto (file salvato su R2 anche senza watermark), MA logga esplicito `[process-queue] watermark foto fallito per <file_name> (event=<eventId>): <err>`.
  2. **`packages/photo-overlay/src/index.ts` (applyOverlay)**: aggiunto try/catch granulare intorno a `composite + jpeg + toBuffer`. Se crash log diagnostico completo: `imgWidth, imgHeight, compositeOpsCount, fontFamily, wordmark, hasLogo, svgLength, svgStart` → capiremo subito quale fase di ambiente falla (sharp libvips, SVG malformato, encoder).
  3. **Log OK**: `console.log('[applyOverlay] OK: ...')` ad ogni render riuscito.
  4. **Sostituito `catch silent`** per `sharp.stats()` (luminanza fascia bassa) con `console.warn` non bloccante — prima era catless → caduta impercettibile su ambienti estratti.

### Bug 2 (FIXED) — Video Guestbook: stessa registrazione caricata 2 volte
- **Sintomo**: una registrazione → 2 upload separati su R2 + 2 righe in `video_messages`.
- **Causa**: l'utente poteva cliccare il bottone "Invia messaggio" del `VideoRecorder` 2 volte durante l'upload asincrono (`saveVideo` fa `setUploading(true)` MA il bottone restava cliccabile).
- **Fix applicato** in `apps/web/src/components/video-recorder.tsx`:
  1. Aggiunto prop `disabled?: boolean` al componente `VideoRecorder`.
  2. Bottone "Invia messaggio" → `disabled={disabled}` + label dinamica `"Invio in corso..."` quando `disabled=true`.
  3. Bottone "Riprova" → `disabled={disabled}` durante l'upload (no doppio trigger).
  4. Ref `sendingRef` come guard contro doppi-clic rapidi anche indipendentemente dalla prop `disabled`: se `sendingRef.current === true` → return. Reset dopo 10s come safety net per upload falliti silenziosamente.
- **Caller** `apps/web/src/app/events/[id]/guestbook/page.tsx`: passa `disabled={uploading}` a `<VideoRecorder>`.

### Feature (NEW) — Nome + Cognome separati per i due sposi, supporto matrimonio stesso-sesso
- **Richiesta utente**: termini neutri (sposo/sposo o sposa/sposa) oltre a sposo/sposa classico; campo nome e cognome SEPARATI per ogni partner.
- **Schema DB**:
  - **Migration `00038_grooms_first_last_name.sql` (NUOVA)**: 6 nuove colonne su `events`:
    - `groom1_first_name TEXT`, `groom1_last_name TEXT`, `groom1_role TEXT NOT NULL DEFAULT 'groom' CHECK (in ('groom','bride'))`
    - `groom2_first_name TEXT`, `groom2_last_name TEXT`, `groom2_role TEXT NOT NULL DEFAULT 'groom' CHECK (in ('groom','bride'))`
  - Backfill best-effort: splitta `couple_name` su ` ' & ' ` o ` ' e ' `, primi/secondi token come nome partner. Es. "Marco Rossi & Luca Bianchi" → `groom1_first_name='Marco', groom1_last_name='Rossi', groom2_first_name='Luca', groom2_last_name='Bianchi'`. Eventi con formato inconsistente (`Agostino Sabrina`, `Ciccio & Ciccia`) resteranno NULL finché l'utente non compila dal settings.
  - **DA APPLICARE via Dashboard SQL Editor** (DNS blocca supabase CLI anche per questa sessione).
- **Codice**:
  - `packages/events/src/index.ts`: nuovi campi + nuovo type `PartnerRole = 'groom' | 'bride'` esposto dal `WeddingEvent` interface.
  - `packages/events/src/service.ts`: funzione `updateEventNames(eventId, settings)` — persiste i 6 campi + ricalcola `couple_name` come display name auto-calcolato `"Nome Cognome & Nome Cognome"` (mantenuto per retrocompatibilità con tutti gli altri reader del monorepo che usano `couple_name`).
  - `packages/events/src/index.ts`: esporta `updateEventNames`.
  - `apps/web/src/app/events/[id]/settings/page.tsx`: NUOVA sezione "Dati degli sposi" in cima alla pagina con 2 card (Partner 1, Partner 2), ciascuna con:
    - 2 input testo (`Nome`, `Cognome`)
    - 2 radio (`Sposo`/`Sposa`)
    - Bottone "Salva dati sposi" con stato salvato
- **Test**:
  - `packages/events/src/__tests__/service.test.ts`: 3 nuovi test `updateEventNames` (coppia groom+groom calcola display_name, coppia bride+groom funziona, tutti null → return null).

### Feature (NEW) — Watermark SOLO nomi (no data, no wordmark)
- **Richiesta utente**: nel watermark delCodice NON includere più la data dell'evento né il wordmark (Sposi.live/JustMarry.live), SOLO i nomi dei due sposi separati da cuore ❤.
- **Composizione finale** (esempio sposi Marco Rossi + Luca Bianchi): `Marco Rossi ❤ Luca Bianchi`.
- **Codice**:
  - `apps/web/src/lib/process-queue.ts`: nuova logica `wmLine1/wmLine2`:
    1. **Priorità**: nomi separati `groom1_*` + `groom2_*` (campo Nome+Cognome dal settings 27/07) → se valorizzati: `wmLine1 = '{groom1} ❤ {groom2}'`.
    2. **Fallback 1**: se l'utente HA compilato `watermark_text` (custom) → usa quello.
    3. **Fallback 2**: se solo `couple_name` valorizzato (legacy) → usa `couple_name`.
    4. Se `watermark_names = false` → stringa vuota (niente testo, resta solo il logo brand).
    5. `wmLine2 = ''` sempre (no data — richiesta esplicita utente).
  - `packages/photo-overlay/src/index.ts`: aggiornato il costruttore SVG:
    - Sostituisce il `❤` (U+2764 unicode) della stringa con entità XML `&#10084;` wrappata in `<tspan fill="#d9534f">`.
    - Splitta `branding.coupleNames` sul `❤` e wrappa SOLO quello nel tspan rosso — il resto resta testo semplice (escape XML per nomi con `&`, `<`).
    - Rimossi i suffissi ` · wordmark` dal testo watermark (erano lì dalla sessione 25/07, ora rimossi).
    - JSDoc aggiornato.
- **Compatibilità**: il logo brand in alto a destra A COLORI (no mix-blend, no opacità forzata) resta sempre impresso su ogni foto, a prescindere dalla scelta dei nomi.
- **Test**:
  - `packages/photo-overlay/src/__tests__/index.test.ts`: aggiustato il vecchio test "cuore ❤ è XML-safe" (ora il caller passa già la stringa con ❤ inline) + NUOVO test "watermark SOLO nomi" verifica che ci sia UN solo cuore `&#10084;` (no data con altri cuori) + test contiene `Marco` AND `Luca`.

### Stato finale sessione
- Typecheck: `npx tsc --noEmit -p apps/web/tsconfig.json` → 0 errori.
- Test: **252/252 verdi** (era 248: +1 nuovo test photo-overlay "solo nomi", +3 nuovi test updateEventNames).
- Working tree NON ancora committato (in attesa domanda utente: pushare ora o dopo applicazione manuali migration SQL 00037+00038).

### ⚠️ AZIONE UTENTE RICHIESTA — Migration 00037 + 00038 via Dashboard SQL Editor
Vai su https://supabase.com/dashboard/project/krgqyluuiltckmhbeuue/sql/new e incolla in due query separate:

**Query 1** (fix galleria vuota, già richiesta sessione precedente):
```sql
ALTER TABLE media_uploads
  ADD CONSTRAINT uniq_media_event_r2key UNIQUE (event_id, r2_key);
```

**Query 2** (NUOVA — campi nomi sposi separati per settings + backfill best-effort):
```sql
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS groom1_first_name TEXT,
  ADD COLUMN IF NOT EXISTS groom1_last_name TEXT,
  ADD COLUMN IF NOT EXISTS groom1_role TEXT NOT NULL DEFAULT 'groom'
    CHECK (groom1_role IN ('groom', 'bride')),
  ADD COLUMN IF NOT EXISTS groom2_first_name TEXT,
  ADD COLUMN IF NOT EXISTS groom2_last_name TEXT,
  ADD COLUMN IF NOT EXISTS groom2_role TEXT NOT NULL DEFAULT 'groom'
    CHECK (groom2_role IN ('groom', 'bride'));
```
NB: il blocco `DO $$ ... $$` per il backfill automatico da `couple_name` è opzionale — se saltato, gli sposi compilano manualmente i campi dal settings (lo faranno una volta sola).

### Verifica query (post-migration):
```sql
SELECT conname FROM pg_constraint WHERE conrelid = 'media_uploads'::regclass AND contype = 'u';
-- deve mostrare: uniq_media_event_r2key

\d events
-- deve mostrare: groom1_first_name, groom1_last_name, groom1_role, groom2_first_name, groom2_last_name, groom2_role
```

### TODO post-push
- [ ] Verificare che i 15 record `failed` di `upload_queue` (evento `13b5d266...`) vengano processati dal prossimo cron sweep (alle 04:20 UTC di domani) dopo che l'utente applica la migration 00037. Oppure forzare con `POST /api/r2/process-queue?eventId=...`.
- [ ] Verificare che le foto ora appaiano nella galleria dell'evento Agostino Sabrina.
- [ ] Verificare che cliccando "Adoro" la reaction cambi (Bug 1 sessione precedente).
- [ ] Verificare il pulsante "Carica" in cima alla galleria (Bug 5 sessione precedente).
- [ ] Compilare dal settings i campi Nome/Cognome/Sposo-Sposa per entrambi i partner dell'evento Agostino Sabrina → verificare che `couple_name` si aggiorni a `"Agostino <cognome> ❤ Sabrina <cognome>"` (backfill non funziona su `couple_name='Agostino Sabrina'` perché lo split su ' & '/' e ' non matcha).
- [ ] Dopo aver compilato i nomi separati → verificare che il watermark sulle nuove foto contenga SOLO `Marco ❤ Sabrina` (no data, no wordmark). Per le foto già caricate: dovranno essere ri-processate forzando `POST /api/r2/process-queue` (viamente r2_key watermarkato vs originale: ogetto statico, non vanno persi).
- [ ] Verificare il video guestbook: fatto 1 upload video → deve comparire UN solo messaggio (no doppio).
- [ ] Verificare che NESSUN upload venga duplicato: dopo il cliccare "Invia messaggio" il bottone deve mostrare "Invio in corso..." (disabled).
- [ ] Leggere i log Vercel delle route `/api/r2/process-queue` e `/api/cron/maintenance` per vedere se il watermark ora funziona: se resta fallito vedremo `[process-queue] watermark foto fallito per <file>: <err>` + `[applyOverlay] render fallito: <err>` + contesto completo → capire la vera causa ambientale su Vercel.

### TODO sessioni future
- [ ] **Bug watermark residuo ambientale**: se le foto caricate dopo il push continuano a non avere watermark, l'azione succede perché l'ambiente Vercel non ha font TTF / libvips / ecc. I log granulari di questa sessione ci diranno esattamente quale fase faila (sharp.stats, sharp.composite, sharp.jpeg encoder, librsvg toxor SVG). Futura sessione: fixare la causa specifica, probabilmente rinforzando `outputFileTracingIncludes` oppure usando SVG testuale "rasterizzato" via `@font-face` inline (invece di fare affidamento su fontconfig).
- [ ] **Re-processare foto già caricate senza watermark**: dopo fix ambientale, marcare tutti gli `upload_queue.status='synced'` degli eventi con `watermark_names=true` come `status='failed'` e `retry_count=0` → il cron ri-processa e ri-applica il watermark alle foto esistenti su R2.
- [ ] **VPS sidecar per video >100MB** (Bug 2 sessione precedente, NON risolto da questa sessione): anche questa sessione non ha fixato il video 240MB — resta workaround già presente in `process-queue.ts:201-205` (catch overlay → comunque salvato su R2). Per watermark vero serve VPS sidecar.

### File modificati in questa sessione
```
 apps/web/src/app/events/[id]/events/[id]/settings/page.tsx   | +85 righe (sezione "Dati degli sposi")
 apps/web/src/app/events/[id]/guestbook/page.tsx            | +1 prop disabled su VideoRecorder
 apps/web/src/components/video-recorder.tsx                 | +20 righe (disabled, sendingRef, label dinamica)
 apps/web/src/lib/process-queue.ts                          | +25 righe (wmLine1/wmLine2 nuovi, try/catch watermark foto)
 apps/web/src/lib/watermark-fonts.server.ts                 | +2 log diagnostici
 packages/events/src/index.ts                               | +9 righe (PartnerRole + nuovi campi WeddingEvent + export updateEventNames)
 packages/events/src/service.ts                             | +40 righe (funzione updateEventNames)
 packages/events/src/__tests__/service.test.ts              | +35 righe (+3 test updateEventNames)
 packages/photo-overlay/src/index.ts                       | +20 righe (split ❤ , try/catch granulare, log OK)
 packages/photo-overlay/src/__tests__/index.test.ts         | +20 righe (+1 test "solo nomi")
 supabase/migrations/00038_grooms_first_last_name.sql       | NEW (60 righe,backfill DO $$)
 PROJECT_STATUS.md                                          | +80 righe (questa sezione)
```

---

## Sessione 27/07/2026 (continua 4) — 4 bug segnalati utente + 1 NUOVO BUG CRITICO scoperto durante la diagnosi

### Diagnosi eseguita (working tree aggiornato, NON ancora pushato — vedi "Strategia push" sotto)
Verificato `upload_queue` per evento `13b5d266-a020-41ed-b4ad-a14f894b0f4b` (Agostino Sabrina, Premium): **15 record 'failed' con errore `there is no unique or exclusion constraint matching the ON CONFLICT specification`** (foto + video). Tutto già `r2_key` valorizzato, nessuna perdita di file su R2 — il problema è solo che `createMediaRecord` non riesce a scrivere in `media_uploads`, quindi la galleria resta vuota. 51 media con r2_key già presenti in tutto il DB, 0 duplicati → constraint applicabile senza rischi.

### Bug 1 — Reazioni: emoji sbagliata su bottone like ✅ FIXATO (in working tree)
- **Sintomo**: cliccando "Adoro" (❤) o "Wow" (😮), il testo sotto cambia ma l'icona resta `<ThumbsUp>`.
- **Causa**: `apps/web/src/components/facebook-feed.tsx:299` — `<ThumbsUp size={18} />` statico.
- **Fix applicato**: `{reaction ? REACTION_EMOJI[reaction] : <ThumbsUp size={18} />}` — quando l'utente ha selezionato una reaction, mostra l'emoji corrispondente; altrimenti il ThumbsUp come fallback "Mi piace" non selezionato.
- File: `apps/web/src/components/facebook-feed.tsx:299`.

### Bug 2 — Video 240MB: errore, NON caricato in galleria ❌ NON RISOLTO (workaround già in place, fix vero richiede VPS sidecar)
- **Sintomo**: video 240MB → errore → NON in galleria. Foto con errore Drive sync invece appaiono.
- **Causa nota**: Vercel lambda maxDuration=300s su `/api/r2/process-queue` → ffmpeg per ri-codificare il video watermarked → timeout → la funzione crasha PRIMA di arrivare a `createMediaRecord`.
- **Workaround GIÀ PRESENTE in `apps/web/src/lib/process-queue.ts:201-205`** (aggiunto sessione 25/07):
  ```ts
  } catch (overlayErr) {
    // Se ffmpeg fallisce (video corrotto, codec esotico) pubblichiamo comunque
    // il video originale: meglio senza watermark che perso.
    console.error('Video overlay fallito:', overlayErr);
  }
  ```
  Il try/catch copre già `applyVideoOverlay`, ma il timeout della lambda uccide la funzione **prima** che il catch possa scattare → il workaround esiste nel codice ma non viene raggiunto quando il timeout colpisce.
- **Fix vero richiesto**: VPS sidecar `packages/video-overlay/src/remote.ts` + `vps-scripts/video-watermark-server.js` (già implementati sessione 27/07, NON deployati). Richiede setup utente: VPS Railway/Raspberry + env `VPS_FFMPEG_URL` + `VPS_FFMPEG_API_KEY` su Vercel. Documentato in PROJECT_STATUS sessione 27/07 (continua 2).
- **Stato**: ❌ Workaround codice OK ma timeout lambda lo aggira. Per video >100MB serve VPS sidecar.

### Bug 3 — Drive: cartelle sempre vuote ❌ IMPOSSIBILE VERIFICARE (bloccato dal Bug 4)
- **Sintomo**: 4 cartelle Drive create con folder_id nel DB MA zero file dentro.
- **Causa nota (commit 91dd233)**: multipart upload a Drive API falliva con "Metadata p... not valid JSON" → fixato costruendo `multipart/related` con boundary esplicito invece di `new FormData()`.
- **Verifica post-deploy**: impossibile — il processing dei file non arriva MAI alla fase Drive perché `createMediaRecord` fallisce PRIMA (vedi Bug 4). Le cartelle sono state create da una sessione precedente, i file non ci sono perché il processing muore sempre prima. Una volta fixato Bug 4, il prossimo sweep del cron processerà i 15 item `failed` e popolerà le cartelle Drive.

### Bug 4 (NUOVO CRITICO) — Manca unique constraint su media_uploads → galleria vuota ✅ FIXATO (in working tree, MA SERVONO ENTRAMBI: codice + migration)
- **Sintomo**: tutti i file caricati restano su R2 e `upload_queue` ha `status='failed'` con errore specifico → galleria completamente vuota per quell'evento.
- **Root cause**: la migration `00022_r2_key_media.sql` aggiunge solo colonna + indice NON-unique, ma NON crea il constraint `uniq_media_event_r2key UNIQUE (event_id, r2_key)`. Il codice `packages/media/src/service.ts:33` usa `onConflict: 'event_id,r2_key'` che richiede un unique constraint su quelle colonne → PostgREST risponde 400 "there is no unique or exclusion constraint matching the ON CONFLICT specification" → il record NON viene mai scritto → `media_uploads` resta vuoto per l'evento.
- **Fix doppio (codice + migration)**:
  1. **`supabase/migrations/00037_media_uploads_unique_event_r2key.sql` (NUOVA)**: `ALTER TABLE media_uploads ADD CONSTRAINT uniq_media_event_r2key UNIQUE (event_id, r2_key);` — da applicare via Dashboard SQL Editor di Supabase.
  2. **`packages/media/src/service.ts:30-50` (MODIFICATO)**: aggiunto fallback robusto. Se l'upsert fallisce con errore ON CONFLICT (cioè constraint non ancora applicato), ripiega su INSERT semplice: meglio un duplicato occasionale su retry che TUTTE le foto di un evento perse. Log `console.error` esplicito segnala che la migration 00037 va applicata.
  3. **`packages/media/src/__tests__/service.test.ts` (MODIFICATO)**: aggiunto mock `upsert` nella `buildChain` + nuovo test "ripiega su INSERT semplice se manca il unique constraint per onConflict (drift DB)" — totale 248/248 test verdi (+1).

### Bug 5 — Manca pulsante "Carica" in cima alla galleria ✅ FIXATO (in working tree)
- **Sintomo**: il pulsante "Carica" esisteva solo nella sidebar sinistra.
- **Fix**: aggiunto `<Button variant="default" size="sm" asChild><Link href={`/events/${eventId}/upload`}>{c('upload')}</Link></Button>` nel `CardHeader` della galleria (`apps/web/src/app/events/[id]/page.tsx:138-144`), con `flex flex-row items-center justify-between gap-2 flex-wrap` per restare allineato a destra del titolo "Galleria (N)" e andare a capo su mobile.

### Stato
- Tutti i bug fix sono nel working tree locale (NON ancora committati né pushati).
- Typecheck: `npx tsc --noEmit -p apps/web/tsconfig.json` → 0 errori.
- Test: **248/248 verdi** (era 247: +1 nuovo test fallback ON CONFLICT).

### ⚠️ AZIONE UTENTE RICHIESTA — Migration 00037 via Dashboard SQL (DNS blocca `supabase db push`)
Il sandbox CLI di questa sessione non riesce a risolvere `db.krgqyluuiltckmhbeuue.supabase.co` (DNS bloccato dalla rete locale → `hostname resolving error`). Per applicare il constraint unico senza il quale il fallback INSERT può creare duplicati su retry:
1. Vai su https://supabase.com/dashboard/project/krgqyluuiltckmhbeuue/sql/new
2. Incolla:
   ```sql
   ALTER TABLE media_uploads
     ADD CONSTRAINT uniq_media_event_r2key UNIQUE (event_id, r2_key);
   ```
3. Click "Run".
4. Verifica con:
   ```sql
   SELECT conname FROM pg_constraint WHERE conrelid = 'media_uploads'::regclass AND contype = 'u';
   ```
   deve mostrare `uniq_media_event_r2key`.
5. (Opzionale, ma consigliato dopo) Vai su https://supabase.com/dashboard/project/krgqyluuiltckmhbeuue/database/migrations e clicca "Apply" per la migration `00037_media_uploads_unique_event_r2key.sql` — così il prossimo `db push` non darà più errore di drift.

### Strategia push proposta (in attesa di conferma utente)
- **Opzione A (rapida)**: committa + pusha ORA solo Bug 1 (emoji) + Bug 5 (pulsante Carica) + Bug 4 fallback codice → l'utente può applicare la migration 00037 quando vuole. Le foto dell'evento Agostino Sabrina appariranno in galleria SUBITO grazie al fallback INSERT (anche senza constraint, con rischio duplicati su retry futuri).
- **Opzione B (più pulita)**: utente applica la migration 00037 via Dashboard PRIMA del push → commit unico atomico con tutti i fix + constraint già applicato, zero duplicati.
- **Opzione C (mista)**: pushare il fix fallback (così la galleria si sblocca SUBITO) e subito dopo applicare la migration via Dashboard → fallback non si attiva più, sistema in stato "pulito".

### TODO post-push
- [ ] Verificare che la galleria dell'evento `13b5d266-a020-41ed-b4ad-a14f894b0f4b` ora mostri le ~13 foto + 2 video che erano su R2 (dopo sweep del cron alle prossime 4h OPPURE forzando `POST /api/r2/process-queue?eventId=...` con i 15 record failed)
- [ ] Verificare che il pulsante "Carica" sia visibile in cima alla galleria sia su desktop che mobile
- [ ] Verificare che cliccando "Adoro" l'emoji diventi ❤ invece del ThumbsUp
- [ ] (Opzionale) Verificare che il video 240MB continui a non apparire finché il VPS sidecar non è deployato — comportamento atteso

## Sessione 27/07/2026 (continua 3) — Fix Drive OAuth pushati + 2 bug critici emersi dal test live

### Push eseguito atomicamente
- Commit `715a673` "fix(drive): OAuth callback, brand param, case-sensitivity, auto-refresh token" pushato su `origin/master`. Deploy Vercel in automatico.
- 247/247 test verdi (era 236: +5 ensureDriveFolders brand, +7 refreshDriveTokenIfExpired).

### Fix contenuti nel push
1. **`apps/web/src/app/api/auth/google/callback/route.ts`**
   - Rimossa riga `update({drive_folder_id})` su `event_drive_tokens` (colonna inesistente → crash silenzioso)
   - Aggiunto `encodeURIComponent` su redirect URL con error
   - `ensureDriveFolders(tokens.access_token, 'Sposi.live')` ora passa il brand esplicito
2. **`packages/media/src/tokens.ts`**: `ensureDriveFolders(accessToken, brand)` con parametro brand opzionale (default `'Sposi.live'`), necessario per JustMarry.live per creare la root folder corretta
3. **`apps/web/src/lib/process-queue.ts`**:
   - `folders['Foto']`/`folders['Video']` → `folders['foto']`/`folders['video']` (lowercase, come da `ensureDriveFolders`)
   - Bug critico: in caso di errore Drive sync marcava `status: 'synced'` invece di `'failed'`. Fix.
   - `refreshDriveTokenIfExpired` **estratto da closure a funzione top-level esportata** con dependency injection (`supabase client` come parametro) per testabilità. Importa `EventDriveToken` da `@fotosposi/media`.
4. **`packages/time-capsule/src/service.ts`**: stesso bug case-sensitivity `folders['Foto']` → `folders['foto']`.

### 🐛 BUG #1 — `redirect_uri_mismatch 400` su Google OAuth (segnalato dall'utente 27/07)
- **Sintomo**: tentativo di connessione Drive restituisce "Accesso bloccato: la richiesta dell'app non è valida. Errore 400: redirect_uri_mismatch".
- **Root cause**: l'URI `https://www.sposi.live/api/auth/google/callback` NON è registrato nella lista "Authorized redirect URIs" del OAuth 2.0 Client ID (Google Cloud Console → APIs & Services → Credentials). Codice corretto: il redirect_uri in `apps/web/src/app/api/auth/google/route.ts:13` e `callback/route.ts:18` è già dinamico da `host` della request.
- **Stato azione richiesta**: ⚠️ **UTENTE DEVE AGGIUNGERE MANUALMENTE** in Google Cloud Console le URI redirect nella lista bianca dell'OAuth client (per ogni dominio):
  ```
  https://www.sposi.live/api/auth/google/callback
  https://sposi.live/api/auth/google/callback
  https://justmarry.live/api/auth/google/callback
  https://www.justmarry.live/api/auth/google/callback
  http://localhost:3000/api/auth/google/callback
  ```
- **Non automatizzabile**: richiede accesso al Google Cloud Console dell'utente.

### 🐛 BUG #2 — Watermark NON applicato a foto/video caricati dopo la registrazione QR (segnalato dall'utente 27/07)
- **Sintomo**: dopo che gli invitati hanno scansionato il QR, si sono registrati e hanno caricato foto + un video del guestbook, **i file NON mostrano il watermark** previsto (testo personalizzato "GIADA E GINO Sposi PALERMO 28/08/2026" + logo Sposi.live).
- **Verifica DB sull'evento `d8053fdd-5301-4d00-8565-e82f74d74e04` (GIADA E GINO)**:
  - `events.watermark_names = true`, `watermark_text = 'GIADA E GINO Sposi PALERMO 28/08/2026'`, `watermark_font = 'baby_time'` → configurazione corretta lato DB
  - `upload_queue`: tutti i 17 item 'synced' hanno `retry_count = 0`, `error = NULL`, `has_processed_at = TRUE` → **la pipeline NON è crashata**
  - `updateDriveSyncStatus` è chiamato ma tutti i `drive_sync_status = 'pending'` perché `event_drive_tokens` per quell'evento è vuoto (Drive non era connesso per quell'evento, normale)
  - `media_uploads` popolata con righe, r2_key assegnati
- **Quindi**: il watermark dovrebbe essere stato applicato in `process-queue.ts:208` (`applyWatermark(buffer, wmLine1, wmLine2, event?.brand, wmFont, brandLogo)`) prima del re-upload. Il flusso non ha errori, ma il file visibile sembra non avere watermark.
- **Possibili cause root da investigare** (questa sessione NON le ha fixate — sono state solo identificate):
  1. **Bucket R2 con caching/edge**: il client potrebbe star leggendo il file vecchio (pre-watermark) invece di quello ricaricato. Verificare se il bucket ha TTL cache aggressivo o se la presigned URL è cacheable.
  2. **Race condition nel client gallery**: la `EventTimelineFeed` potrebbe star leggendo il file da `/api/media/[id]/download` che ha cache headers sbagliati.
  3. **`applyWatermark` silent fail**: la funzione ha un `catch { return buffer }` (process-queue.ts:88) che restituisce il buffer ORIGINALE se sharp fallisce → se nel nuovo deploy Vercel qualche libreria (sharp.node binding all'immagine di fresh deploy) sta fallendo, viene restituita l'immagine non watermarked senza nessun errore loggato.
  4. **Bug introdotto dal commit 715a673 stesso**: il refresh del token Drive è nuovo, ma non dovrebbe impattare direttamente il path watermark (che è separato). Da escludere con test isolato.
- **Piano di diagnosi prossime sessioni**:
  1. **Lato client scaricare il file R2 raw** di un media "synced" e vedere se contiene watermark
  2. Aggiungere log dentro `applyWatermark` per catturare eccezioni sharp (attualmente swallow)
  3. Re-processare forzando uno sweep `processQueueForEvent` dopo aver marcato come 'failed' tutti gli item 'synced' recenti di quell'evento → questo è un workaround rapido testabile
  4. Verificare se il problema si presenta anche per VIDEO oltre alle FOTO (l'utente ha detto "foto e un video del guestbook")
  5. Verificare se il deploy Vercel è davvero avvenuto con il commit `715a673` (controllare build log)
- **Stato**: ❌ NON risolto. Workaround richiesto all'utente per le foto pubblicate finora — riapplicare watermark manualmente o ri-processare la coda.

### File modificati nel push 715a673
```
 apps/web/src/app/api/auth/google/callback/route.ts |  8 ++--
 apps/web/src/lib/process-queue.ts                  | 48 ++++++++++++++++++---
 apps/web/src/lib/__tests__/refresh-drive-token.test.ts (NEW, 7 test)
 packages/media/src/__tests__/tokens.test.ts        | 50 ++++++++++++++++++++++
 packages/media/src/tokens.ts                       |  6 ++-
 packages/time-capsule/src/service.ts               |  3 +-
 6 files changed, 224 insertions(+), 12 deletions(-)
```

### Todo per la prossima sessione
- [ ] **CRITICO**: configurare Authorized redirect URIs in Google Cloud Console per i 4+domini (fix bug #1)
- [ ] **CRITICO**: diagnosticare e fixare watermark mancante su foto/video (fix bug #2)
- [ ] Dopo i due fix: riapplicare watermark alle foto già pubblicate che ne sono prive (re-process coda forzato)
- [ ] Stress test role-aware (`stress-test-agenti/agent.js`) — script già pronto, mancava solo `.env` con `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Newsletter signup form nella home (Rete Partner/GTM lead magnet)
- [ ] SEO/GEO struttura contenuti per citazioni AI

---

## Sessione 27/07/2026 — Video watermark su VPS sidecar (no più lambda ffmpeg-static)

### Architettura ibrida per video grandi (>100MB, >90s, ceremony/ricevimento interi)
- **Problema limite**: Vercel lambda ha ffmpeg-static ~70MB nel bundle + `maxDuration = 60s`. Video lunghi di matrimonio (cerimonia intera) non erano elaborabili — prima ricadeva su fallback "ritorna video senza watermark". PROJECT_STATUS 19/07 aveva segnalato "per wedding con molti video guestbook il primo render ffmpeg può sforare".
- **Soluzione scelta (utente)**: riusare il VPS che ha già per wa-automate-nodejs, stesso modello del provider WhatsApp (API key + HTTP POST). Comune zero costo (free tier Railway/fly.io o Raspberry casalinga).
- **Commit**: `3bd3b70` (236/236 test pass, +11 nuovi).

### HTTP sidecar
- `vps-scripts/video-watermark-server.js` — server Node 18+ che scarica video da R2 via presigned GET, applica ffmpeg di sistema per compositare il watermark PNG, uploada via presigned PUT. Endpoint `/health`. Auth `X-API-Key` con `crypto.timingSafeEqual`.
- `vps-scripts/overlay.js` — modulo CJS standalone (SVG→PNG via sharp, ffmpeg composita). Niente ffmpeg-static bundle, niente build TS. Da tenere allineato a `packages/video-overlay/src/index.ts` manualmente (vedi nota nel README).
- `vps-scripts/README.md` — setup (`apt install ffmpeg` + `npm i sharp`), Cloudflare Tunnel per HTTPS senza aprire porte, security model.

### Lambda adapter
- `packages/video-overlay/src/remote.ts` — nuovo file, `applyVideoOverlayRemote()` POSTa il job al VPS con due presigned URL R2. Lambda non vede mai i byte del video (bypass 70MB bundle + timeout 60s + maxDuration). Timeout interno 55s.
- `packages/video-overlay/src/index.ts` — `brandingToRemote()` mapper VideoOverlayBranding→RemoteBranding (logoPng Buffer → logoBase64).
- `apps/web/src/app/api/photos/[id]/share/route.ts` — smart routing video: se `VPS_FFMPEG_URL` + `VPS_FFMPEG_API_KEY` configurate e media ha `r2_key`, usa remoto. Altrimenti fallback `applyVideoOverlay` locale. Errori dal VPS → warn + fallback.

### Env vars richieste sul Vercel
- `VPS_FFMPEG_URL` — es. `https://watermark.vps.example.com` (HTTPS obbligo, certificato via Cloudflare Tunnel o nginx + certbot)
- `VPS_FFMPEG_API_KEY` — generata con `openssl rand -hex 32` sul VPS stesso
- Da impostare in Vercel → Environment Variables. Niente secrets lato sorgente.

### TODO utente (configurazione manuale, non automatizzabile)
1. **VPS**: stesso Raspberry/VPS dove gira wa-automate, installare:
   ```bash
   mkdir -p ~/fotosposi-vps && cd ~/fotosposi-vps
   npm init -y && npm install sharp
   # Copia vps-scripts/{video-watermark-server.js,overlay.js}
   API_KEY="$(openssl rand -hex 32)" PORT=8081 \
     nohup node video-watermark-server.js > ~/watermark.log 2>&1 &
   ```
2. **HTTPS**: Cloudflare Tunnel `cloudflared tunnel route tcp://localhost:8081 --hostname watermark.vps.example.com`
3. **Vercel env**: `VPS_FFMPEG_URL=https://watermark.vps.example.com` + `VPS_FFMPEG_API_KEY=<quello generato>`
4. **Test**: condividere un video da `/api/photos/[id]/share?format=square&eventId=...` e verificare che il watermark appaia anche su clip 200MB+.

### Test
- 11 nuovi in `packages/video-overlay/src/remote.test.ts`: `brandingToRemote` mapping, `isVpsWatermarkConfigured` env check, `applyVideoOverlayRemote` con fetch mockato (POST URL, headers, ok/error body, trailing slash).
- Totale monorepo: **236/236 test** (era 225).

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

## Sessione oggi — WATERMARK_FONTS lista reale (fontconfig) + 29 TTF → public/fonts/

### Verifica situation pre-fix
- `next.config.ts` `outputFileTracingIncludes` GIA' copriva `assets/fonts/**` per tutte le 4 route (share, process-queue, maintenance, guestbook) — il punto "Da fare" del PROJECT_STATUS chiuso retroattivamente.
- `apps/web/assets/fonts/` contiene 29 TTF, di cui **28 family uniche** (le 2 variazioni Bold di Dancing Script e Playfair Display condividono family con le versioni Regular).
- Bug fondo: `WATERMARK_FONTS` (lista 27 Google Fonts vecchi) -> nomi family della lista (es. "Tangerine", "Satisfy", "Mr Dafoe"...) non corrispondevano ai 29 TTF reali installati. Risultato: quando uno sposo sceglieva "Satisfy" o "Cormorant", fontconfig cadeva su fallback Noto Sans (il "tofu") perche il TTF non c'era.
- Solo 4 font sui 27 avevano match reale: Allura, Dancing Script, Great Vibes, Pinyon Script.

### Script diagnostico (temporaneo)
- `scripts/list-ttf-families.mjs` + `fontkit --no-save` — legge la tabella `name` (nameID 1) TrueType di ogni TTF ed estrae il family name interno che fontconfig vede. Risultati:
  - 29 TTF, 28 family uniche
  - 28 family matched: Agetya Butterfly Demo, Agetya Butterfly Italic, Allura, Angelos-Personal use, Awesome, Babytime, Bakery  Wedding, Blackout Oldskull, Bobbers Personal Use, Brittany Signature Script, Dancing Script, Dearllane, Eagle Horizon-Personal use, Gista Danes, Great Vibes, Himalayan, Hugh is Life Personal Use, Italianno, Kingline, Lucida Calligraphy, Lucy Said Ok Personal Use, My Sunshine, Noto Sans, Ocean Delight, Ocean Trace-Personal use, Pinyon Script, Playfair Display

### Fix WATERMARK_FONTS
- `apps/web/src/lib/watermark-fonts.ts` completamente riscritto:
  - Nuova interface `WatermarkFont` con campi: `value`, `label`, `family`, `category`, `googleImport?`, `ttfFile?`
  - 28 voci totali (19 eleganti + 9 classici) distribuiti sui 29 TTF reali
  - `watermarkFontFamily()` da `switch` a `.find()` piu' mantenibile (ridotto a 1 riga di logica)
  - 6 font su Google Fonts (Playfair, Dancing, Allura, Great Vibes, Pinyon, Italianno, Noto Sans) — gli altri 22 SOLO TTF locali
- Default invariato: `'classico'` → `Playfair Display`
- Copiati anche tutti i 29 TTF da `assets/fonts/` a `apps/web/public/fonts/` (2.71 MB totali) per consentire l'anteprima browser della scelta font anche per i 22 non-Google

### Fix settings/page.tsx
- `apps/web/src/app/events/[id]/settings/page.tsx` aggiornato:
  - Genera link Google Fonts CSS2 solo per i 7 font con `googleImport` (prima rompeva query string con `family=undefined` per i 22 nuovi font locali)
  - Aggiunge `<style>` inline con 22 `@font-face` rules per i font locali (url `/fonts/<file>.ttf` con URL-encoded spazi)
  - Sostituito `WATERMARK_FONTS[12]!` (hardcoded "Playfair") con `.find(f.value === 'classico') ?? classicoEntry ?? WATERMARK_FONTS[0]!`
  - Commenti aggiornati 27 → 28

### Test
- Typecheck pulito: `npx tsc --noEmit -p apps/web/tsconfig.json` 0 errori
- 225/225 test verdi
- Dev server smoke test: homepage 200, /events/[id]/settings 200, file referenziato nei chunk
- (work-tree ancora da pushare)

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
