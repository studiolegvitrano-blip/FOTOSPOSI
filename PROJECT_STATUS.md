# PROJECT STATUS — FotoSposi / WeddingMoments

## Stato attuale: FASE 1 — Core + Events (completato ✓)

### Checklist Fase 1
- [x] Modulo core: Supabase SSR client, auth helpers (signUp, signIn, signOut, QR token)
- [x] Pagine auth: login, registrazione, confirm email
- [x] Middleware protezione rotte dashboard
- [x] Dashboard sposi con lista eventi + link creazione
- [x] Modulo events: service CRUD (crea, leggi, lista eventi, sub-eventi, finestra 10gg)
- [x] Web: pagina creazione evento
- [x] Web: pagina dettaglio evento con sotto-eventi e finestra

### Da fare Fase 1
- [ ] Modulo media: upload, compressione client-side, Drive sync
- [ ] Web: pagina upload media per evento
- [ ] Web: pagina evento pubblico (guest view)
- [ ] Generazione QR code

### Prossime fasi
- **Fase 2** (games, social-sharing): non iniziata
- **Fase 3** (commerce): non iniziata
- **Fase 4** (site-builder, AI): non iniziata
- **Fase 5** (advanced): non iniziata

## Log cronologico
| Data | Modulo | Commit |
|------|--------|--------|
| 30/06/2026 | setup | 1719793 — Setup monorepo + 11 packages + migrazioni SQL |
| 30/06/2026 | infra | a362182 — Edge functions (auth) + chiavi Supabase |
| 30/06/2026 | core | 836d2d3 — Core auth: SSR, login/registrazione, dashboard, middleware |
| 30/06/2026 | events | cfb8aab — Events: service CRUD, creazione evento, dettaglio, sub-eventi |

## Ultimo comando eseguito
git push (events module)

## Variabili d'ambiente ancora mancanti
- STRIPE_*, GELATO_API_KEY, GOOGLE_DRIVE_*, RESEND_API_KEY, ANTHROPIC_API_KEY, EVOLUTION_API_*
