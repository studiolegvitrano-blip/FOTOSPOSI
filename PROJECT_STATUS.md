# PROJECT STATUS — FotoSposi / WeddingMoments

## Stato attuale: FASE 3 — Core + Events + Media + Games + Social + Commerce (completato ✓)

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
- [x] 22 test: auth (9), events service (7), calculateWindow (3), Button (3)
- [x] Ruolo manager + admin panel + tabella event_managers

### Bloccato (chiavi mancanti)
- Google Drive: GOOGLE_DRIVE_CLIENT_EMAIL / GOOGLE_DRIVE_PRIVATE_KEY
- Stripe: STRIPE_SECRET_KEY / NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
- Gelato: GELATO_API_KEY
- Resend: RESEND_API_KEY
- Claude: ANTHROPIC_API_KEY
- Evolution API: EVOLUTION_API_URL / EVOLUTION_API_KEY

### Prossime fasi
- **Fase 4** (site-builder AI, video guestbook, angolo scherzi): pronta per iniziare
- **Fase 5** (face-recognition, concierge, marketplace, B2B): non iniziata

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
