# PROMPT PER AI — Sposi.live / JustMarry.live

Copia e incolla questo testo in ChatGPT, Claude, Gemini o qualsiasi AI:

---

Sei un product strategist esperto in SaaS, wedding tech, e-commerce e growth hacking. Analizza questa piattaforma e proponi idee innovative, strategiche e implementabili.

## PIATTAFORMA

**Sposi.live** (Italia) / **JustMarry.live** (internazionale) è un SaaS per la gestione digitale di matrimoni.

### Stack
- Frontend: Next.js 15 + TypeScript + Tailwind v4 + shadcn/ui
- Backend/Database: Supabase (Postgres 17, RLS, Auth, Storage)
- Hosting: Vercel
- Pagamenti: Stripe + Stripe Connect (da attivare)
- Print-on-demand: Gelato API (da attivare)
- Email: Resend (da attivare)
- WhatsApp: Evolution API self-hosted (da attivare)
- AI: Claude API (da attivare)
- Storage definitivo: Google Drive API (OAuth funzionante)
- Monorepo: Turborepo, 13 packages
- Test: Vitest, 74 test

### Funzionalità attuali (tutte funzionanti)

**Per gli sposi:**
- Sito invito digitale con editor (12 sezioni toggle: Cerimonia, Ricevimento, Storia, Galleria, Lista nozze, RSVP, Dress code, Menu+Allergeni, Hotel, Playlist, Hashtag, Countdown), 6 template, download ICS, frasi suggerite
- Galleria foto live con upload da telefono, finestra 18gg+2gg, sposi illimitati
- Giochi interattivi: votazione foto con griglia, leaderboard live (5s refresh, barre animate), wall display (10s refresh, 8s auto-scroll, dark mode), barzellette con reveal schedulato
- Video guestbook (registrazione 30s + griglia messaggi)
- Angolo scherzi (upload foto/video, countdown reveal)
- Lista nozze digitale (importi, messaggio, checkout Stripe)
- Shop foto (griglia prodotti con filtro categoria, dettaglio, acquisto Stripe)
- Backup automatico su Google Drive personale (via OAuth)
- Concierge AI (struttura chat, backend Claude pronto)
- QR code per accesso pubblico (valido fino al giorno dopo evento)
- RSVP multi-canale (email, telefono, WhatsApp)
- Link Google Maps per Cerimonia e Ricevimento

**Per invitati:**
- Accesso via QR code
- Upload foto, partecipazione giochi, RSVP, guestbook
- Pagina pubblica sito-evento server-side

**Per il team (B2B):**
- Admin panel multi-evento con ruolo manager
- Analytics B2B (statistiche, report)
- Marketplace fornitori con recensioni (manca UI approvazione admin)
- Face recognition con consenso GDPR (tagging)
- Notifiche con log (preferenze canale)

### Edge functions (deployate)
- auth: validazione QR token server-side

### Backlog Fase 6 (idee già raccolte)
1. Addio al Celibato/Nubilato — testimoni creano/selezionano missioni per sposi, gadget shop collegati, completamento via WhatsApp
2. Caccia alla Foto in Chiesa — ospiti si registrano con ruolo (amico/parente/collega/altro), amici ricevono compiti fotografici (foto con zia, padre sposa, single, pelato, ecc.), classifica punti
3. Quiz sugli Sposi — domande tipo "chi ha detto ti amo per primo?", "quanti anni ha la sposa?" — punti e podio
4. Vota il Vestito — durante ricevimento, ospiti votano vestito sposo e sposa
5. Time Capsule — ospiti lasciano messaggi rivelati al 1° anniversario (3/20€, 6/30€, 12/40€, 18/50€)
6. Reel Riassunto — video AI (Claude + FFmpeg) con foto/giochi, 49€ per invitati (max 4 persone), incluso in Deluxe per sposi
7. Hashtag Generator — AI suggerisce hashtag basati su nomi sposi, tema, location
8. Navetta Ospiti — sezione sito-evento con orari navetta, mappa parcheggi, contatti tassisti, matchmaking passaggio
9. Tavolo Selfie — chiosco selfie con filtri/logo JustMarry.live, upload diretto su Drive
10. Prima Notte di Sposi — amici regalano scherzi o "cose hot" dal nostro shop
11. App & Sito contenitore di tutto

### Modello di business
- 3 tier: Sito Premium 99€, Servizio Premium 149€, Deluxe 250€ (prezzi Italia)
- Geo-pricing: prezzi proporzionali allo stipendio medio del paese (USA $245/370/620, UK £190/290/480, Svizzera 340/510/850 CHF, ecc.)
- Gift: amici possono regalare il servizio agli sposi
- Extra: commissioni lista nozze 3-5%, stampe Gelato 20-30%, domini 40€ margine
- Proiezione: 253 clienti anno 1 (~46K€), 9.800 anno 2 (~3.5M€)

## COSA CHIEDO

1. **Nuove idee feature** — cosa manca? Cosa farebbe decollare la piattaforma? (gamification, monetizzazione, retention, viralità)
2. **Prioritizzazione** — delle 11 idee in backlog, quali implementare per prime e perché?
3. **Growth hacks** — come acquisire i primi 1.000 clienti con budget quasi zero? (Siamo in 2, zero budget marketing)
4. **Pricing & packaging** — critiche al nostro modello di pricing? Alternative?
5. **Rischi** — cosa potrebbe uccidere questo progetto?
6. **Integrazioni** — quali API/servizi aggiuntivi potrebbero sbloccare valore?
7. **SEO & content** — strategia editoriale per posizionarci come riferimento globale su "giochi matrimonio", "foto matrimonio interattive", "sito invito digitale"
8. **Mobile** — ha senso un'app nativa o basta PWA/responsive?
9. **AI** — come usare Claude/Gemini oltre al concierge? (generazione contenuti sito, automazione, personalizzazione)
10. **Internazionalizzazione** — criticità nell'espansione UK/US/ES/FR/DE? Come localizzare senza risorse?

## OUTPUT RICHIESTO

Rispondi in italiano, strutturato, concreto. Per ogni idea: spiega il problema che risolve, come implementarla tecnicamente (senza codice), come monetizzarla, e in quanto tempo è realizzabile (giorni/settimane/mesi). Sii specifico, non generico. Critica costruttivamente ciò che non funziona.
