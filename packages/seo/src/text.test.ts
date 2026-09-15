import { describe, it, expect } from 'vitest';
import { slugify, escapeHtml, markdownToHtml, extractJsonObject } from './text';

describe('slugify', () => {
  it('normalizza accenti, spazi e simboli', () => {
    expect(slugify('Regali per gli Sposi: 15 idee à la page!')).toBe('regali-per-gli-sposi-15-idee-a-la-page');
  });
  it('tronca e ripulisce i trattini', () => {
    expect(slugify('  ---Test   Slug---  ')).toBe('test-slug');
    expect(slugify('a'.repeat(120)).length).toBeLessThanOrEqual(80);
  });
});

describe('escapeHtml', () => {
  it('neutralizza tag e attributi', () => {
    expect(escapeHtml('<script>alert("x")</script>')).not.toContain('<script>');
  });
});

describe('markdownToHtml', () => {
  it('converte heading, liste, bold e link https sicuri', () => {
    const html = markdownToHtml('# Titolo\n\n## Sezione **forte**\n\n- uno\n- due\n\nVedi [Sposi](/faq) e [esterno](https://example.com).');
    expect(html).toContain('<h2'); // # declassato a h2: l'H1 e' il titolo pagina
    expect(html).toContain('<strong>forte</strong>');
    expect(html).toContain('<ul');
    expect(html).toContain('<a href="/faq"');
    expect(html).toContain('<a href="https://example.com"');
  });
  it('non esegue HTML iniettato nel contenuto', () => {
    const html = markdownToHtml('Ciao <img src=x onerror=alert(1)> mondo');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });
  it('rifiuta link non http/relativi', () => {
    const html = markdownToHtml('[click](javascript:alert(1))');
    expect(html).not.toContain('javascript:');
  });
});

describe('extractJsonObject', () => {
  it('parsa JSON raw e fenced', () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
    expect(extractJsonObject('ecco:\n```json\n{"a":2}\n```')).toEqual({ a: 2 });
  });
  it('ritorna null su testo non JSON', () => {
    expect(extractJsonObject('nessun json qui')).toBeNull();
  });
});
