'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient, getCurrentUser } from '@fotosposi/core';
import { getTemplates, getDraft, createDraft, updateDraft, updateDraftTemplate, publishSite, generateText } from '@fotosposi/site-builder';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function SiteBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [draft, setDraft] = useState<any>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [content, setContent] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'templates' | 'content' | 'preview'>('templates');

  useEffect(() => {
    getCurrentUser().then(({ user: u, error }) => {
      if (error || !u) { router.push('/login'); return; }
      setUser(u);
      loadData();
    });
  }, [id]);

  const loadData = async () => {
    const [tRes, dRes] = await Promise.all([getTemplates(), getDraft(id)]);
    if (tRes.templates) setTemplates(tRes.templates);
    const d = dRes.draft;
    if (d) {
      setDraft(d);
      setSelectedTemplate(tRes.templates?.find(t => t.id === d.template_id) ?? null);
      setContent(d.content as Record<string, string>);
    }
  };

  const handleSelectTemplate = async (t: any) => {
    setSelectedTemplate(t);
    if (!draft) {
      const r = await createDraft(id, t.id);
      if (r.draft) setDraft(r.draft);
    } else {
      await updateDraftTemplate(draft.id, t.id);
      setDraft({ ...draft, template_id: t.id });
    }
  };

  const handleSaveContent = async () => {
    if (!draft) return;
    setSaving(true);
    await updateDraft(draft.id, content);
    setSaving(false);
  };

  const handlePublish = async () => {
    if (!draft) return;
    await publishSite(draft.id);
    loadData();
  };

  const handleGenerate = async (section: string) => {
    const prompt = (content[section] || '') + ' (migliora questo testo)';
    await generateText(id, prompt, section);
    alert(`Testo generato per "${section}". Attiva ANTHROPIC_API_KEY per testi reali.`);
  };

  const tpl = selectedTemplate;
  const palette = tpl?.palette ?? ['#d4a574', '#f5f0eb', '#1a1a2e', '#ffffff'];

  return (
    <main className="max-w-5xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Crea il sito dell'evento</h1>
          <p className="text-text-muted text-sm">Personalizza il sito pubblico per i tuoi invitati</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push(`/events/${id}`)}>← Evento</Button>
        </div>
      </div>

      <div className="flex gap-2 border-b border-border pb-2">
        {(['templates', 'content', 'preview'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-t-md text-sm font-medium transition-colors ${tab === t ? 'bg-brand text-white' : 'hover:bg-muted text-text-muted'}`}>
            {t === 'templates' ? 'Template' : t === 'content' ? 'Contenuti' : 'Anteprima'}
          </button>
        ))}
      </div>

      {tab === 'templates' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(t => {
            const isSelected = draft?.template_id === t.id;
            return (
              <Card key={t.id} className={`cursor-pointer transition-all ${isSelected ? 'ring-2 ring-brand' : 'hover:shadow-md'}`} onClick={() => handleSelectTemplate(t)}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    {t.name}
                    {isSelected && <Badge>Selezionato</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-1 mb-2">
                    {(t.palette as string[]).map((c: string, i: number) => (
                      <div key={i} className="w-6 h-6 rounded-full border border-border" style={{ background: c }} />
                    ))}
                  </div>
                  <p className="text-xs text-text-muted">Font: {t.font_family}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {tab === 'content' && draft && (
        <div className="space-y-4">
          {['home', 'story', 'schedule', 'gallery', 'guests'].map(section => (
            <Card key={section}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base capitalize">{section === 'home' ? 'Home' : section === 'schedule' ? 'Programma' : section}</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => handleGenerate(section)}>Genera AI</Button>
              </CardHeader>
              <CardContent>
                <textarea
                  className="w-full min-h-[100px] rounded-md border border-border bg-surface px-3 py-2 text-sm"
                  value={content[section] || ''}
                  onChange={e => setContent({ ...content, [section]: e.target.value })}
                  placeholder={`Scrivi il contenuto per la sezione ${section}...`}
                />
              </CardContent>
            </Card>
          ))}
          <Button onClick={handleSaveContent} disabled={saving}>{saving ? 'Salvataggio...' : 'Salva contenuti'}</Button>
        </div>
      )}

      {tab === 'preview' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Anteprima sito</CardTitle>
            {draft && <Button onClick={handlePublish}>{draft.published ? 'Ripubblica' : 'Pubblica'}</Button>}
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border overflow-hidden" style={{ fontFamily: tpl?.font_family ?? 'inherit' }}>
              <div className="p-8 text-center" style={{ background: palette[1], color: palette[2] }}>
                <h2 className="text-3xl font-bold mb-2" style={{ color: palette[0] }}>Benvenuti!</h2>
                <p>{content.home || 'Testo della home non ancora inserito.'}</p>
              </div>
              <div className="p-8" style={{ background: palette[3], color: palette[2] }}>
                <h3 className="text-xl font-semibold mb-4" style={{ color: palette[0] }}>La nostra storia</h3>
                <p>{content.story || 'Racconta la vostra storia...'}</p>
              </div>
              <div className="p-8 text-center text-sm text-text-muted" style={{ background: palette[1] }}>
                <p>FotoSposi — Sito evento</p>
              </div>
            </div>
            {draft?.published && draft?.published_url && (
              <p className="mt-4 text-center">
                Sito pubblicato: <a href={draft.published_url} className="text-brand hover:underline" target="_blank">{draft.published_url}</a>
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
