import { createClient } from '@fotosposi/core';
import type { SiteTemplate, SiteDraft, AiGeneratedText } from './index';

export async function getTemplates(): Promise<{ templates?: SiteTemplate[]; error?: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.from('site_templates').select('*').order('name');
  if (error) return { error: error.message };
  return { templates: data ?? [] };
}

export async function getTemplateById(id: string): Promise<{ template?: SiteTemplate; error?: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.from('site_templates').select('*').eq('id', id).single();
  if (error) return { error: error.message };
  return { template: data };
}

export async function createDraft(eventId: string, templateId?: string): Promise<{ draft?: SiteDraft; error?: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.from('site_drafts').insert({
    event_id: eventId,
    template_id: templateId ?? null,
    content: {},
  }).select().single();
  if (error) return { error: error.message };
  return { draft: data };
}

export async function getDraft(eventId: string): Promise<{ draft?: SiteDraft; error?: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.from('site_drafts').select('*').eq('event_id', eventId).maybeSingle();
  if (error) return { error: error.message };
  return { draft: data ?? undefined };
}

export async function updateDraft(draftId: string, content: Record<string, string>): Promise<{ draft?: SiteDraft; error?: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.from('site_drafts').update({ content, updated_at: new Date().toISOString() }).eq('id', draftId).select().single();
  if (error) return { error: error.message };
  return { draft: data };
}

export async function updateDraftTemplate(draftId: string, templateId: string): Promise<{ draft?: SiteDraft; error?: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.from('site_drafts').update({ template_id: templateId, updated_at: new Date().toISOString() }).eq('id', draftId).select().single();
  if (error) return { error: error.message };
  return { draft: data };
}

export async function publishSite(draftId: string): Promise<{ draft?: SiteDraft; error?: string }> {
  const supabase = createClient();
  const url = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/sito/${draftId}`;
  const { data, error } = await supabase.from('site_drafts').update({ published: true, published_url: url, updated_at: new Date().toISOString() }).eq('id', draftId).select().single();
  if (error) return { error: error.message };
  return { draft: data };
}

export async function generateText(eventId: string, prompt: string, section: string = 'home'): Promise<{ text?: AiGeneratedText; error?: string }> {
  const supabase = createClient();
  const generated = `[${section.toUpperCase()}] ${prompt} — generato da AI (demo). Attiva ANTHROPIC_API_KEY per testi reali.`;
  const { data, error } = await supabase.from('ai_generated_texts').insert({
    event_id: eventId, prompt, generated, section,
  }).select().single();
  if (error) return { error: error.message };
  return { text: data };
}

export async function getGeneratedTexts(eventId: string): Promise<{ texts?: AiGeneratedText[]; error?: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.from('ai_generated_texts').select('*').eq('event_id', eventId).order('created_at', { ascending: false });
  if (error) return { error: error.message };
  return { texts: data ?? [] };
}
