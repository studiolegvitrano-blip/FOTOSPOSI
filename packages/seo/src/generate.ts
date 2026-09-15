import { generateChat } from '@fotosposi/core';
import type { ArticleDraft } from './types';
import { extractJsonObject, slugify } from './text';

/**
 * Genera una bozza di articolo SEO via LLM (catena provider di @fotosposi/core:
 * Groq primario gratis, NVIDIA/Gemini fallback). Il DB non viene toccato:
 * l'inserimento (e la pubblicazione) e' responsabilita' del chiamante.
 */
const SYSTEM_PROMPT = `Sei un copywriter SEO senior italiano, esperto del settore matrimoni.
Scrivi per il blog di Sposi.live: una piattaforma con cui gli sposi raccolgono tutte le foto e i video degli invitati via QR code (senza app da installare), creano la lista nozze online gratuita, hanno un wall fotografico in diretta e giochi per gli invitati.
Regole:
- Tono caldo, pratico e utile, mai da venditore.
- Struttura pensata per essere citata dai motori AI (risposte dirette e sintetiche all'inizio di ogni sezione).
- Link interni naturali quando pertinenti (formato markdown): [Sposi.live](/), [pagina FAQ](/faq), [marketplace fornitori](/marketplace).
- NON inventare prezzi o statistiche: se servono numeri, usa formule generiche ("molte coppie", "in genere").
- Rispondi SOLO con un oggetto JSON valido, niente testo prima o dopo, niente commenti.`;

export interface GenerateSeoArticleOptions {
  locale?: string;
  /** Nota editoriale extra (es. pubblico, stagione, CTA specifica). */
  extraContext?: string;
}

export async function generateSeoArticle(
  keyword: string,
  opts: GenerateSeoArticleOptions = {},
): Promise<{ draft?: ArticleDraft; error?: string }> {
  const kw = keyword.trim();
  if (!kw) return { error: 'keyword vuota' };

  const userPrompt = `Scrivi un articolo del blog ottimizzato SEO per la keyword "${kw}" (mercato italiano).
Requisiti:
- 900-1200 parole.
- H1 nel titolo (campo "title"), non ripeterlo nel corpo: il corpo parte da un'intro di 2-3 frasi che risponde subito al search intent (utile per essere citati da Google e dagli assistenti AI), poi 4-6 sezioni con heading "##", qualche "###" dove serve.
- Elenchi puntati ("- ") dove aiutano la scansione.
- Sezione finale "## Domande frequenti" con 3 domande/risposte brevi.
- Menziona come Sposi.live risolve il problema in modo naturale (1-2 link markdown interni tra quelli descritti).
- Tutto il corpo in "content_md" come markdown semplice (solo ##, ###, -, **grassetto**, [link](url), niente HTML, niente immagini, niente tabelle).
${opts.extraContext ? `- Nota editoriale: ${opts.extraContext}\n` : ''}
Output JSON: {"title": "...", "slug": "...(slug URL pulito, no stopword)", "meta_description": "...(max 155 caratteri, con la keyword)", "content_md": "..."}`;

  const res = await generateChat([{ role: 'user', content: userPrompt }], SYSTEM_PROMPT, 3800);
  if (!res.content) return { error: res.error ?? 'LLM senza risposta' };

  const parsed = extractJsonObject<{ title?: string; slug?: string; meta_description?: string; content_md?: string }>(res.content);
  if (!parsed || !parsed.title || !parsed.content_md) {
    return { error: `Risposta AI non parsabile: ${res.content.slice(0, 200)}` };
  }
  const slug = slugify(parsed.slug || parsed.title);
  if (!slug) return { error: 'slug non generabile' };

  return {
    draft: {
      title: parsed.title.trim(),
      slug,
      meta_description: (parsed.meta_description || '').slice(0, 300).trim(),
      keyword: kw,
      content_md: parsed.content_md.trim(),
    },
  };
}
