# GTM ENGINEER — JUSTMARRY.LIVE
## Sistema di Marketing Automatizzato per JustMarry.live
## Luglio 2026

**Versione:** 1.0  
**Obiettivo:** Integrare il GTM Engineer nel progetto JustMarry.live per automatizzare marketing, lead generation B2B e ottimizzazione continua  
**Costo mensile:** ~€0 (AI gratuita + self-hosted)  
**Stack:** Supabase Free + n8n Self-Hosted + Groq/Mistral + Telegram

---

## 📋 INDICE

1. [Visione & Architettura](#1-visione--architettura)
2. [Integrazione con Sistema Esistente](#2-integrazione-con-sistema-esistente)
3. [Schema Database Aggiornato (Supabase)](#3-schema-database-aggiornato-supabase)
4. [Workflow n8n #1 — Content Pipeline WeddingMoments](#4-workflow-n8n-1--content-pipeline-weddingmoments)
5. [Workflow n8n #2 — B2B Lead Hunter (Wedding Planner & Fotografi)](#5-workflow-n8n-2--b2b-lead-hunter-wedding-planner--fotografi)
6. [Workflow n8n #3 — Engagement Triage WeddingMoments](#6-workflow-n8n-3--engagement-triage-weddingmoments)
7. [Workflow n8n #4 — Learning Loop & Optimization](#7-workflow-n8n-4--learning-loop--optimization)
8. [Prompt AI per WeddingMoments](#8-prompt-ai-per-weddingmoments)
9. [Stack Software & Costi](#9-stack-software--costi)
10. [Setup Passo Passo](#10-setup-passo-passo)
11. [Metriche di Successo](#11-metriche-di-successo)
12. [Ripristino Emergenza](#12-ripristino-emergenza)

---

## 1. Visione & Architettura

### Obiettivo
Integrare il GTM Engineer nel progetto JustMarry.live per:
- **Automatizzare la generazione di contenuti social** dagli UGC degli invitati
- **Generare lead B2B** (wedding planner, fotografi, location) per il marketplace
- **Ottimizzare continuamente** i contenuti basandosi sulle performance
- **Mantenere il costo zero** usando AI gratuite (Groq/Mistral)

### Principi
- **Costo zero:** Solo free tier e self-hosted
- **Integrazione nativa:** Usa il database WeddingMoments esistente
- **Proattivo:** Genera contenuti, risponde ai commenti, impara dai dati
- **Sicuro:** Triage automatico con escalation umana per rischi legali
- **Multilingua:** Supporta IT, EN-US, EN-GB, DE, FR, ES
- **Virale:** Sfrutta UGC invitati → coefficiente virale >2.0

### Mappa Mentale

```
┌─────────────────────────────────────────────────────────────┐
│              GTM ENGINEER — WEDDINGMOMENTS                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  WEDDINGMOMENTS (Sistema Esistente)                  │   │
│  │  - UGC invitati (foto/video con QR code)             │   │
│  │  - 21 giochi virali                                  │   │
│  │  - Wedding Wrapped, Frame overlay                    │   │
│  │  - Marketplace fornitori B2B                         │   │
│  │  - Tier system (Free/Premium/Deluxe)                 │   │
│  │  - i18n (6 lingue)                                   │   │
│  └──────────────────────┬───────────────────────────────┘   │
│                          │                                    │
│                          ▼                                    │
│              ┌───────────────────────┐                       │
│              │  Supabase DB          │                       │
│              │  (Single Source       │                       │
│              │   of Truth)           │                       │
│              └───────────┬───────────┘                       │
│                          │                                    │
│         ┌────────────────┼────────────────┐                 │
│         │                │                │                 │
│         ▼                ▼                ▼                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  n8n Orch.  │  │  Groq/Mistral│  │  Telegram   │         │
│  │ (Automation)│  │  (AI gratis) │  │ (Notifiche) │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                │                │                  │
│         └────────────────┼────────────────┘                  │
│                          │                                    │
│                          ▼                                    │
│              ┌───────────────────────┐                       │
│              │  4 Workflow n8n       │                       │
│              │  1. Content Pipeline  │                       │
│              │  2. B2B Lead Hunter   │                       │
│              │  3. Engagement Triage │                       │
│              │  4. Learning Loop     │                       │
│              └───────────────────────┘                       │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Il Loop Virtuoso WeddingMoments

1. **UGC Invitati** → Gli invitati caricano foto/video durante il matrimonio
2. **Content Pipeline (n8n #1)** → Groq valuta qualità, emozione, genera caption IT+EN
3. **Pubblicazione Social** → Contenuti pubblicati su IG/TikTok/FB con hashtag trending
4. **Engagement Triage (n8n #3)** → Commenti/DM classificati, auto-reply o escalation
5. **B2B Lead Hunter (n8n #2)** → Wedding planner/fotografi intercettati sui social
6. **Learning Loop (n8n #4)** → Analisi performance → aggiornamento prompt AI
7. **Virale** → Wedding Wrapped condiviso → nuovi sposi registrano → ciclo ricomincia

---

## 2. Integrazione con Sistema Esistente

### Cosa c'è già (da PROJECT_STATUS.md)

**Fase 5 completata:**
- ✅ Tier system: Free €0 / Premium 229€ / Deluxe 375€
- ✅ UGC invitati con QR code
- ✅ 21 giochi virali (Caccia alla Foto, Vota il Vestito, Quiz sugli Sposi, ecc.)
- ✅ Wedding Wrapped, Frame overlay, Time Capsule
- ✅ Marketplace fornitori B2B
- ✅ i18n completo (IT, EN-US, EN-GB, DE, FR, ES)
- ✅ Analytics con 4 metriche strategiche
- ✅ Drive OAuth + R2 Storage
- ✅ 187 test totali

**Social Marketing Engine (da SOCIAL-MARKETING-ENGINE-PROJECT.md):**
- ✅ Schema database Supabase (brand_config, content_queue, engagement_triage, trend_intelligence, content_performance)
- ✅ Workflow n8n #1 (Content Pipeline con Claude)
- ✅ Workflow n8n #2 (Engagement Triage)
- ✅ Workflow n8n #3 (Manus AI Research — opzionale)

### Cosa aggiunge il GTM Engineer

**Nuovi workflow n8n:**
1. **Content Pipeline WeddingMoments** → Sostituisce Claude con Groq (gratis), legge UGC dal DB WeddingMoments
2. **B2B Lead Hunter** → Intercetta wedding planner/fotografi sui social, genera lead per marketplace
3. **Engagement Triage WeddingMoments** → Versione ottimizzata per WeddingMoments (multilingua)
4. **Learning Loop** → Analisi settimanale performance → aggiornamento prompt AI

**Nuove tabelle Supabase:**
- `b2b_leads` → Lead wedding planner/fotografi intercettati
- `lead_to_customer_conversion` → Conversioni lead → clienti paganti

**Integrazione con Analytics esistenti:**
- Le 4 metriche strategiche (tasso attivazione, coinvolgimento invitati, coefficiente virale, conversione B2B) alimentano il Learning Loop

---

## 3. Schema Database Aggiornato (Supabase)

### 3.1 Tabelle Esistenti (da SOCIAL-MARKETING-ENGINE-PROJECT.md)

```sql
-- brand_config, content_queue, engagement_triage, trend_intelligence, content_performance
-- (Vedi SOCIAL-MARKETING-ENGINE-PROJECT.md sezione 3)
```

### 3.2 Nuove Tabelle per B2B Lead Generation

```sql
-- Lead B2B (wedding planner, fotografi, location)
create table public.b2b_leads (
    id uuid primary key default uuid_generate_v4(),
    brand_id uuid references brand_config(id) on delete cascade,
    source_platform text not null, -- instagram, facebook, linkedin, tiktok
    source_user_profile text not null,
    source_post_url text,
    raw_text text not null,
    ai_category text, -- wedding_planner, photographer, location, florist, other
    ai_confidence real,
    ai_summary text,
    contact_method text, -- dm, email, website
    contact_status text default 'new', -- new, contacted, qualified, converted, lost
    marketplace_supplier_id uuid, -- link a marketplace_suppliers se convertito
    crm_notes text,
    assigned_to text, -- nome operatore
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create index idx_b2b_leads_brand on b2b_leads(brand_id);
create index idx_b2b_leads_status on b2b_leads(contact_status);
create index idx_b2b_leads_category on b2b_leads(ai_category);

-- Conversioni lead B2B → fornitori marketplace
create table public.lead_to_supplier_conversion (
    id uuid primary key default uuid_generate_v4(),
    lead_id uuid references b2b_leads(id) on delete cascade,
    conversion_date timestamptz default now(),
    supplier_id uuid references marketplace_suppliers(id),
    subscription_tier text, -- free, premium, featured
    revenue real, -- eventuale revenue da abbonamento
    notes text
);
```

### 3.3 Trigger per updated_at automatico

```sql
create or replace function public.update_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger trg_b2b_leads_updated_at
before update on b2b_leads
for each row execute function update_updated_at();
```

### 3.4 Inserimento Brand WeddingMoments

```sql
-- WeddingMoments (già esistente, confermato)
insert into public.brand_config (slug, name, description, tone_of_voice, target_audience, primary_language, supported_languages, hashtag_pool, social_accounts, risk_policy)
values (
    'weddingmoments',
    'WeddingMoments',
    'Photo e video degli invitati con QR code per matrimoni',
    'emotivo, romantico, autentico, celebrativo',
    '{"age": "25-45", "interests": ["wedding", "photography", "events"]}',
    'it',
    array['it', 'en', 'de', 'fr', 'es'],
    array['#weddingmoments', '#sposi', '#matrimonio', '#weddingphotography', '#love', '#weddingday', '#instamatrimonio', '#weddinginspiration', '#bridetobe', '#weddingplanner'],
    '{"instagram": {"page_id": "", "access_token": ""}, "facebook": {"page_id": "", "access_token": ""}, "tiktok": {"token": ""}}',
    'standard'
);
```

---

## 4. Workflow n8n #1 — Content Pipeline WeddingMoments

**File:** `n8n-workflow-content-pipeline-weddingmoments.json`

### Flusso

```
[Schedule Trigger] Cron 08:00 ogni giorno
        │
        ▼
 [1. HTTP Request] GET brand_config per WeddingMoments da Supabase
        │
        ▼
 [2. HTTP Request] GET nuovi UGC dal DB WeddingMoments (max 50, ordinati per data)
        │    - query: SELECT * FROM media_uploads WHERE created_at > last_run ORDER BY created_at DESC LIMIT 50
        │    - include: id, event_id, user_id, file_type, file_url, metadata, created_at
        │
        ▼
 [3. Function Node] Prepara prompt batch per Groq
        │    - serializza asset con id, tipo, url, metadata
        │    - include tono brand, lingue supportate (IT, EN-US, EN-GB, DE, FR, ES)
        │    - chiede valutazione: emotional_tag, quality_score, format_suggestion, caption IT+EN, hashtags, triage
        │
        ▼
 [4. HTTP Request] POST a Groq API (Llama 3.3 70B)
        │    - endpoint: https://api.groq.com/openai/v1/chat/completions
        │    - model: llama-3.3-70b-versatile
        │    - max_tokens: 2000
        │
        ▼
 [5. Function Node] Processa risposta Groq
        │    - estrae JSON dalla risposta
        │    - filtra qualità >= 0.4
        │    - prende top 5
        │    - assegna orari di pubblicazione randomici (prossimi 7 giorni)
        │    - costruisce record content_queue con traduzioni
        │
        ▼
 [6. HTTP Request] INSERT multipli in content_queue (Supabase)
        │
        ▼
 [7. IF Node] triage == "auto" ?
        ├── SÌ → [NoOp] fine (pubblicazione automatica futura)
        └── NO → [Telegram] notifica "Review necessaria per [emotional_tag]"
                     │
                     ▼
               [NoOp] fine
```

### Configurazione Credentials

| Nodo | Auth | Variabili/Env |
|------|------|---------------|
| HTTP Request (Supabase) | HTTP Header Auth: `apikey` + `Authorization: Bearer` | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` |
| HTTP Request (WeddingMoments DB) | HTTP Header Auth | `WEDDINGMOMENTS_DB_URL`, `WEDDINGMOMENTS_DB_KEY` |
| HTTP Request (Groq) | HTTP Header Auth: `Authorization: Bearer` | `GROQ_API_KEY` |
| Telegram | none | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` |

### Prompt Groq per UGC Evaluation (dentro Function Node #3)

```javascript
// Function Node #3
const ugcItems = $input.all();
const brand = $('GET brand_config').first().json;

const prompt = `Sei un editor di contenuti social per un brand di wedding photography chiamato "${brand.name}".
TONO DEL BRAND: ${brand.tone_of_voice}
TARGET: ${JSON.stringify(brand.target_audience)}
LINGUE SUPPORTATE: ${brand.supported_languages.join(', ')}

Valuta questi contenuti UGC (foto/video di matrimonio reale) e per ciascuno restituisci:
1. emotional_tag: il momento emotivo (ballo, brindisi, risata, emozione, preparazione, cerimonia, dettaglio, primo_piano, cake, other)
2. quality_score: da 0 a 1
3. format_suggestion: reel, story, post, carousel
4. suggested_caption_it: didascalia in italiano (max 200 caratteri, con hook)
5. suggested_caption_en: didascalia in inglese (max 200 caratteri, hook)
6. hashtags: array di 3-5 hashtag pertinenti
7. triage: "auto" se pubblicabile, "review" se dubbio, "sensitive" se delicato
8. triage_reason: spiegazione solo se triage non è auto

Rispondi SOLO con un array JSON valido. Esempio:
[
  {
    "media_id": "uuid",
    "emotional_tag": "ballo",
    "quality_score": 0.85,
    "format_suggestion": "reel",
    "suggested_caption_it": "Il primo ballo che ha fatto commuovere tutti... 💃🕺 #weddingmoments",
    "suggested_caption_en": "The first dance that made everyone cry... 💃🕺 #weddingmoments",
    "hashtags": ["#weddingmoments", "#firstdance", "#love", "#weddingday"],
    "triage": "auto"
  }
]`;

return { prompt, ugcItems };
```

---

## 5. Workflow n8n #2 — B2B Lead Hunter (Wedding Planner & Fotografi)

**File:** `n8n-workflow-b2b-lead-hunter.json`

### Flusso

```
[Schedule Trigger] Cron ogni 4 ore
        │
        ▼
 [1. HTTP Request] Scraping Instagram/Facebook/LinkedIn (via Apify)
        │    - cerca hashtag: #weddingplanner, #weddingphotographer, #weddinglocation, #bridetobe
        │    - cerca parole chiave: "wedding planner", "fotografo matrimonio", "location matrimonio"
        │    - estrai post e profili degli ultimi 7 giorni
        │
        ▼
 [2. Function Node] Filtra e deduplica
        │    - rimuovi profili già processati (controlla source_user_profile in b2b_leads)
        │    - mantieni solo profili con >100 follower (più probabile che siano professionisti)
        │
        ▼
 [3. HTTP Request] POST a Groq API per classificazione
        │    - per OGNI profilo, classifica:
        │      - category: wedding_planner, photographer, location, florist, other
        │      - confidence: 0-1
        │      - summary: riassunto in 50 parole (cosa offre?)
        │      - contact_method: dm | email | website
        │
        ▼
 [4. Function Node] Filtra lead ad alto valore
        │    - mantieni solo profili con confidence >= 0.7
        │    - mantieni solo category in ['wedding_planner', 'photographer', 'location']
        │
        ▼
 [5. HTTP Request] INSERT in b2b_leads (Supabase)
        │    - salva brand_id (weddingmoments)
        │    - salva source_platform, source_user_profile, raw_text, ai_category, ai_confidence
        │    - contact_status = 'new'
        │
        ▼
 [6. Switch Node] Instrada per category
        │
        ├── wedding_planner ─────────────────────────────────────┐
        │    [Telegram] Notifica: "Nuovo wedding planner: [summary]"│
        │    + link al profilo                                     │
        │                                                          │
        ├── photographer ─────────────────────────────────────────┐
        │    [Telegram] Notifica: "Nuovo fotografo: [summary]"     │
        │    + link al profilo                                     │
        │                                                          │
        └── location ─────────────────────────────────────────────┐
             [Telegram] Notifica: "Nuova location: [summary]"      │
             + link al profilo                                     │
```

### Configurazione Credentials

| Nodo | Auth | Variabili/Env |
|------|------|---------------|
| HTTP Request (Apify) | HTTP Header Auth | `APIFY_API_TOKEN` |
| HTTP Request (Groq) | HTTP Header Auth | `GROQ_API_KEY` |
| HTTP Request (Supabase) | HTTP Header Auth | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` |
| Telegram | none | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` |

### Prompt Groq per Classificazione Lead B2B (dentro Function Node #3)

```javascript
// Function Node #3
const profiles = $input.all();

const prompts = profiles.map(profile => {
    const prompt = `Sei un sistema di qualificazione lead per il marketplace B2B di WeddingMoments.
Profilo social:
"${profile.content}"

Classifica in formato JSON:
1. category: wedding_planner | photographer | location | florist | other
2. confidence: 0-1 (quanto sei sicuro che sia un professionista wedding)
3. summary: riassunto in 50 parole (cosa offre? dove opera?)
4. contact_method: dm | email | website (metodo di contatto preferito)
5. risk: safe | sensitive (rischio nel contattare l'utente)

Rispondi SOLO con JSON, nessun altro testo. Esempio:
{
  "category": "wedding_planner",
  "confidence": 0.92,
  "summary": "Wedding planner basata a Milano, specializzata in matrimoni di lusso, 5k follower",
  "contact_method": "dm",
  "risk": "safe"
}`;

    return { profile_id: profile.id, prompt };
});

return prompts;
```

### Strategia di Contatto (Manuale ma Guidata)

**Flusso consigliato:**
1. **n8n** identifica il lead B2B e ti notifica su Telegram
2. **Tu** visiti il profilo del professionista
3. **Tu** invii un DM personalizzato (es. "Ciao! Ho visto il tuo profilo e mi piace molto il tuo lavoro. Abbiamo creato una piattaforma per wedding planner come te per gestire gli UGC degli invitati. Ti va di darle un'occhiata?")
4. **Il professionista** risponde e chiede info
5. **Tu** invii un link al marketplace WeddingMoments per registrarsi
6. **Il professionista** si registra come fornitore (free/premium/featured)

---

## 6. Workflow n8n #3 — Engagement Triage WeddingMoments

**File:** `n8n-workflow-engagement-triage-weddingmoments.json`

### Flusso

```
[Webhook] Endpoint: /social-engagement-hook
        │
        ▼
 [1. Function Node] Normalizza input (multipiattaforma FB/IG/TikTok)
        │    - estrae platform, message_id, user_id, message text
        │    - estrae platform_account_id (page_id da Meta, ToUserId da TikTok)
        │
        ▼
 [2. HTTP Request] GET brand_config per WeddingMoments da Supabase
        │
        ▼
 [3. HTTP Request] POST Groq per classificazione
        │    - lingua del commento (detect automatica tra IT, EN, DE, FR, ES)
        │    - intent: pricing, booking, info_general, info_technical, testimonial, complaint, compliment, collaboration, spam, legal, other
        │    - risk: safe, commercial, sensitive, legal
        │    - confidence score
        │    - suggested_auto_reply_it / _en / _de / _fr / _es
        │
        ▼
 [4. Function Node] Processa classificazione
        │    - costruisce record engagement_triage
        │    - passa risk + needs_review
        │
        ▼
 [5. HTTP Request] INSERT in engagement_triage (Supabase)
        │
        ▼
 [6. Switch Node] Instrada per risk level
        │
        ├── SAFE ─────────────────────────────────────┐
        │    [HTTP Request] Posta auto-reply su social │
        │    [HTTP Request] Aggiorna auto_reply_sent   │
        │                                              │
        ├── COMMERCIAL ───────────────────────────────┐
        │    [Telegram] Notifica: richiesta commerciale│
        │    + bozza risposta                          │
        │                                              │
        └── SENSITIVE / LEGAL ────────────────────────┐
             [Telegram] 🚨 Allarme urgente            │
             + invito a intervenire manualmente        │
```

### Prompt Groq per Classificazione Commenti (dentro Function Node #3)

```javascript
// Function Node #3
const comment = $input.first().json;
const brand = $('GET brand_config').first().json;

const prompt = `Sei un sistema di triage per engagement social.
Brand: ${brand.name}
Tono: ${brand.tone_of_voice}
Lingue supportate: ${brand.supported_languages.join(', ')}
Risk policy: ${brand.risk_policy}

Commento ricevuto (da ${comment.user_name} su ${comment.platform}):
"${comment.message}"

Classifica in formato JSON:
1. language: lingua del commento (codice ISO: it, en, de, fr, es)
2. intent: pricing | booking | info_general | info_technical | testimonial | complaint | compliment | collaboration | spam | legal | other
3. risk: safe | commercial | sensitive | legal
4. confidence: 0-1
5. needs_review: true/false
6. suggested_auto_reply_it: bozza risposta in italiano (solo se risk = safe o commercial, max 200 caratteri)
7. suggested_auto_reply_en: bozza risposta in inglese
8. suggested_auto_reply_de: bozza risposta in tedesco
9. suggested_auto_reply_fr: bozza risposta in francese
10. suggested_auto_reply_es: bozza risposta in spagnolo

Rispondi SOLO con JSON, nessun altro testo.`;

return { prompt, comment, brand };
```

---

## 7. Workflow n8n #4 — Learning Loop & Optimization

**File:** `n8n-workflow-learning-loop-weddingmoments.json`

### Flusso

```
[Schedule Trigger] Cron ogni domenica 20:00
        │
        ▼
 [1. HTTP Request] GET content_performance degli ultimi 7 giorni (Supabase)
        │    - estrai: content_id, platform, impressions, engagement_rate, clicks, conversions
        │
        ▼
 [2. HTTP Request] GET analytics WeddingMoments degli ultimi 7 giorni
        │    - estrai: tasso attivazione sposi, coinvolgimento invitati, coefficiente virale, conversione B2B
        │
        ▼
 [3. Function Node] Aggrega dati per tipo di contenuto
        │    - calcola: top 5 contenuti per engagement_rate
        │    - calcola: top 5 emotional_tag per performance
        │    - calcola: top 5 hashtag per performance
        │    - calcola: top 5 format_suggestion per performance
        │
        ▼
 [4. HTTP Request] POST a Groq API per analisi strategica
        │    - invia dati aggregati
        │    - chiedi: pattern vincenti, raccomandazioni, prompt da aggiornare
        │
        ▼
 [5. Function Node] Processa raccomandazioni Groq
        │    - estrai: nuovi prompt da usare, hashtag da aggiungere, formati da privilegiare
        │
        ▼
 [6. HTTP Request] UPDATE brand_config (Supabase)
        │    - aggiorna hashtag_pool con nuovi hashtag trending
        │    - aggiorna content_pillars con nuovi formati vincenti
        │
        ▼
 [7. Telegram] Notifica: "Learning loop completato. Top performer: [content_id] con [engagement_rate]% engagement"
        │
        ▼
 [8. HTTP Request] INSERT in trend_intelligence (Supabase)
        │    - salva pattern vincenti per uso futuro
```

### Prompt Groq per Analisi Strategica (dentro Function Node #4)

```javascript
// Function Node #4
const performanceData = $input.first().json;

const prompt = `Sei un data analyst specializzato in social media marketing per il settore wedding.
Ho questi dati di performance degli ultimi 7 giorni per WeddingMoments:

${JSON.stringify(performanceData, null, 2)}

Analizza e rispondi in formato JSON:
1. top_performing_content: array di top 5 content_id per engagement_rate
2. top_performing_emotional_tags: array di top 5 emotional_tag per performance
3. top_performing_hashtags: array di top 10 hashtag per performance
4. winning_patterns: array di pattern vincenti (es. "video di ballo con musica romantica performano il 40% meglio")
5. prompt_recommendations: array di raccomandazioni per migliorare i prompt AI (es. "aggiungi più emoji nei caption", "usa più hook emotivi")
6. content_pillars_to_add: array di nuovi content pillar da aggiungere (es. "dietro le quinte preparazione", "tutorial giochi invitati")

Rispondi SOLO con JSON, nessun altro testo.`;

return { prompt, performanceData };
```

---

## 8. Prompt AI per WeddingMoments

### 8.1 Prompt per UGC Evaluation (Workflow #1)

```
Sei un editor di contenuti social per un brand di wedding photography chiamato "WeddingMoments".
TONO DEL BRAND: emotivo, romantico, autentico, celebrativo
TARGET: sposi 25-45 anni, interessati a wedding, photography, events
LINGUE SUPPORTATE: it, en, de, fr, es

Valuta questi contenuti UGC (foto/video di matrimonio reale) e per ciascuno restituisci:
1. emotional_tag: ballo, brindisi, risata, emozione, preparazione, cerimonia, dettaglio, primo_piano, cake, other
2. quality_score: da 0 a 1
3. format_suggestion: reel, story, post, carousel
4. suggested_caption_it: didascalia in italiano (max 200 caratteri, con hook)
5. suggested_caption_en: didascalia in inglese (max 200 caratteri, hook)
6. hashtags: array di 3-5 hashtag pertinenti
7. triage: "auto" se pubblicabile, "review" se dubbio, "sensitive" se delicato
8. triage_reason: spiegazione solo se triage non è auto

Rispondi SOLO con un array JSON valido.
```

### 8.2 Prompt per Classificazione Commenti (Workflow #3)

```
Sei un sistema di triage per engagement social.
Brand: WeddingMoments
Tono: emotivo, romantico, autentico, celebrativo
Lingue supportate: it, en, de, fr, es
Risk policy: standard

Commento ricevuto (da {user} su {platform}):
"{comment}"

Classifica in formato JSON:
1. language: lingua del commento (codice ISO)
2. intent: pricing | booking | info_general | info_technical | testimonial | complaint | compliment | collaboration | spam | legal | other
3. risk: safe | commercial | sensitive | legal
4. confidence: 0-1
5. needs_review: true/false
6. suggested_auto_reply_it: bozza risposta in italiano (solo se risk = safe o commercial, max 200 caratteri)
7. suggested_auto_reply_en: bozza risposta in inglese
8. suggested_auto_reply_de: bozza risposta in tedesco
9. suggested_auto_reply_fr: bozza risposta in francese
10. suggested_auto_reply_es: bozza risposta in spagnolo

Rispondi SOLO con JSON, nessun altro testo.
```

### 8.3 Prompt per Classificazione Lead B2B (Workflow #2)

```
Sei un sistema di qualificazione lead per il marketplace B2B di WeddingMoments.
Profilo social:
"{profile}"

Classifica in formato JSON:
1. category: wedding_planner | photographer | location | florist | other
2. confidence: 0-1 (quanto sei sicuro che sia un professionista wedding)
3. summary: riassunto in 50 parole (cosa offre? dove opera?)
4. contact_method: dm | email | website (metodo di contatto preferito)
5. risk: safe | sensitive (rischio nel contattare l'utente)

Rispondi SOLO con JSON, nessun altro testo.
```

### 8.4 Prompt per Analisi Strategica (Workflow #4)

```
Sei un data analyst specializzato in social media marketing per il settore wedding.
Ho questi dati di performance degli ultimi 7 giorni per WeddingMoments:

{performance_data}

Analizza e rispondi in formato JSON:
1. top_performing_content: array di top 5 content_id per engagement_rate
2. top_performing_emotional_tags: array di top 5 emotional_tag per performance
3. top_performing_hashtags: array di top 10 hashtag per performance
4. winning_patterns: array di pattern vincenti
5. prompt_recommendations: array di raccomandazioni per migliorare i prompt AI
6. content_pillars_to_add: array di nuovi content pillar da aggiungere

Rispondi SOLO con JSON, nessun altro testo.
```

---

## 9. Stack Software & Costi

| Componente | Prodotto | Costo | Note |
|------------|----------|-------|------|
| Database | Supabase Free Tier | € 0 | 500 MB DB, 2 GB bandwidth |
| Orchestrazione | n8n self-hosted | € 0 | Docker o VPS personale |
| AI primaria | Groq (Llama 3.3 70B) | € 0 | 14.400 req/giorno, 500 tok/s |
| AI backup GDPR | Mistral AI (Medium) | € 0 | ~86.000 req/giorno, compliance EU |
| Scraping | Apify Free Tier | € 0 | 5.000 esecuzioni/mese |
| Storage | Cloudflare R2 | € 0 | 10 GB storage, bandwidth ∞ |
| Notifiche | Telegram Bot | € 0 | |
| Hosting webhook | n8n | Incluso | Stesso server di n8n |
| **TOTALE** | | **~ € 0/mese** | **AI completamente gratuita** |

---

## 10. Setup Passo Passo

### Fase 1 — Database

1. Vai su Supabase Dashboard → SQL Editor
2. Esegui lo schema SQL di SOCIAL-MARKETING-ENGINE-PROJECT.md (sezione 3)
3. Esegui le nuove tabelle per B2B (sezione 3.2 di questo documento)
4. Esegui INSERT del brand WeddingMoments (sezione 3.4)
5. Copia `SUPABASE_URL` e `service_role key` da Settings → API

### Fase 2 — n8n Credentials

Crea in n8n → Credentials:

| Nome | Tipo | Dettaglio |
|------|------|-----------|
| Supabase Service | HTTP Header Auth | `apikey` = service_role key |
| Groq API | HTTP Header Auth | `Authorization: Bearer` = GROQ_API_KEY |
| Apify API | HTTP Header Auth | `Authorization: Bearer` = APIFY_API_TOKEN |

### Fase 3 — Variabili d'Ambiente

Nel file `.env` di n8n:

```bash
# Supabase
SUPABASE_URL=https://tuo-progetto.supabase.co
SUPABASE_SERVICE_KEY=eyJ...

# AI — Groq (primaria, gratis)
GROQ_API_KEY=gsk_...

# AI — Mistral (backup GDPR, gratis)
MISTRAL_API_KEY=...

# Telegram
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
TELEGRAM_CHAT_ID=123456789

# Apify
APIFY_API_TOKEN=apify_api_...

# WeddingMoments DB
WEDDINGMOMENTS_DB_URL=https://tuo-weddingmoments-db.supabase.co
WEDDINGMOMENTS_DB_KEY=eyJ...
```

### Fase 4 — Import Workflow

1. n8n → Workflows → Import from File
2. Importa:
   - `n8n-workflow-content-pipeline-weddingmoments.json`
   - `n8n-workflow-b2b-lead-hunter.json`
   - `n8n-workflow-engagement-triage-weddingmoments.json`
   - `n8n-workflow-learning-loop-weddingmoments.json`
3. Collega i credentials corretti a ogni nodo HTTP Request
4. Attiva tutti i workflow

### Fase 5 — Configura Webhook Social

1. **Meta:** Developer Console → Webhook → callback a `/webhook/social-engagement-hook`
2. **TikTok:** Developer Portal → App → Webhook
3. Avvia le App Review (gratuite, servono 1-6 settimane)

### Fase 6 — Test Manuale

1. Esegui manualmente il Workflow #1 (Content Pipeline) per verificare che legga gli UGC dal DB WeddingMoments
2. Verifica che i contenuti vengano inseriti in `content_queue`
3. Esegui manualmente il Workflow #2 (B2B Lead Hunter) per verificare che intercetti i lead
4. Verifica che i lead vengano salvati in `b2b_leads`

---

## 11. Metriche di Successo

### 11.1 Metriche per WeddingMoments (da PROJECT_STATUS.md)

| Metrica | Target | Fonte Dati |
|---------|--------|------------|
| Tasso attivazione sposi | >60% | `events.created_at` + `site_drafts.published` |
| Coinvolgimento invitati | >40% | `media_uploads` + `votes` + `joke_entries` |
| Coefficiente virale | >2.0 | `social_shares` / `events` |
| Conversione B2B | >15% | `marketplace_suppliers.contacted_at` + `.active` |

### 11.2 Metriche GTM Engineer

| Metrica | Target | Fonte Dati |
|---------|--------|------------|
| Contenuti pubblicati/mese | >100 | `content_queue` where `status = 'posted'` |
| Engagement rate medio | >3% | `content_performance.engagement_rate` |
| Lead B2B generati/mese | >50 | `b2b_leads` where `contact_status = 'new'` |
| Lead B2B convertiti/mese | >10 | `lead_to_supplier_conversion` |
| Auto-reply rate | >80% | `engagement_triage.auto_reply_sent` / `engagement_triage` total |

### 11.3 Metriche di Business

| Metrica | Target | Fonte Dati |
|---------|--------|------------|
| Revenue mensile | >€10.000 | `events` (tier premium/deluxe) + `marketplace_suppliers` (abbonamenti) |
| Costo per lead (CPL) | <€2 | `costi_totali / lead_totali` |
| ROI | >500% | `(revenue - costi) / costi` |

---

## 12. Ripristino Emergenza

### Se Supabase viene cancellato

1. Crea nuovo progetto Supabase
2. Esegui lo schema SQL di SOCIAL-MARKETING-ENGINE-PROJECT.md (sezione 3)
3. Esegui le nuove tabelle per B2B (sezione 3.2 di questo documento)
4. Reinserisci `brand_config` (sezione 3.4)
5. Ricrea indici e trigger

### Se n8n viene resettato

1. Importa i file JSON dei workflow:
   - `n8n-workflow-content-pipeline-weddingmoments.json`
   - `n8n-workflow-b2b-lead-hunter.json`
   - `n8n-workflow-engagement-triage-weddingmoments.json`
   - `n8n-workflow-learning-loop-weddingmoments.json`
2. Ricrea credentials manualmente (Supabase, Groq, Apify)
3. Ricollega i credentials ai nodi
4. Attiva i workflow

### Se perdi tutti i file

**Questo documento contiene tutto:**
- ✅ Schema SQL completo
- ✅ Prompt AI per WeddingMoments
- ✅ Configurazioni n8n (struttura nodi, connessioni)
- ✅ Credenziali necessarie (tipi, non valori)
- ✅ Setup guide
- ✅ Metriche di successo

Basta seguire la Sezione 10 per ricostruire tutto da zero.

---

## 📌 Prossimi Passi Immediati

1. **[ ]** Creare account Supabase e eseguire schema SQL
2. **[ ]** Installare n8n self-hosted (Docker o VPS)
3. **[ ]** Ottenere API key gratuite (Groq, Mistral, Apify)
4. **[ ]** Importare workflow n8n e configurare credentials
5. **[ ]** Avviare App Review per Meta/TikTok (lead time 2-6 settimane)
6. **[ ]** Testare workflow manualmente (senza cron) per verificare funzionamento
7. **[ ]** Attivare workflow e monitorare prime esecuzioni
8. **[ ]** Integrare con WeddingMoments DB (verifica accesso)
9. **[ ]** Monitorare metriche per 30 giorni
10. **[ ]** Ottimizzare prompt AI basandosi su Learning Loop

---

**Fine documento.**
**Ultimo aggiornamento:** 3 Luglio 2026
**Versione:** 1.0
