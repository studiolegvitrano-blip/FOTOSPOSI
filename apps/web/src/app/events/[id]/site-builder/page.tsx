'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { getCurrentUser, createClient } from '@fotosposi/core';
import { getTemplates, getDraft, createDraft, updateDraft, updateDraftTemplate, publishSite } from '@fotosposi/site-builder';
import type { SiteContent } from '@fotosposi/site-builder';
import { SUGGESTED_PHRASES, generateIcsLink } from '@fotosposi/site-builder';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Heart, Church, GlassWater, Image, Gift, Mail, Shirt, Utensils, Hotel, Music, Hash, Clock, MapPin, Calendar, Bell, Sparkles, Save, Eye, Edit, Layout, Check, Settings, Phone, HelpCircle, Users, Plus, Trash2 } from 'lucide-react';

type SectionKey = keyof typeof SUGGESTED_PHRASES;

const SECTION_META: { key: string; sectionKey: string }[] = [
  { key: 'ceremonyEnabled', sectionKey: 'ceremony' },
  { key: 'receptionEnabled', sectionKey: 'reception' },
  { key: 'storyEnabled', sectionKey: 'story' },
  { key: 'galleryEnabled', sectionKey: 'gallery' },
  { key: 'registryEnabled', sectionKey: 'registry' },
  { key: 'rsvpEnabled', sectionKey: 'rsvp' },
  { key: 'dressCodeEnabled', sectionKey: 'dress_code' },
  { key: 'menuEnabled', sectionKey: 'menu' },
  { key: 'hotelsEnabled', sectionKey: 'hotels' },
  { key: 'playlistEnabled', sectionKey: 'playlist' },
  { key: 'hashtagEnabled', sectionKey: 'hashtag' },
  { key: 'countdownEnabled', sectionKey: 'countdown' },
  { key: 'navettaEnabled', sectionKey: 'navetta' },
  { key: 'faqEnabled', sectionKey: 'faq' },
  { key: 'weddingPartyEnabled', sectionKey: 'wedding_party' },
];

const SECTION_ICONS: Record<string, React.ReactNode> = {
  ceremonyEnabled: <Church className="w-5 h-5" />,
  receptionEnabled: <GlassWater className="w-5 h-5" />,
  storyEnabled: <Heart className="w-5 h-5" />,
  galleryEnabled: <Image className="w-5 h-5" />,
  registryEnabled: <Gift className="w-5 h-5" />,
  rsvpEnabled: <Mail className="w-5 h-5" />,
  dressCodeEnabled: <Shirt className="w-5 h-5" />,
  menuEnabled: <Utensils className="w-5 h-5" />,
  hotelsEnabled: <Hotel className="w-5 h-5" />,
  playlistEnabled: <Music className="w-5 h-5" />,
  hashtagEnabled: <Hash className="w-5 h-5" />,
  countdownEnabled: <Clock className="w-5 h-5" />,
  navettaEnabled: <MapPin className="w-5 h-5" />,
  faqEnabled: <HelpCircle className="w-5 h-5" />,
  weddingPartyEnabled: <Users className="w-5 h-5" />,
};

const SECTION_LABEL_KEYS: Record<string, string> = {
  ceremony: 'ceremony_section',
  reception: 'reception_section',
  story: 'story_section',
  gallery: 'gallery_section',
  registry: 'registry_section',
  rsvp: 'rsvp_section',
  dress_code: 'dress_code_section',
  menu: 'menu_section',
  hotels: 'hotels_section',
  playlist: 'playlist_section',
  hashtag: 'hashtag_section',
  countdown: 'countdown',
  navetta: 'navetta_section',
  faq: 'faq_section',
  wedding_party: 'wedding_party_section',
};

export default function SiteBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations('site_builder');
  const c = useTranslations('common');
  const [user, setUser] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [draft, setDraft] = useState<any>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [content, setContent] = useState<SiteContent>({});
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
    const [tRes, dRes, eventRes] = await Promise.all([
      getTemplates(),
      getDraft(id),
      createClient().from('events').select('couple_name, date').eq('id', id).single(),
    ]);
    if (tRes.templates) setTemplates(tRes.templates);
    const eventData = eventRes.data as { couple_name?: string; date?: string } | null;
    const prefill: SiteContent = {};
    if (eventData?.couple_name) prefill.coupleNames = eventData.couple_name;
    if (eventData?.date) prefill.date = eventData.date;
    const d = dRes.draft;
    if (d) {
      setDraft(d);
      setSelectedTemplate(tRes.templates?.find((tpl: any) => tpl.id === d.template_id) ?? null);
      setContent((prev: SiteContent) => ({ ...prev, ...prefill, ...(d.content as SiteContent) }));
    } else {
      setContent(prefill);
    }
  };

  const handleSelectTemplate = async (tpl: any) => {
    setSelectedTemplate(tpl);
    if (!draft) {
      const r = await createDraft(id, tpl.id);
      if (r.draft) setDraft(r.draft);
    } else {
      await updateDraftTemplate(draft.id, tpl.id);
      setDraft({ ...draft, template_id: tpl.id });
    }
  };

  const updateC = (key: keyof SiteContent, val: any) => setContent({ ...content, [key]: val });

  const handleSaveContent = async () => {
    if (!draft) return;
    setSaving(true);
    await updateDraft(draft.id, content as unknown as Record<string, string>);
    setSaving(false);
  };

  const handlePublish = async () => {
    if (!draft) return;
    await publishSite(draft.id);
    loadData();
  };

  const toggleSection = (key: string) => {
    const sectionKey = key as keyof SiteContent;
    updateC(sectionKey, !content[sectionKey]);
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
    const enabled = !!(content as any)[section.key];
    const label = t(SECTION_LABEL_KEYS[section.sectionKey] || section.sectionKey);
    const desc = t(`${section.sectionKey}_desc` as any);
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted transition-colors cursor-pointer" onClick={() => toggleSection(section.key)}>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${enabled ? 'bg-brand text-white' : 'bg-muted text-text-muted'}`}>{SECTION_ICONS[section.key]}</div>
        <div className="flex-1">
          <p className="font-medium text-sm">{label}</p>
          <p className="text-xs text-text-muted">{desc}</p>
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
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-text-muted text-sm">{t('subtitle')}</p>
        </div>
        <Button variant="outline" onClick={() => router.push(`/events/${id}`)}>{t('back_to_event')}</Button>
      </div>

      <div className="flex gap-2 border-b border-border pb-2">
        {(['templates', 'content', 'preview'] as const).map(tk => (
          <button key={tk} onClick={() => setTab(tk)} className={`px-4 py-2 rounded-t-md text-sm font-medium transition-colors ${tab === tk ? 'bg-brand text-white' : 'hover:bg-muted text-text-muted'}`}>
            {tk === 'templates' ? <><Layout className="w-4 h-4 inline" /> {t('template_tab')}</> : tk === 'content' ? <><Edit className="w-4 h-4 inline" /> {t('content_tab')}</> : <><Eye className="w-4 h-4 inline" /> {t('preview_tab')}</>}
          </button>
        ))}
      </div>

      {tab === 'templates' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tplItem: any) => {
            const isSelected = draft?.template_id === tplItem.id;
            return (
              <Card key={tplItem.id} className={`cursor-pointer transition-all ${isSelected ? 'ring-2 ring-brand' : 'hover:shadow-md'}`} onClick={() => handleSelectTemplate(tplItem)}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    {tplItem.name}
                    {isSelected && <Badge><Check className="w-3 h-3" /></Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-1 mb-2">
                    {(tplItem.palette as string[]).map((clr: string, i: number) => (
                      <div key={i} className="w-6 h-6 rounded-full border border-border" style={{ background: clr }} />
                    ))}
                  </div>
                  <p className="text-xs text-text-muted">{t('font_label')} {tplItem.font_family}</p>
                  <div className="mt-2 text-xs" style={{ fontFamily: tplItem.font_family }}>
                    <p style={{ color: palette[0] }} className="font-bold">{content.coupleNames || 'Giada & Gigi'}</p>
                    <p style={{ color: palette[2] }}>{content.date || '28 Agosto 2026'}</p>
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
                {t('select_template_first')}
              </CardContent>
            </Card>
          )}

          {draft && (
            <>
              <Card>
                <CardHeader><CardTitle className="text-base"><Bell className="w-4 h-4 inline" /> {t('main_invitation')}</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-text-muted">{t('couple_names')}</label>
                    <input className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm mt-1" value={content.coupleNames || ''} onChange={e => updateC('coupleNames', e.target.value)} placeholder="Giada & Gigi" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-muted">{t('announcement_label')}</label>
                    <input className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm mt-1" value={content.announcement || ''} onChange={e => updateC('announcement', e.target.value)} placeholder={t('announcement_ph')} />
                    <div className="flex flex-wrap gap-1 mt-1">
                      {SUGGESTED_PHRASES.announcement.map((p, i) => (
                        <button key={i} onClick={() => pickPhrase('announcement', p)} className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-brand hover:text-white transition-colors">{p}</button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-text-muted">{t('date_label')}</label>
                      <input type="date" className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm mt-1" value={content.date || ''} onChange={e => updateC('date', e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-text-muted">{t('time_label')}</label>
                      <input type="time" className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm mt-1" value={content.time || ''} onChange={e => updateC('time', e.target.value)} />
                    </div>
                  </div>
                  {content.date && content.time && (
                    <a href={generateIcsLink(content.date, content.time || '12:00', `Matrimonio ${content.coupleNames || ''}`, '', '')} download="matrimonio.ics" className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-md bg-muted hover:bg-brand hover:text-white transition-colors">
                      <Calendar className="w-4 h-4 inline" /> {t('download_calendar')}
                    </a>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base"><Settings className="w-4 h-4 inline" /> {t('sections_heading')}</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {SECTION_META.map(s => <SectionToggle key={s.key} section={s} />)}
                </CardContent>
              </Card>

              {content.ceremonyEnabled && (
                <Card>
                  <CardHeader><CardTitle className="text-base"><Church className="w-4 h-4 inline" /> {t('ceremony_section')}</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <input className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" value={content.ceremonyTitle || ''} onChange={e => updateC('ceremonyTitle', e.target.value)} placeholder={t('ceremony_title_ph')} />
                    <input className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" value={content.ceremonyAddress || ''} onChange={e => updateC('ceremonyAddress', e.target.value)} placeholder={t('ceremony_address_ph')} />
                    <input type="time" className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" value={content.ceremonyTime || ''} onChange={e => updateC('ceremonyTime', e.target.value)} />
                    <textarea className="w-full min-h-[60px] rounded-md border border-border bg-surface px-3 py-2 text-sm" value={content.ceremonyNote || ''} onChange={e => updateC('ceremonyNote', e.target.value)} placeholder={t('ceremony_note_ph')} />
                    <div className="flex flex-wrap gap-1">
                      {SUGGESTED_PHRASES.ceremonyNote.map((p, i) => (
                        <button key={i} onClick={() => pickPhrase('ceremonyNote', p)} className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-brand hover:text-white transition-colors">{p}</button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {content.receptionEnabled && (
                <Card>
                  <CardHeader><CardTitle className="text-base"><GlassWater className="w-4 h-4 inline" /> {t('reception_section')}</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <input className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" value={content.receptionTitle || ''} onChange={e => updateC('receptionTitle', e.target.value)} placeholder={t('reception_title_ph')} />
                    <input className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" value={content.receptionAddress || ''} onChange={e => updateC('receptionAddress', e.target.value)} placeholder={t('reception_address_ph')} />
                    <input type="time" className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" value={content.receptionTime || ''} onChange={e => updateC('receptionTime', e.target.value)} />
                    <textarea className="w-full min-h-[60px] rounded-md border border-border bg-surface px-3 py-2 text-sm" value={content.receptionNote || ''} onChange={e => updateC('receptionNote', e.target.value)} placeholder={t('reception_note_ph')} />
                    <div className="flex flex-wrap gap-1">
                      {SUGGESTED_PHRASES.receptionNote.map((p, i) => (
                        <button key={i} onClick={() => pickPhrase('receptionNote', p)} className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-brand hover:text-white transition-colors">{p}</button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {content.storyEnabled && (
                <Card>
                  <CardHeader><CardTitle className="text-base"><Heart className="w-4 h-4 inline" /> {t('story_section')}</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <input className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" value={content.storyTitle || ''} onChange={e => updateC('storyTitle', e.target.value)} placeholder={t('story_title_ph')} />
                    <div className="flex flex-wrap gap-1">
                      {SUGGESTED_PHRASES.storyTitle.map((p, i) => (
                        <button key={i} onClick={() => pickPhrase('storyTitle', p)} className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-brand hover:text-white transition-colors">{p}</button>
                      ))}
                    </div>
                    <textarea className="w-full min-h-[120px] rounded-md border border-border bg-surface px-3 py-2 text-sm" value={content.storyBody || ''} onChange={e => updateC('storyBody', e.target.value)} placeholder={t('story_body_ph')} />
                  </CardContent>
                </Card>
              )}

              {content.registryEnabled && (
                <Card>
                  <CardHeader><CardTitle className="text-base"><Gift className="w-4 h-4 inline" /> {t('registry_section')}</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <textarea className="w-full min-h-[60px] rounded-md border border-border bg-surface px-3 py-2 text-sm" value={content.registryText || ''} onChange={e => updateC('registryText', e.target.value)} placeholder={t('registry_text_ph')} />
                    <div className="flex flex-wrap gap-1">
                      {SUGGESTED_PHRASES.registryText.map((p, i) => (
                        <button key={i} onClick={() => pickPhrase('registryText', p)} className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-brand hover:text-white transition-colors">{p}</button>
                      ))}
                    </div>
                    <input className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" value={content.registryIban || ''} onChange={e => updateC('registryIban', e.target.value)} placeholder={t('registry_iban_ph')} />
                    <input className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" value={content.registryIntestatario || ''} onChange={e => updateC('registryIntestatario', e.target.value)} placeholder={t('registry_iban_holder_ph')} />
                    <input className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" value={content.registryLink || ''} onChange={e => updateC('registryLink', e.target.value)} placeholder={t('registry_link_ph')} />
                  </CardContent>
                </Card>
              )}

              {content.rsvpEnabled && (
                <Card>
                  <CardHeader><CardTitle className="text-base"><Mail className="w-4 h-4 inline" /> {t('rsvp_section')}</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <textarea className="w-full min-h-[60px] rounded-md border border-border bg-surface px-3 py-2 text-sm" value={content.rsvpMessage || ''} onChange={e => updateC('rsvpMessage', e.target.value)} placeholder={t('rsvp_message_ph')} />
                    <div className="flex flex-wrap gap-1">
                      {SUGGESTED_PHRASES.rsvpMessage.map((p, i) => (
                        <button key={i} onClick={() => pickPhrase('rsvpMessage', p)} className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-brand hover:text-white transition-colors">{p}</button>
                      ))}
                    </div>
                    <input className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" value={content.rsvpEmail || ''} onChange={e => updateC('rsvpEmail', e.target.value)} placeholder={t('rsvp_email_ph')} />
                    <input className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" value={content.rsvpWhatsapp || ''} onChange={e => updateC('rsvpWhatsapp', e.target.value)} placeholder={t('rsvp_whatsapp_ph')} />
                    <input className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" value={content.rsvpDeadline || ''} onChange={e => updateC('rsvpDeadline', e.target.value)} type="date" />
                  </CardContent>
                </Card>
              )}

              {content.dressCodeEnabled && (
                <Card>
                  <CardHeader><CardTitle className="text-base"><Shirt className="w-4 h-4 inline" /> {t('dress_code_section')}</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <input className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" value={content.dressCodeText || ''} onChange={e => updateC('dressCodeText', e.target.value)} placeholder={t('dress_code_ph')} />
                    <div className="flex flex-wrap gap-1">
                      {SUGGESTED_PHRASES.dressCodeText.map((p, i) => (
                        <button key={i} onClick={() => pickPhrase('dressCodeText', p)} className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-brand hover:text-white transition-colors">{p}</button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {content.menuEnabled && (
                <Card>
                  <CardHeader><CardTitle className="text-base"><Utensils className="w-4 h-4 inline" /> {t('menu_section')}</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <textarea className="w-full min-h-[80px] rounded-md border border-border bg-surface px-3 py-2 text-sm" value={content.menuText || ''} onChange={e => updateC('menuText', e.target.value)} placeholder={t('menu_text_ph')} />
                    <textarea className="w-full min-h-[60px] rounded-md border border-border bg-surface px-3 py-2 text-sm" value={content.menuAllergens || ''} onChange={e => updateC('menuAllergens', e.target.value)} placeholder={t('menu_allergens_ph')} />
                  </CardContent>
                </Card>
              )}

              {content.hotelsEnabled && (
                <Card>
                  <CardHeader><CardTitle className="text-base"><Hotel className="w-4 h-4 inline" /> {t('hotels_section')}</CardTitle></CardHeader>
                  <CardContent>
                    <textarea className="w-full min-h-[80px] rounded-md border border-border bg-surface px-3 py-2 text-sm" value={content.hotelsText || ''} onChange={e => updateC('hotelsText', e.target.value)} placeholder={t('hotels_ph')} />
                  </CardContent>
                </Card>
              )}

              {content.playlistEnabled && (
                <Card>
                  <CardHeader><CardTitle className="text-base"><Music className="w-4 h-4 inline" /> {t('playlist_section')}</CardTitle></CardHeader>
                  <CardContent>
                    <input className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" value={content.playlistLink || ''} onChange={e => updateC('playlistLink', e.target.value)} placeholder={t('playlist_ph')} />
                  </CardContent>
                </Card>
              )}

              {content.hashtagEnabled && (
                <Card>
                  <CardHeader><CardTitle className="text-base"><Hash className="w-4 h-4 inline" /> {t('hashtag_section')}</CardTitle></CardHeader>
                  <CardContent>
                    <input className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" value={content.hashtag || ''} onChange={e => updateC('hashtag', e.target.value)} placeholder={t('hashtag_ph')} />
                  </CardContent>
                </Card>
              )}

              {content.faqEnabled && (
                <Card>
                  <CardHeader><CardTitle className="text-base"><HelpCircle className="w-4 h-4 inline" /> FAQ</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {((content.faqEntries as any[]) || []).map((entry: any, i: number) => (
                      <div key={i} className="p-3 rounded-lg border border-border space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-text-muted">Domanda {i + 1}</span>
                          <button onClick={() => {
                            const entries = [...((content.faqEntries as any[]) || [])];
                            entries.splice(i, 1);
                            updateC('faqEntries', entries);
                          }} className="text-red-500 hover:text-red-700">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <input className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" value={entry.question || ''} onChange={e => {
                          const entries = [...((content.faqEntries as any[]) || [])];
                          entries[i] = { ...entries[i], question: e.target.value };
                          updateC('faqEntries', entries);
                        }} placeholder="Domanda" />
                        <textarea className="w-full min-h-[60px] rounded-md border border-border bg-surface px-3 py-2 text-sm" value={entry.answer || ''} onChange={e => {
                          const entries = [...((content.faqEntries as any[]) || [])];
                          entries[i] = { ...entries[i], answer: e.target.value };
                          updateC('faqEntries', entries);
                        }} placeholder="Risposta" />
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => updateC('faqEntries', [...((content.faqEntries as any[]) || []), { question: '', answer: '' }])}>
                      <Plus className="w-4 h-4 mr-1" /> Aggiungi domanda
                    </Button>
                  </CardContent>
                </Card>
              )}

              {content.weddingPartyEnabled && (
                <Card>
                  <CardHeader><CardTitle className="text-base"><Users className="w-4 h-4 inline" /> Wedding Party</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {((content.weddingPartyMembers as any[]) || []).map((member: any, i: number) => (
                      <div key={i} className="p-3 rounded-lg border border-border space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-text-muted">Membro {i + 1}</span>
                          <button onClick={() => {
                            const members = [...((content.weddingPartyMembers as any[]) || [])];
                            members.splice(i, 1);
                            updateC('weddingPartyMembers', members);
                          }} className="text-red-500 hover:text-red-700">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <input className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" value={member.name || ''} onChange={e => {
                          const members = [...((content.weddingPartyMembers as any[]) || [])];
                          members[i] = { ...members[i], name: e.target.value };
                          updateC('weddingPartyMembers', members);
                        }} placeholder="Nome" />
                        <input className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" value={member.role || ''} onChange={e => {
                          const members = [...((content.weddingPartyMembers as any[]) || [])];
                          members[i] = { ...members[i], role: e.target.value };
                          updateC('weddingPartyMembers', members);
                        }} placeholder="Ruolo (es. Testimone, Damigella)" />
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => updateC('weddingPartyMembers', [...((content.weddingPartyMembers as any[]) || []), { name: '', role: '' }])}>
                      <Plus className="w-4 h-4 mr-1" /> Aggiungi membro
                    </Button>
                  </CardContent>
                </Card>
              )}

              {content.navettaEnabled && (
                <Card>
                  <CardHeader><CardTitle className="text-base"><MapPin className="w-4 h-4 inline" /> {t('navetta_section')}</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <textarea className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" rows={2} value={content.navettaOrari || ''} onChange={e => updateC('navettaOrari', e.target.value)} placeholder={t('navetta_orari_ph')} />
                    <div className="flex flex-wrap gap-1">
                      {SUGGESTED_PHRASES.navettaOrari.map((p, i) => (
                        <button key={i} type="button" className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-brand/10 transition-colors" onClick={() => updateC('navettaOrari', p)}>{p}</button>
                      ))}
                    </div>
                    <input className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" value={content.navettaMappa || ''} onChange={e => updateC('navettaMappa', e.target.value)} placeholder={t('navetta_mappa_ph')} />
                    <textarea className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" rows={2} value={content.navettaNote || ''} onChange={e => updateC('navettaNote', e.target.value)} placeholder={t('navetta_note_ph')} />
                    <div className="flex flex-wrap gap-1">
                      {SUGGESTED_PHRASES.navettaNote.map((p, i) => (
                        <button key={i} type="button" className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-brand/10 transition-colors" onClick={() => updateC('navettaNote', p)}>{p}</button>
                      ))}
                    </div>
                    <input className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" value={content.navettaContatti || ''} onChange={e => updateC('navettaContatti', e.target.value)} placeholder={t('navetta_contatti_ph')} />
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={content.navettaMatchmaking || false} onChange={e => updateC('navettaMatchmaking', e.target.checked)} />
                      <span>{t('navetta_matchmaking_label')}</span>
                    </label>
                  </CardContent>
                </Card>
              )}

              <div className="flex gap-2">
                <Button onClick={handleSaveContent} disabled={saving}>{saving ? t('saving') : <><Save className="w-4 h-4 inline" /> {t('save_content')}</>}</Button>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'preview' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle><Eye className="w-4 h-4 inline" /> {t('preview_heading')}</CardTitle>
            {draft && <Button onClick={handlePublish}>{draft.published ? t('republish') : t('publish_site')}</Button>}
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border overflow-hidden" style={{ fontFamily: tpl?.font_family ?? 'inherit' }}>
              <div className="p-12 text-center" style={{ background: `linear-gradient(135deg, ${palette[1]}, ${palette[3]})`, color: palette[2] }}>
                <p className="text-sm uppercase tracking-[0.3em] mb-4" style={{ color: palette[0] }}>{content.announcement || t('announcement_ph')}</p>
                <h2 className="text-4xl md:text-5xl font-bold mb-4" style={{ color: palette[2] }}>{content.coupleNames || 'Giada & Gigi'}</h2>
                <div className="w-16 h-0.5 mx-auto mb-4" style={{ background: palette[0] }} />
                <p className="text-lg">{content.date ? new Date(content.date).toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '28 Agosto 2026'}{content.time ? ` · ${content.time}` : ''}</p>
                {content.date && content.time && (
                  <a href={generateIcsLink(content.date, content.time || '12:00', `Matrimonio ${content.coupleNames || ''}`, '', '')} download="matrimonio.ics" className="inline-flex items-center gap-2 mt-4 text-sm px-4 py-2 rounded-full transition-colors" style={{ background: palette[0], color: '#fff' }}>
                    <Calendar className="w-4 h-4 inline" /> {t('add_to_calendar')}
                  </a>
                )}
              </div>

              {content.ceremonyEnabled && (
                <div className="p-8" style={{ background: palette[3], color: palette[2] }}>
                  <h3 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: palette[0] }}><Church className="w-5 h-5" /> {content.ceremonyTitle || t('ceremony_section')}</h3>
                  {content.ceremonyAddress && <p className="mb-1">{content.ceremonyAddress}</p>}
                  {content.ceremonyTime && <p className="text-sm opacity-70 mb-2">{t('ceremony_time')}: {content.ceremonyTime}</p>}
                  {content.ceremonyNote && <p className="text-sm opacity-80">{content.ceremonyNote}</p>}
                </div>
              )}

              {content.receptionEnabled && (
                <div className="p-8" style={{ background: palette[1], color: palette[2] }}>
                  <h3 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: palette[0] }}><GlassWater className="w-5 h-5" /> {content.receptionTitle || t('reception_section')}</h3>
                  {content.receptionAddress && <p className="mb-1">{content.receptionAddress}</p>}
                  {content.receptionTime && <p className="text-sm opacity-70 mb-2">{t('reception_time')}: {content.receptionTime}</p>}
                  {content.receptionNote && <p className="text-sm opacity-80">{content.receptionNote}</p>}
                </div>
              )}

              {content.storyEnabled && (
                <div className="p-8" style={{ background: palette[3], color: palette[2] }}>
                  <h3 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: palette[0] }}><Heart className="w-5 h-5" /> {content.storyTitle || t('story_section')}</h3>
                  <p className="text-sm leading-relaxed">{content.storyBody || t('story_body_ph')}</p>
                </div>
              )}

              {content.registryEnabled && (
                <div className="p-8 text-center" style={{ background: palette[1], color: palette[2] }}>
                  <h3 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: palette[0] }}><Gift className="w-5 h-5" /> {t('registry_section')}</h3>
                  <p className="text-sm mb-3">{content.registryText || ''}</p>
                  {content.registryIban && <p className="text-xs opacity-70 font-mono">IBAN: {content.registryIban}</p>}
                  {content.registryLink && <a href={content.registryLink} target="_blank" className="text-sm underline mt-2 inline-block">{t('registry_section')} ↗</a>}
                </div>
              )}

              {content.dressCodeEnabled && content.dressCodeText && (
                <div className="p-8 text-center" style={{ background: palette[3], color: palette[2] }}>
                  <p className="text-sm"><Shirt className="w-4 h-4 inline" /> <strong>{t('dress_code_section')}:</strong> {content.dressCodeText}</p>
                </div>
              )}

              {content.menuEnabled && content.menuText && (
                <div className="p-8" style={{ background: palette[1], color: palette[2] }}>
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2" style={{ color: palette[0] }}><Utensils className="w-4 h-4" /> {t('menu_section')}</h3>
                  <p className="text-sm">{content.menuText}</p>
                  {content.menuAllergens && <p className="text-xs mt-2 opacity-70">{t('menu_allergens')}: {content.menuAllergens}</p>}
                </div>
              )}

              {content.hotelsEnabled && content.hotelsText && (
                <div className="p-8" style={{ background: palette[3], color: palette[2] }}>
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2" style={{ color: palette[0] }}><Hotel className="w-4 h-4" /> {t('hotels_section')}</h3>
                  <p className="text-sm">{content.hotelsText}</p>
                </div>
              )}

              {content.playlistEnabled && content.playlistLink && (
                <div className="p-8 text-center" style={{ background: palette[1], color: palette[2] }}>
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2" style={{ color: palette[0] }}><Music className="w-4 h-4" /> {t('playlist_section')}</h3>
                  <a href={content.playlistLink} target="_blank" className="text-sm underline">{t('playlist_section')} ↗</a>
                </div>
              )}

              {content.rsvpEnabled && (
                <div className="p-8 text-center" style={{ background: palette[3], color: palette[2] }}>
                  <h3 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: palette[0] }}><Mail className="w-5 h-5" /> {t('rsvp_section')}</h3>
                  <p className="text-sm mb-3">{content.rsvpMessage || t('rsvp_cta')}</p>
                  {content.rsvpDeadline && <p className="text-xs opacity-70">{t('rsvp_deadline')}: {new Date(content.rsvpDeadline).toLocaleDateString('it-IT')}</p>}
                  <div className="flex flex-wrap items-center justify-center gap-3 mt-3">
                    {content.rsvpEmail && <a href={`mailto:${content.rsvpEmail}`} className="inline-block text-sm px-6 py-2 rounded-full transition-colors" style={{ background: palette[0], color: '#fff' }}>{t('rsvp_email')}</a>}
                    {content.rsvpWhatsapp && <a href={`https://wa.me/${content.rsvpWhatsapp.replace(/[^0-9]/g, '')}`} target="_blank" className="inline-block text-sm px-6 py-2 rounded-full transition-colors" style={{ background: palette[0], color: '#fff' }}>{t('rsvp_whatsapp')}</a>}
                  </div>
                </div>
              )}

              {content.navettaEnabled && (
                <div className="p-8" style={{ background: palette[3], color: palette[2] }}>
                  <h3 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: palette[0] }}><MapPin className="w-5 h-5" /> {t('navetta_section')}</h3>
                  {content.navettaOrari && <p className="mb-2 whitespace-pre-line">{content.navettaOrari}</p>}
                  {content.navettaMappa && (
                    <a href={content.navettaMappa} target="_blank" className="inline-block text-sm px-4 py-2 rounded-full mb-3" style={{ background: palette[0], color: '#fff' }}>
                      {t('navetta_mappa')}
                    </a>
                  )}
                  {content.navettaNote && <p className="text-sm opacity-70 whitespace-pre-line">{content.navettaNote}</p>}
                  {content.navettaContatti && <p className="text-sm mt-2">{t('navetta_contatti')}: {content.navettaContatti}</p>}
                  {content.navettaMatchmaking && (
                    <div className="mt-4 p-3 rounded-lg text-sm" style={{ background: palette[1] }}>
                      <p className="font-medium mb-1">{t('navetta_matchmaking')}</p>
                      <p className="opacity-70">{t('navetta_matchmaking_label')}</p>
                    </div>
                  )}
                </div>
              )}

              {content.faqEnabled && content.faqEntries?.length > 0 && (
                <div className="p-8" style={{ background: palette[1], color: palette[2] }}>
                  <h3 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: palette[0] }}><HelpCircle className="w-5 h-5" /> FAQ</h3>
                  {(content.faqEntries as any[]).map((faq: any, i: number) => (
                    <div key={i} className="mb-4">
                      <p className="font-semibold text-sm mb-1">{faq.question}</p>
                      <p className="text-sm opacity-70">{faq.answer}</p>
                    </div>
                  ))}
                </div>
              )}

              {content.weddingPartyEnabled && content.weddingPartyMembers?.length > 0 && (
                <div className="p-8" style={{ background: palette[3], color: palette[2] }}>
                  <h3 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: palette[0] }}><Users className="w-5 h-5" /> Wedding Party</h3>
                  {(content.weddingPartyMembers as any[]).map((m: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 mb-3">
                      {m.photoUrl && <img src={m.photoUrl} alt={m.name} className="w-10 h-10 rounded-full object-cover" />}
                      <div>
                        <p className="text-sm font-medium">{m.name}</p>
                        <p className="text-xs opacity-70">{m.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {content.hashtagEnabled && content.hashtag && (
                <div className="p-4 text-center text-sm" style={{ background: palette[2], color: palette[3] }}>
                  <p>{t('follow_us_hashtag')} <strong>{content.hashtag}</strong></p>
                </div>
              )}

              <div className="p-6 text-center text-xs opacity-50" style={{ background: palette[1], color: palette[2] }}>
                <p>{t('powered_by')}</p>
              </div>
            </div>
            {draft?.published && draft?.published_url && (
              <p className="mt-4 text-center">
                {t('site_published')} <a href={draft.published_url} className="text-brand hover:underline" target="_blank">{draft.published_url}</a>
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
