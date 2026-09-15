// Utilita' testuali per il blog SEO: slug, escape HTML e un converter
// markdown→HTML MINIMO e sicuro (il contenuto e' generato da noi via AI, ma
// l'escape prima della trasformazione rende impossibile XSS anche in caso di
// output imprevisto o manipolazione diretta del DB).

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function inlineMd(text: string): string {
  let out = text;
  // link [testo](url) — solo URL http(s) ammessi, altrimenti resta il testo
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" class="text-brand underline underline-offset-2">$1</a>');
  // markdown "nudo" per link interni: [testo](/path)
  out = out.replace(/\[([^\]]+)\]\((\/[A-Za-z0-9/?=&_-]+)\)/g, '<a href="$2" class="text-brand underline underline-offset-2">$1</a>');
  // catch-all: qualsiasi altro link non sicuro (javascript:, data:, ...) → solo testo
  out = out.replace(/\[([^\]]+)\]\([^)\s]+\)/g, '$1');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return out;
}

/**
 * Converte un sottoinsieme controllato di markdown in HTML con classi
 * Tailwind coerenti al design system. Supporta: #/##/### heading, - liste,
 * --- hr, **grassetto**, *corsivo*, [link](...), paragrafi. Tutto il testo
 * viene prima escapato (mai HTML raw in output non generato da qui).
 */
export function markdownToHtml(md: string): string {
  const lines = escapeHtml(md).split(/\r?\n/);
  const out: string[] = [];
  let inList = false;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) {
      out.push(`<p class="my-4 leading-relaxed">${para.map(inlineMd).join('<br/>')}</p>`);
      para = [];
    }
  };
  const closeList = () => {
    if (inList) { out.push('</ul>'); inList = false; }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^\s*$/.test(line)) { flushPara(); closeList(); continue; }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      flushPara(); closeList();
      const level = Math.max(2, (h?.[1] ?? '').length + 1); // # → h2 (l'H1 di pagina e' il titolo)
      const cls = level === 2 ? 'mt-10 mb-3 text-2xl font-bold' : 'mt-8 mb-2 text-xl font-semibold';
      out.push(`<h${level} class="${cls}">${inlineMd(h?.[2] ?? '')}</h${level}>`);
      continue;
    }
    if (/^-{3,}$/.test(line.trim())) { flushPara(); closeList(); out.push('<hr class="my-8 border-border"/>'); continue; }
    const li = line.match(/^\s*-\s+(.*)$/);
    if (li) {
      flushPara();
      if (!inList) { out.push('<ul class="my-4 list-disc pl-6 space-y-1">'); inList = true; }
      out.push(`<li>${inlineMd(li?.[1] ?? '')}</li>`);
      continue;
    }
    para.push(line);
  }
  flushPara(); closeList();
  return out.join('\n');
}

/**
 * Estrae e parsa il JSON dalla risposta testuale di un LLM: accetta blocchi
 * ```json ... ``` o un oggetto raw. Ritorna null se non parsabile.
 */
export function extractJsonObject<T = Record<string, unknown>>(text: string): T | null {
  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence?.[1]) s = fence[1].trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(s.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
