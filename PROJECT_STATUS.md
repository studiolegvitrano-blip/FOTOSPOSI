# PROJECT STATUS — FotoSposi / WeddingMoments

## Stato attuale: FASE 1 — Core auth (completato), Events (in corso)

### Checklist Fase 0
- [x] Setup monorepo completo (Turborepo + 11 packages)
- [x] Migrazioni SQL eseguite su Supabase (14 tabelle)
- [x] GitHub repo connesso e pushato
- [x] Supabase PAT configurato
- [x] opencode.json con MCP server Supabase

### Checklist Fase 1
- [x] Modulo core: Supabase SSR client, auth helpers (signUp, signIn, signOut, QR token)
- [x] Pagine auth: login, registrazione, confirm email
- [x] Middleware protezione rotte dashboard
- [x] Dashboard sposi base
- [ ] Modulo events: anagrafica evento, finestra 10gg, sub-eventi
- [ ] Modulo media: upload, compressione, Drive sync
- [ ] App web: landing migliorata, creazione evento, pagina evento pubblico

### Fasi successive
- **Fase 2**: non iniziata
- **Fase 3**: non iniziata
- **Fase 4**: non iniziata
- **Fase 5**: non iniziata

## Log cronologico
| Data | Modulo | Cosa fatto |
|------|--------|------------|
| 30/06/2026 | — | Setup monorepo, Turborepo, 11 packages, migrazioni SQL |
| 30/06/2026 | core | Supabase SSR, auth helpers, login/registrazione, dashboard, middleware |
| 30/06/2026 | — | Supabase MCP configurato, opencode.json creato |

## Ultimo comando eseguito
git commit + push (Fase 1 core auth)

## Prossimo passo previsto
Modulo events: CRUD evento, finestra 10gg, pagina creazione evento

## Variabili d'ambiente
| Variabile | Stato |
|-----------|-------|
| SUPABASE_URL | ✅ |
| SUPABASE_ANON_KEY | ✅ |
| SUPABASE_SERVICE_ROLE_KEY | ✅ |
| STRIPE_* | ❌ |
| GELATO_API_KEY | ❌ |
| GOOGLE_DRIVE_* | ❌ |
| RESEND_API_KEY | ❌ |
| ANTHROPIC_API_KEY | ❌ |
| EVOLUTION_API_* | ❌ |
