# Stress Test Agenti — Sposi.live

Concorrenza reale sul sito: N agenti Playwright che contemporaneamente:
1. Navigano la home
2. Si registrano (email + password, GDPR consent)
3. Creano un evento Free (limite 1 per account)
4. Caricano foto e video concorrenti sulla pagina `/events/[id]/upload`
5. Verificano che i media appaiano in galleria

## Avvio rapido

```powershell
cd C:\Users\agost\OneDrive\Documenti\FOTOSPOSI\stress-test-agenti
npm install
# Avvia 10 agenti concorrenti contro http://localhost:3000
node index.js --url http://localhost:3000 --agents 10
# Avvia 50 agenti, ogni agente carica 5 foto + 2 video
node index.js --url http://localhost:3000 --agents 50 --photos 5 --videos 2
```

## Output

Ogni run produce:
- `reports/run-<timestamp>.log` — log per-agente (azioni, tempi, errori)
- `reports/run-<timestamp>.json` — metriche aggregate (success rate, latenze, fallimenti)
- `reports/run-<timestamp>.png` — heatmap temporale dei fallimenti

## File

| File | Ruolo |
|------|-------|
| `index.js` | Orchestratore: parse CLI, fan-out agenti, raccoglie risultati |
| `agent.js` | Singolo agente Playwright: registra, crea evento, carica media |
| `fixtures/` | Foto/video di esempio (presi da `apps/web/public/demo/`) |
| `lib/email.js` | Generatore email uniche (`stress+<uuid>@example.test`), conferma via SUPABASE Admin API |
| `lib/metrics.js` | Timing wrapper, raccolta P50/P95/P99 |

## Variabili ambiente necessarie

Copia `.env.example` in `.env` e riempi:

```
STRESS_BASE_URL=http://localhost:3000
SUPABASE_URL=https://krgqyluuiltckmhbeuue.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```

Il service role serve per confermare automaticamente le email dei nuovi utenti stress (altrimenti gli agenti si bloccherebbero al "verifica la tua email").

## Nota GDPR/security

Gli account creati dal stress test sono nominati `stress+<uuid>@example.test`. **Cancellali dopo il test** con:
```powershell
node scripts/cleanup-stress-accounts.js
```
