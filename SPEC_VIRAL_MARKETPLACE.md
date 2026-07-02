# SPEC — Viral Features + Marketplace 2 Binari

## Roadmap esecutiva (4 settimane, costo zero API)

| Settimana | Feature | Sforzo | Dipende da |
|-----------|---------|--------|------------|
| 1 | **Frame/Overlay brandizzato** (sharp, API route, bottone galleria) | 4gg | — |
| 2-3 | **Wedding Wrapped** (satori, cron, pagina pubblica) | 10gg | Branding evento (Sett.1) |
| 4 | **Live Curation Fase 1** (wall_priority_score, trigger, query pesata) | 4gg | — |

> **Fase 2** (con budget): Claude Vision su curation AI + copy personalizzato Wrapped — zero refactoring, sostituisce logica già isolata.

---

## BINARIO 1 — White-Label B2B (ricorrente)

Abbonamento mensile per professionisti del wedding che vogliono un tool brandizzato.

### Target

| Ruolo | Bisogno | Feature chiave |
|-------|---------|----------------|
| **Wedding Planner** | Gestire 20-30 matrimoni/anno con vista unificata, far figurare il proprio brand coi clienti | Dashboard multi-evento, dominio custom, invio notifiche a nome planner, export report |
| **Fotografo** | Condividere gallerie con gli sposi in modo professionale, upsell album | Galleria brandizzata, download full-res, integrazione stampa Gelato, watermark automatico |

### Pricing

| Tier | Prezzo/mese | Cosa include |
|------|-------------|--------------|
| **Planner Base** | 49€ | 10 eventi attivi, dominio custom, dashboard, notifiche email |
| **Planner Pro** | 99€ | Illimitato, revenue share 50%, API access, supporto priority |
| **Fotografo** | 39€ | Gallerie illimitate, watermark, stampa integrata, download full-res |

### Revenue share

- Planner Pro: **50%** su ogni transazione degli sposi (shop, stampa, time capsule, reel)
- Fotografo: **30%** su vendita album stampa via Gelato

---

## BINARIO 2 — Marketplace Fornitori (pay-to-play + commissione)

Directory fornitori visibile nell'app, con pagamento per visibilità + commissione sulle vendite tracciate.

### Categorie

| Categoria | Commissione | Canone mensile |
|-----------|-------------|----------------|
| Auto a noleggio | 10% | 49€ |
| Fuochi d'artificio | 15% | 49€ |
| Wedding Planner | 10% | 49€ (o abbonamento Binario 1) |
| Fiorai | 10% | 29€ |
| Abiti da sposi | 10% | 49€ |
| Catering / bakery | 10% | 29€ |
| Confetti / bomboniere | 10% | 29€ |
| Trucco / parrucco | 10% | 29€ |
| Animazione / DJ | 10% | 29€ |
| Video maker | 10% | 49€ |

### Meccanica "Passaporto Sconti"

1. L'utente (sposo o invitato) apre l'app → sezione "Fornitori partner"
2. Seleziona un fornitore → vede lo sconto esclusivo (es. "10% sul noleggio auto mostrando questa schermata")
3. Mostra lo schermo al fornitore → il fornitore applica lo sconto e **scansiona un QR** o inserisce un codice
4. La vendita viene tracciata → WM prende la commissione

**Vantaggio per il fornitore**: cliente già qualificato (sta usando l'app del matrimonio), zero costi di acquisizione.
**Vantaggio per WM**: ogni transazione è tracciata, niente vendite "sotto banco".

### Proiezione revenue ricorrente

| Item | Quantità | Prezzo | MRR |
|------|----------|--------|-----|
| Fornitori visibilità | 20 | 39€ media | 780€ |
| Planner abbonamento | 5 | 69€ media | 345€ |
| Fotografi abbonamento | 5 | 39€ | 195€ |
| **MRR totale** | | | **1.320€** |
| **ARR (anno 1, 50% crescita H2)** | | | **~16.000€** |
| **+ commissioni variabili** | | stima +30% | **~21.000€ anno 1** |

---

## Integrazione con Claude Features

| Feature Claude | Aggancio marketplace |
|----------------|---------------------|
| **Frame Overlay** | Il watermark può includere "Powered by [Fotografo/Planner]" se l'evento è white-label — il professionista ha visibilità su ogni foto condivisa |
| **Wedding Wrapped** | Footer card: "Organizzato da [Planner]" o "Fotografie da [Fotografo]" — link diretto al profilo fornitore nell'app |
| **Live Curation** | Le foto migliori sul wall possono avere un overlay "Scatta come [nome fotografo]" — promozione fotografi in tempo reale |

---

## Ordine implementazione

1. **Frame Overlay** (Settimana 1) — nessuna dipendenza, impatto virale immediato
2. **Wedding Wrapped** (Settimana 2-3) — riusa branding della settimana 1
3. **Live Curation Fase 1** (Settimana 4) — indipendente
4. **Tabella fornitori + profilo** (dopo Settimana 4) — struttura DB, CRUD, pagina pubblica
5. **Checkout commissioni** (Stripe Connect) — pagamento canone + split commissione
6. **Passaporto Sconti** (QR + codice sconto) — tracciamento vendite in-app
7. **Abbonamento white-label** (dominio custom + dashboard multi-evento)

---

## Rischi

| Rischio | Probabilità | Mitigazione |
|---------|-------------|-------------|
| Fornitori non tracciano vendite | Alta | QR obbligatorio per applicare sconto — senza scan, niente sconto |
| Planner preferisce tool esistente | Media | Differenziazione con tech (wall, giochi, AI) che competitor non hanno |
| Commissioni troppo alte per fornitori | Media | Partire con 10%, salire quando il traffico WM giustifica il costo di acquisizione |
| Fotografi usano già Pixieset/Pass | Alta | WM offre ciò che loro non hanno: engagement invitati (giochi, wall, quiz) + stampa integrata |
