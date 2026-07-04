-- GTM Engineer — marketing automation tables
-- brand_config: profilo brand per AI content pipeline
create table if not exists public.brand_config (
    id uuid primary key default uuid_generate_v4(),
    slug text unique not null,
    name text not null,
    description text,
    tone_of_voice text,
    target_audience jsonb,
    primary_language text default 'it',
    supported_languages text[] default array['it'],
    hashtag_pool text[] default array[]::text[],
    content_pillars jsonb,
    social_accounts jsonb,
    risk_policy text default 'standard',
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- engagement_triage: commenti/DM classificati da AI
create table if not exists public.engagement_triage (
    id uuid primary key default uuid_generate_v4(),
    brand_id uuid references brand_config(id) on delete cascade,
    platform text not null,
    platform_message_id text,
    platform_user_id text,
    platform_account_id text,
    user_name text,
    user_profile_url text,
    message_text text not null,
    language text,
    intent text,
    risk text,
    confidence real,
    needs_review boolean default false,
    suggested_auto_reply text,
    auto_reply_sent boolean default false,
    auto_reply_text text,
    reviewed_by uuid,
    reviewed_at timestamptz,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- trend_intelligence: trend e pattern vincenti
create table if not exists public.trend_intelligence (
    id uuid primary key default uuid_generate_v4(),
    brand_id uuid references brand_config(id) on delete cascade,
    trend_type text not null, -- hashtag, format, emotional_tag, content_pillar
    trend_value jsonb not null,
    performance_data jsonb,
    source text default 'ai_analysis',
    confidence real,
    expires_at timestamptz,
    created_at timestamptz default now()
);

-- content_performance: metriche per contenuti pubblicati
create table if not exists public.content_performance (
    id uuid primary key default uuid_generate_v4(),
    brand_id uuid references brand_config(id) on delete cascade,
    content_id uuid references content_queue(id) on delete set null,
    platform text not null,
    impressions integer default 0,
    engagements integer default 0,
    engagement_rate real,
    clicks integer default 0,
    conversions integer default 0,
    revenue real,
    metadata jsonb,
    recorded_at timestamptz default now()
);

-- b2b_leads: lead fornitore intercettati
create table if not exists public.b2b_leads (
    id uuid primary key default uuid_generate_v4(),
    brand_id uuid references brand_config(id) on delete cascade,
    source_platform text not null,
    source_user_profile text not null,
    source_post_url text,
    raw_text text not null,
    ai_category text,
    ai_confidence real,
    ai_summary text,
    contact_method text,
    contact_status text default 'new',
    marketplace_supplier_id uuid references public.marketplace_suppliers(id),
    crm_notes text,
    assigned_to text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- lead_to_supplier_conversion: conversioni lead → fornitori
create table if not exists public.lead_to_supplier_conversion (
    id uuid primary key default uuid_generate_v4(),
    lead_id uuid references b2b_leads(id) on delete cascade,
    conversion_date timestamptz default now(),
    supplier_id uuid references public.marketplace_suppliers(id),
    subscription_tier text,
    revenue real,
    notes text
);

-- Indici
create index if not exists idx_brand_config_slug on brand_config(slug);
create index if not exists idx_engagement_triage_brand on engagement_triage(brand_id);
create index if not exists idx_engagement_triage_risk on engagement_triage(risk);
create index if not exists idx_trend_intelligence_brand on trend_intelligence(brand_id);
create index if not exists idx_content_performance_brand on content_performance(brand_id);
create index if not exists idx_content_performance_date on content_performance(recorded_at);
create index if not exists idx_b2b_leads_brand on b2b_leads(brand_id);
create index if not exists idx_b2b_leads_status on b2b_leads(contact_status);
create index if not exists idx_b2b_leads_category on b2b_leads(ai_category);

-- Trigger updated_at
create or replace function public.update_gte_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger if not exists trg_brand_config_updated_at
    before update on brand_config for each row execute function update_gte_updated_at();
create trigger if not exists trg_engagement_triage_updated_at
    before update on engagement_triage for each row execute function update_gte_updated_at();
create trigger if not exists trg_b2b_leads_updated_at
    before update on b2b_leads for each row execute function update_gte_updated_at();

-- RLS
alter table brand_config enable row level security;
alter table engagement_triage enable row level security;
alter table trend_intelligence enable row level security;
alter table content_performance enable row level security;
alter table b2b_leads enable row level security;
alter table lead_to_supplier_conversion enable row level security;

create policy "Admin full access brand_config" on brand_config for all to authenticated using (true);
create policy "Admin full access engagement_triage" on engagement_triage for all to authenticated using (true);
create policy "Admin full access trend_intelligence" on trend_intelligence for all to authenticated using (true);
create policy "Admin full access content_performance" on content_performance for all to authenticated using (true);
create policy "Admin full access b2b_leads" on b2b_leads for all to authenticated using (true);
create policy "Admin full access lead_to_supplier_conversion" on lead_to_supplier_conversion for all to authenticated using (true);

-- Inserimento brand JustMarry.live
insert into public.brand_config (slug, name, description, tone_of_voice, target_audience, primary_language, supported_languages, hashtag_pool, social_accounts, risk_policy)
values (
    'justmarrylive',
    'JustMarry.live',
    'Photo e video degli invitati con QR code per matrimoni',
    'emotivo, romantico, autentico, celebrativo',
    '{"age": "25-45", "interests": ["wedding", "photography", "events"]}',
    'en',
    array['it', 'en', 'de', 'fr', 'es'],
    array['#justmarrylive', '#justmarried', '#wedding', '#weddingphotography', '#love', '#weddingday', '#weddinginspiration', '#bridetobe', '#weddingplanner', '#marriage'],
    '{"instagram": {"page_id": "", "access_token": ""}, "facebook": {"page_id": "", "access_token": ""}, "tiktok": {"token": ""}}',
    'standard'
) on conflict (slug) do nothing;
