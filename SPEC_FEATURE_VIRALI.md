# SPEC — Feature Virali WeddingMoments/FotoSposi (Fase Costo-Zero)

> Contesto per l'agente: monorepo Turborepo esistente, Next.js 15 + TypeScript + Tailwind v4 + shadcn/ui, Supabase (Postgres 17, RLS, Auth, Storage), hosting Vercel. Tutte le feature qui sotto DEVONO usare solo librerie gratuite/self-hosted (no chiamate a pagamento) finché non indicato "Fase 2 — richiede budget API". Riusare tabelle/edge function esistenti (foto upload, giochi, QR auth) invece di crearne di nuove dove possibile.

---

## PRIORITÀ 1 — Frame/Overlay Brandizzato Automatico

**Problema che risolve**: ogni foto scaricata da un invitato deve portare il brand fuori dalla piattaforma quando viene postata su Instagram/TikTok/WhatsApp Status.

**Costo**: zero — nessuna chiamata AI, solo image processing locale.

### Struttura tecnica
- **Package**: nuovo package interno `packages/photo-overlay` (o funzione dentro package esistente di gestione foto)
- **Libreria**: `sharp` (Node, gratuita, già performante su Vercel serverless entro i limiti di memoria)
- **Trigger**: al momento del download/condivisione di una foto da parte dell'invitato (bottone "Scarica"/"Condividi"), non al momento dell'upload — per non appesantire l'ingest e per poter cambiare il frame senza rigenerare tutto lo storico
- **Input**: foto originale (da Storage/Drive) + dati evento (nomi sposi, data, eventualmente logo/colore tema scelto dagli sposi in fase editor sito)
- **Output**: immagine con overlay in basso (banda semi-trasparente o angolo): "Nome & Nome — DD.MM.YYYY" + wordmark piccolo "weddingmoments.app" o "fotosposi.it"
- **Varianti**: generare overlay coerente con il tema/colore scelto dagli sposi nell'editor sito (riuso dati dei 6 template esistenti)
- **Formato output**: sia quadrato/orizzontale (per download foto singola) sia verticale 9:16 con padding (pronto per Stories) — due funzioni di export

### Task per OpenCode
1. Creare funzione `applyEventOverlay(imageBuffer, eventBranding)` con sharp: composite di banda testo + logo
2. Endpoint/edge function `GET /api/photos/[id]/share?format=square|story` che genera l'immagine on-the-fly (con cache su Storage per non rigenerare ad ogni richiesta)
3. Bottone UI "Scarica per Instagram/TikTok" nella galleria invitato, che chiama l'endpoint format=story
4. Tabella `event_branding` (o estensione tabella evento esistente): colore, font, posizione logo — editabile dagli sposi in fase setup sito

### Metriche da tracciare (per validare viralità)
- Contatore `share_downloads` per evento (già avete log notifiche, riusare pattern simile)

---

## PRIORITÀ 2 — Wedding Wrapped (Recap Personale Condivisibile)

**Problema che risolve**: dare a ogni invitato un contenuto che parla di *lui*, non degli sposi — meccanica Spotify Wrapped, altissimo tasso di condivisione spontanea.

**Costo**: zero in Fase 1 (solo dati già raccolti + template grafico), Fase 2 opzionale con AI per copy personalizzato.

### Struttura tecnica
- **Dati necessari** (già esistenti nel sistema, solo da aggregare per invitato):
  - N. foto caricate
  - Posizione in leaderboard / punteggio Quiz sugli Sposi
  - N. volte taggato (face recognition)
  - Partecipazione a giochi (quali)
  - Orario primo upload / ultimo upload (per badge tipo "primo a caricare" o "ultimo rimasto in pista")
- **Generazione grafica**: template React renderizzato server-side → immagine (usare `@vercel/og` o `satori`, entrambe gratuite e già ottimizzate per Vercel Edge, generano PNG da JSX)
- **Formato**: card verticale 1080x1920, stile "Wrapped" (sfondo colore tema evento, numeri grandi, 1 card riassuntiva scrollabile o 4-5 card in sequenza tipo Stories)
- **Trigger**: generata automaticamente 2h dopo la fine evento (o a chiusura finestra upload 18gg+2gg) via cron/edge function schedulata già presente nel sistema notifiche
- **Distribuzione**: link diretto WhatsApp/email ("La tua sintesi della serata è pronta") con bottone condividi nativo

### Task per OpenCode
1. Query di aggregazione dati per invitato (join foto + giochi + tag), riusare RLS esistente
2. Componente template card con `@vercel/og`/`satori`, coerente col tema evento (stesso branding di Priorità 1)
3. Job schedulato (edge function/cron Supabase) che genera e salva le card a fine finestra evento
4. Pagina pubblica `/e/[eventSlug]/wrapped/[guestId]` con bottone condividi + export diretto formato Stories

### Fase 2 (quando c'è budget)
- Copy personalizzato via Claude API ("soprannome della serata", frase buffa basata sui dati) al posto di testo fisso

---

## PRIORITÀ 3 — Live Curation Screen (Wall Intelligente)

**Problema che risolve**: il wall attuale è passivo (auto-scroll fisso); una selezione "curata" spinge gli invitati a scattare di più per "essere scelti", aumenta l'engagement in tempo reale.

**Costo**: **Fase 2 — richiede budget API** (Claude Vision per scoring). In Fase 1 costo-zero si può fare una versione euristica senza AI.

### Struttura tecnica — Fase 1 (zero costo, euristica)
- Invece di scoring AI, punteggio calcolato con regole semplici lato server:
  - Boost a foto con più like/voti già ricevuti nel gioco votazione esistente
  - Boost a foto caricate da invitati che non sono ancora apparsi sul wall (rotazione equa)
  - Penalità a foto quasi duplicate (hash percettivo semplice, es. libreria `sharp` + confronto istogramma, gratuita)
- Wall esistente (refresh 10s) modificato per pescare dalla coda pesata invece che ordine cronologico

### Struttura tecnica — Fase 2 (con budget Claude API)
- Claude Vision valuta ogni foto in ingresso: qualità/nitidezza, presenza volti sorridenti, momento "decisivo" vs foto mossa/doppia — riusa la funzione "AI Curation" già in backlog (punto 9 del documento idee) così le due feature condividono lo stesso scoring
- Score salvato come colonna sulla foto già in fase di upload (non a runtime del wall) per non appesantire i costi

### Task per OpenCode (solo Fase 1 per ora)
1. Aggiungere colonna `wall_priority_score` alla tabella foto esistente
2. Job leggero che ricalcola lo score ad ogni nuovo voto/upload (trigger Postgres o edge function)
3. Modificare query del wall per ordinare per score invece che per data, mantenendo rotazione (no stesso invitato 2 volte di fila)

---

## Ordine di implementazione consigliato per OpenCode

1. Priorità 1 (Frame Overlay) — 3-4 giorni, nessuna dipendenza da altre feature, massimo impatto virale immediato
2. Priorità 2 (Wedding Wrapped) — 5-7 giorni, dipende dal branding creato in Priorità 1 (stesso tema visivo)
3. Priorità 3 Fase 1 (Wall euristico) — 2-3 giorni, indipendente, può girare in parallelo

**Nota costi**: nessuna di queste tre richiede API a pagamento in Fase 1. Quando i primi incassi lo permetteranno, la Fase 2 (Claude Vision su curation + copy personalizzato su Wrapped) si attiva senza refactoring, perché lo score/testo generato va a sostituire logica già isolata in funzioni dedicate.
