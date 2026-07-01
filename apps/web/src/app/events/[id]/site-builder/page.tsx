'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getCurrentUser } from '@fotosposi/core';
import { getTemplates, getDraft, createDraft, updateDraft, updateDraftTemplate, publishSite } from '@fotosposi/site-builder';
import type { SiteContent } from '@fotosposi/site-builder';
import { SUGGESTED_PHRASES, generateIcsLink } from '@fotosposi/site-builder';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type SectionKey = keyof typeof SUGGESTED_PHRASES;

const SECTION_META: { key: string; label: string; icon: string; desc: string }[] = [
  { key: 'ceremonyEnabled', label: 'Cerimonia', icon: '⛪', desc: 'Luogo, orario, note della cerimonia' },
  { key: 'receptionEnabled', label: 'Ricevimento', icon: '🍽️', desc: 'Dove si festeggia dopo' },
  { key: 'storyEnabled', label: 'La nostra storia', icon: '💕', desc: 'Come vi siete conosciuti' },
  { key: 'galleryEnabled', label: 'Galleria foto', icon: '📸', desc: 'Foto degli sposi' },
  { key: 'registryEnabled', label: 'Lista nozze', icon: '🎁', desc: 'IBAN, link, suggerimenti' },
  { key: 'rsvpEnabled', label: 'RSVP / Conferma', icon: '💌', desc: 'Conferma presenza invitati' },
  { key: 'dressCodeEnabled', label: 'Codice abbigliamento', icon: '👔', desc: 'Dress code suggerito' },
  { key: 'menuEnabled', label: 'Menu', icon: '🥂', desc: 'Info sul menu o allergie' },
  { key: 'hotelsEnabled', label: 'Hotel', icon: '🏨', desc: 'Dove dormire consigliati' },
  { key: 'playlistEnabled', label: 'Playlist', icon: '🎵', desc: 'Link Spotify o richieste' },
  { key: 'hashtagEnabled', label: 'Hashtag', icon: '#️⃣', desc: 'Hashtag social dell\'evento' },
  { key: 'countdownEnabled', label: 'Countdown', icon: '⏳', desc: 'Quanto manca al grande giorno' },
];

export default function SiteBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [draft, setDraft] = useState<any>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [c, setC] = useState<SiteContent>({});
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
      setSelectedTemplate(tRes.templates?.find((t: any) => t.id === d.template_id) ?? null);
      setC((prev: SiteContent) => ({ ...prev, ...(d.content as SiteContent) }));
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

  const updateC = (key: keyof SiteContent, val: any) => setC({ ...c, [key]: val });

  const handleSaveContent = async () => {
    if (!draft) return;
    setSaving(true);
    await updateDraft(draft.id, c as unknown as Record<string, string>);
    setSaving(false);
  };

  const handlePublish = async () => {
    if (!draft) return;
    await publishSite(draft.id);
    loadData();
  };

  const toggleSection = (key: string) => {
    const sectionKey = key as keyof SiteContent;
    updateC(sectionKey, !c[sectionKey]);
  };

  const pickPhrase = (section: SectionKey, phrase: string) => {
    const map: Record<string, keyof SiteContent> = {
      announcement: 'announcement',
      storyTitle: 'storyTitle',
      ceremonyNote: 'ceremonyNote',
      receptionNote: 'receptionNote',
      registryText: 'registryText',
      dressCodeText: 'dressCodeText',
      rsvpMessage: 'rsvpMessage',
    };
    const target = map[section];
    if (target) updateC(target, phrase);
  };

  const tpl = selectedTemplate;
  const palette = tpl?.palette ?? ['#d4a574', '#f5f0eb', '#1a1a2e', '#ffffff'];
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const SectionToggle = ({ section }: { section: typeof SECTION_META[0] }) => {
    const enabled = !!(c as any)[section.key];
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted transition-colors cursor-pointer" onClick={() => toggleSection(section.key)}>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${enabled ? 'bg-brand text-white' : 'bg-muted text-text-muted'}`}>{section.icon}</div>
        <div className="flex-1">
          <p className="font-medium text-sm">{section.label}</p>
          <p className="text-xs text-text-muted">{section.desc}</p>
        </div>
        <div className={`w-12 h-6 rounded-full transition-colors ${enabled ? 'bg-brand' : 'bg-border'} relative`}>
          <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${enabled ? 'left-6' : 'left-0.5'}`} />
        </div>
      </div>
    );
  };

  return (
    <main className="max-w-5xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sito invito digitale</h1>
          <p className="text-text-muted text-sm">Crea un biglietto d'invito moderno per i tuoi invitati</p>
        </div>
        <Button variant="outline" onClick={() => router.push(`/events/${id}`)}>← Evento</Button>
      </div>

      <div className="flex gap-2 border-b border-border pb-2">
        {(['templates', 'content', 'preview'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-t-md text-sm font-medium transition-colors ${tab === t ? 'bg-brand text-white' : 'hover:bg-muted text-text-muted'}`}>
            {t === 'templates' ? '🎨 Template' : t === 'content' ? '📝 Contenuti' : '👁️ Anteprima'}
          </button>
        ))}
      </div>

      {tab === 'templates' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t: any) => {
            const isSelected = draft?.template_id === t.id;
            return (
              <Card key={t.id} className={`cursor-pointer transition-all ${isSelected ? 'ring-2 ring-brand' : 'hover:shadow-md'}`} onClick={() => handleSelectTemplate(t)}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    {t.name}
                    {isSelected && <Badge>✓</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-1 mb-2">
                    {(t.palette as string[]).map((c: string, i: number) => (
                      <div key={i} className="w-6 h-6 rounded-full border border-border" style={{ background: c }} />
                    ))}
                  </div>
                  <p className="text-xs text-text-muted">Font: {t.font_family}</p>
                  <div className="mt-2 text-xs" style={{ fontFamily: t.font_family }}>
                    <p style={{ color: t.palette[0] }} className="font-bold">Giada & Gigi</p>
                    <p style={{ color: t.palette[2] }}>28 Agosto 2026</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {tab === 'content' && (
        <div className="space-y-6">
          {!draft && (
            <Card>
              <CardContent className="p-6 text-center text-text-muted">
                Seleziona prima un template per iniziare.
              </CardContent>
            </Card>
          )}

          {draft && (
            <>
              <Card>
                <CardHeader><CardTitle className="text-base">📢 Invito principale</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-text-muted">Nomi degli sposi</label>
                    <input className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm mt-1" value={c.coupleNames || ''} onChange={e => updateC('coupleNames', e.target.value)} placeholder="Giada & Gigi" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-muted">Frase di annuncio</label>
                    <input className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm mt-1" value={c.announcement || ''} onChange={e => updateC('announcement', e.target.value)} placeholder="Vi annunciano il loro matrimonio" />
                    <div className="flex flex-wrap gap-1 mt-1">
                      {SUGGESTED_PHRASES.announcement.map((p, i) => (
                        <button key={i} onClick={() => pickPhrase('announcement', p)} className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-brand hover:text-white transition-colors">{p}</button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-text-muted">Data</label>
                      <input type="date" className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm mt-1" value={c.date || ''} onChange={e => updateC('date', e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-text-muted">Orario</label>
                      <input type="time" className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm mt-1" value={c.time || ''} onChange={e => updateC('time', e.target.value)} />
                    </div>
                  </div>
                  {c.date && c.time && (
                    <a href={generateIcsLink(c.date, c.time || '12:00', `Matrimonio ${c.coupleNames || ''}`, '', '')} download="matrimonio.ics" className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-md bg-muted hover:bg-brand hover:text-white transition-colors">
                      📅 Scarica promemoria calendario
                    </a>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">⚙️ Sezioni</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {SECTION_META.map(s => <SectionToggle key={s.key} section={s} />)}
                </CardContent>
              </Card>

              {c.ceremonyEnabled && (
                <Card>
                  <CardHeader><CardTitle className="text-base">⛪ Cerimonia</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <input className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" value={c.ceremonyTitle || ''} onChange={e => updateC('ceremonyTitle', e.target.value)} placeholder="Titolo (es. Chiesa SS Mediatrice)" />
                    <input className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" value={c.ceremonyAddress || ''} onChange={e => updateC('ceremonyAddress', e.target.value)} placeholder="Indirizzo completo" />
                    <input type="time" className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" value={c.ceremonyTime || ''} onChange={e => updateC('ceremonyTime', e.target.value)} placeholder="Orario" />
                    <textarea className="w-full min-h-[60px] rounded-md border border-border bg-surface px-3 py-2 text-sm" value={c.ceremonyNote || ''} onChange={e => updateC('ceremonyNote', e.target.value)} placeholder="Note sulla cerimonia..." />
                    <div className="flex flex-wrap gap-1">
                      {SUGGESTED_PHRASES.ceremonyNote.map((p, i) => (
                        <button key={i} onClick={() => pickPhrase('ceremonyNote', p)} className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-brand hover:text-white transition-colors">{p}</button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {c.receptionEnabled && (
                <Card>
                  <CardHeader><CardTitle className="text-base">🍽️ Ricevimento</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <input className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" value={c.receptionTitle || ''} onChange={e => updateC('receptionTitle', e.target.value)} placeholder="Nome location" />
                    <input className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" value={c.receptionAddress || ''} onChange={e => updateC('receptionAddress', e.target.value)} placeholder="Indirizzo" />
                    <input type="time" className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" value={c.receptionTime || ''} onChange={e => updateC('receptionTime', e.target.value)} placeholder="Orario" />
                    <textarea className="w-full min-h-[60px] rounded-md border border-border bg-surface px-3 py-2 text-sm" value={c.receptionNote || ''} onChange={e => updateC('receptionNote', e.target.value)} placeholder="Note ricevimento..." />
                    <div className="flex flex-wrap gap-1">
                      {SUGGESTED_PHRASES.receptionNote.map((p, i) => (
                        <button key={i} onClick={() => pickPhrase('receptionNote', p)} className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-brand hover:text-white transition-colors">{p}</button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {c.storyEnabled && (
                <Card>
                  <CardHeader><CardTitle className="text-base">💕 La nostra storia</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <input className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" value={c.storyTitle || ''} onChange={e => updateC('storyTitle', e.target.value)} placeholder="Titolo (es. Come tutto è iniziato)" />
                    <div className="flex flex-wrap gap-1">
                      {SUGGESTED_PHRASES.storyTitle.map((p, i) => (
                        <button key={i} onClick={() => pickPhrase('storyTitle', p)} className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-brand hover:text-white transition-colors">{p}</button>
                      ))}
                    </div>
                    <textarea className="w-full min-h-[120px] rounded-md border border-border bg-surface px-3 py-2 text-sm" value={c.storyBody || ''} onChange={e => updateC('storyBody', e.target.value)} placeholder="Scrivi la vostra storia..." />
                  </CardContent>
                </Card>
              )}

              {c.registryEnabled && (
                <Card>
                  <CardHeader><CardTitle className="text-base">🎁 Lista nozze</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <textarea className="w-full min-h-[60px] rounded-md border border-border bg-surface px-3 py-2 text-sm" value={c.registryText || ''} onChange={e => updateC('registryText', e.target.value)} placeholder="Testo di ringraziamento..." />
                    <div className="flex flex-wrap gap-1">
                      {SUGGESTED_PHRASES.registryText.map((p, i) => (
                        <button key={i} onClick={() => pickPhrase('registryText', p)} className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-brand hover:text-white transition-colors">{p}</button>
                      ))}
                    </div>
                    <input className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" value={c.registryIban || ''} onChange={e => updateC('registryIban', e.target.value)} placeholder="IBAN (opzionale)" />
                    <input className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" value={c.registryIntestatario || ''} onChange={e => updateC('registryIntestatario', e.target.value)} placeholder="Intestatario conto" />
                    <input className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" value={c.registryLink || ''} onChange={e => updateC('registryLink', e.target.value)} placeholder="Link lista nozze esterna" />
                  </CardContent>
                </Card>
              )}

              {c.rsvpEnabled && (
                <Card>
                  <CardHeader><CardTitle className="text-base">💌 RSVP</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <textarea className="w-full min-h-[60px] rounded-md border border-border bg-surface px-3 py-2 text-sm" value={c.rsvpMessage || ''} onChange={e => updateC('rsvpMessage', e.target.value)} placeholder="Messaggio di conferma..." />
                    <div className="flex flex-wrap gap-1">
                      {SUGGESTED_PHRASES.rsvpMessage.map((p, i) => (
                        <button key={i} onClick={() => pickPhrase('rsvpMessage', p)} className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-brand hover:text-white transition-colors">{p}</button>
                      ))}
                    </div>
                    <input className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" value={c.rsvpEmail || ''} onChange={e => updateC('rsvpEmail', e.target.value)} placeholder="Email per conferme" />
                    <input className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" value={c.rsvpDeadline || ''} onChange={e => updateC('rsvpDeadline', e.target.value)} type="date" placeholder="Data limite conferma" />
                  </CardContent>
                </Card>
              )}

              {c.dressCodeEnabled && (
                <Card>
                  <CardHeader><CardTitle className="text-base">👔 Codice abbigliamento</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <input className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" value={c.dressCodeText || ''} onChange={e => updateC('dressCodeText', e.target.value)} placeholder="Es. Elegante, Formal, Casual chic..." />
                    <div className="flex flex-wrap gap-1">
                      {SUGGESTED_PHRASES.dressCodeText.map((p, i) => (
                        <button key={i} onClick={() => pickPhrase('dressCodeText', p)} className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-brand hover:text-white transition-colors">{p}</button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {c.menuEnabled && (
                <Card>
                  <CardHeader><CardTitle className="text-base">🥂 Menu</CardTitle></CardHeader>
                  <CardContent>
                    <textarea className="w-full min-h-[80px] rounded-md border border-border bg-surface px-3 py-2 text-sm" value={c.menuText || ''} onChange={e => updateC('menuText', e.target.value)} placeholder="Descrizione del menu, allergie o preferenze..." />
                  </CardContent>
                </Card>
              )}

              {c.hotelsEnabled && (
                <Card>
                  <CardHeader><CardTitle className="text-base">🏨 Hotel</CardTitle></CardHeader>
                  <CardContent>
                    <textarea className="w-full min-h-[80px] rounded-md border border-border bg-surface px-3 py-2 text-sm" value={c.hotelsText || ''} onChange={e => updateC('hotelsText', e.target.value)} placeholder="Suggerimenti hotel, convenzioni, codici sconto..." />
                  </CardContent>
                </Card>
              )}

              {c.playlistEnabled && (
                <Card>
                  <CardHeader><CardTitle className="text-base">🎵 Playlist</CardTitle></CardHeader>
                  <CardContent>
                    <input className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" value={c.playlistLink || ''} onChange={e => updateC('playlistLink', e.target.value)} placeholder="Link Spotify / Apple Music" />
                  </CardContent>
                </Card>
              )}

              {c.hashtagEnabled && (
                <Card>
                  <CardHeader><CardTitle className="text-base">#️⃣ Hashtag</CardTitle></CardHeader>
                  <CardContent>
                    <input className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" value={c.hashtag || ''} onChange={e => updateC('hashtag', e.target.value)} placeholder="#NostroHashtag" />
                  </CardContent>
                </Card>
              )}

              <div className="flex gap-2">
                <Button onClick={handleSaveContent} disabled={saving}>{saving ? 'Salvataggio...' : '💾 Salva contenuti'}</Button>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'preview' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>👁️ Anteprima sito invito</CardTitle>
            {draft && <Button onClick={handlePublish}>{draft.published ? 'Ripubblica' : 'Pubblica sito'}</Button>}
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border overflow-hidden" style={{ fontFamily: tpl?.font_family ?? 'inherit' }}>
              <div className="p-12 text-center" style={{ background: `linear-gradient(135deg, ${palette[1]}, ${palette[3]})`, color: palette[2] }}>
                <p className="text-sm uppercase tracking-[0.3em] mb-4" style={{ color: palette[0] }}>{c.announcement || 'Vi annunciano il loro matrimonio'}</p>
                <h2 className="text-4xl md:text-5xl font-bold mb-4" style={{ color: palette[2] }}>{c.coupleNames || 'Giada & Gigi'}</h2>
                <div className="w-16 h-0.5 mx-auto mb-4" style={{ background: palette[0] }} />
                <p className="text-lg">{c.date ? new Date(c.date).toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '28 Agosto 2026'}{c.time ? ` · ${c.time}` : ''}</p>
                {c.date && c.time && (
                  <a href={generateIcsLink(c.date, c.time || '12:00', `Matrimonio ${c.coupleNames || ''}`, '', '')} download="matrimonio.ics" className="inline-flex items-center gap-2 mt-4 text-sm px-4 py-2 rounded-full transition-colors" style={{ background: palette[0], color: '#fff' }}>
                    📅 Aggiungi al calendario
                  </a>
                )}
              </div>

              {c.ceremonyEnabled && (
                <div className="p-8" style={{ background: palette[3], color: palette[2] }}>
                  <h3 className="text-xl font-semibold mb-4" style={{ color: palette[0] }}>⛪ {c.ceremonyTitle || 'Cerimonia'}</h3>
                  {c.ceremonyAddress && <p className="mb-1">{c.ceremonyAddress}</p>}
                  {c.ceremonyTime && <p className="text-sm opacity-70 mb-2">Ore {c.ceremonyTime}</p>}
                  {c.ceremonyNote && <p className="text-sm opacity-80">{c.ceremonyNote}</p>}
                </div>
              )}

              {c.receptionEnabled && (
                <div className="p-8" style={{ background: palette[1], color: palette[2] }}>
                  <h3 className="text-xl font-semibold mb-4" style={{ color: palette[0] }}>🍽️ {c.receptionTitle || 'Ricevimento'}</h3>
                  {c.receptionAddress && <p className="mb-1">{c.receptionAddress}</p>}
                  {c.receptionTime && <p className="text-sm opacity-70 mb-2">Ore {c.receptionTime}</p>}
                  {c.receptionNote && <p className="text-sm opacity-80">{c.receptionNote}</p>}
                </div>
              )}

              {c.storyEnabled && (
                <div className="p-8" style={{ background: palette[3], color: palette[2] }}>
                  <h3 className="text-xl font-semibold mb-4" style={{ color: palette[0] }}>💕 {c.storyTitle || 'La nostra storia'}</h3>
                  <p className="text-sm leading-relaxed">{c.storyBody || 'Racconta la vostra storia...'}</p>
                </div>
              )}

              {c.registryEnabled && (
                <div className="p-8 text-center" style={{ background: palette[1], color: palette[2] }}>
                  <h3 className="text-xl font-semibold mb-4" style={{ color: palette[0] }}>🎁 Lista nozze</h3>
                  <p className="text-sm mb-3">{c.registryText || ''}</p>
                  {c.registryIban && <p className="text-xs opacity-70 font-mono">IBAN: {c.registryIban}</p>}
                  {c.registryLink && <a href={c.registryLink} target="_blank" className="text-sm underline mt-2 inline-block">Vai alla lista nozze ↗</a>}
                </div>
              )}

              {c.dressCodeEnabled && c.dressCodeText && (
                <div className="p-8 text-center" style={{ background: palette[3], color: palette[2] }}>
                  <p className="text-sm">👔 <strong>Codice abbigliamento:</strong> {c.dressCodeText}</p>
                </div>
              )}

              {c.menuEnabled && c.menuText && (
                <div className="p-8" style={{ background: palette[1], color: palette[2] }}>
                  <h3 className="text-lg font-semibold mb-2" style={{ color: palette[0] }}>🥂 Menu</h3>
                  <p className="text-sm">{c.menuText}</p>
                </div>
              )}

              {c.hotelsEnabled && c.hotelsText && (
                <div className="p-8" style={{ background: palette[3], color: palette[2] }}>
                  <h3 className="text-lg font-semibold mb-2" style={{ color: palette[0] }}>🏨 Hotel</h3>
                  <p className="text-sm">{c.hotelsText}</p>
                </div>
              )}

              {c.playlistEnabled && c.playlistLink && (
                <div className="p-8 text-center" style={{ background: palette[1], color: palette[2] }}>
                  <h3 className="text-lg font-semibold mb-2" style={{ color: palette[0] }}>🎵 Playlist</h3>
                  <a href={c.playlistLink} target="_blank" className="text-sm underline">Ascolta la playlist ↗</a>
                </div>
              )}

              {c.rsvpEnabled && (
                <div className="p-8 text-center" style={{ background: palette[3], color: palette[2] }}>
                  <h3 className="text-xl font-semibold mb-4" style={{ color: palette[0] }}>💌 RSVP</h3>
                  <p className="text-sm mb-3">{c.rsvpMessage || 'Conferma la tua presenza'}</p>
                  {c.rsvpDeadline && <p className="text-xs opacity-70">Entro il {new Date(c.rsvpDeadline).toLocaleDateString('it-IT')}</p>}
                  {c.rsvpEmail && <a href={`mailto:${c.rsvpEmail}`} className="inline-block mt-3 text-sm px-6 py-2 rounded-full transition-colors" style={{ background: palette[0], color: '#fff' }}>Conferma ora</a>}
                </div>
              )}

              {c.hashtagEnabled && c.hashtag && (
                <div className="p-4 text-center text-sm" style={{ background: palette[2], color: palette[3] }}>
                  <p>Seguici con l'hashtag <strong>{c.hashtag}</strong></p>
                </div>
              )}

              <div className="p-6 text-center text-xs opacity-50" style={{ background: palette[1], color: palette[2] }}>
                <p>FotoSposi · Sito invito digitale</p>
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
