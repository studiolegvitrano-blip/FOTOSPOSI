// Validatori puri per il payload RSVP. Estratti dalla route per essere testati.
// Mantengono le stesse firme/comportamento della versione inline precedente.

const MAX_GUESTS = 15;
const MAX_INTOLERANCES = 10;

export const VALID_DIET_TYPES = ['onnivoro', 'vegetariano', 'vegano', 'pescatariano', 'altro'] as const;
export type DietType = (typeof VALID_DIET_TYPES)[number];

export function validateDietType(raw: unknown): DietType | null {
  if (raw === undefined || raw === null || raw === '') return 'onnivoro';
  if (typeof raw !== 'string') return null;
  const t = raw.trim().toLowerCase().slice(0, 40);
  return (VALID_DIET_TYPES as readonly string[]).includes(t) ? (t as DietType) : null;
}

export function validateIntolerances(raw: unknown): string[] | null {
  if (raw === undefined || raw === null || raw === '') return [];
  if (!Array.isArray(raw)) return null;
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') return null;
    const clean = item.trim().slice(0, 80);
    if (clean) out.push(clean);
  }
  if (out.length > MAX_INTOLERANCES) return null;
  return out;
}

export function validateGuests(raw: unknown): Array<{
  name: string;
  type: 'adult' | 'minor';
  age: number | null;
  intolerances: string[];
}> | null {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) return null;
  if (raw.length > MAX_GUESTS) return null;
  const out: Array<{ name: string; type: 'adult' | 'minor'; age: number | null; intolerances: string[] }> = [];
  for (const g of raw as Array<Record<string, unknown>>) {
    if (!g || typeof g !== 'object') return null;
    const name = typeof g.name === 'string' ? g.name.trim() : '';
    if (!name || name.length > 120) return null;
    const type = g.type === 'minor' ? 'minor' : g.type === 'adult' ? 'adult' : null;
    if (!type) return null;
    let age: number | null = null;
    if (type === 'minor') {
      if (g.age === undefined || g.age === null || g.age === '') return null;
      const n = typeof g.age === 'number' ? g.age : Number(g.age);
      if (!Number.isFinite(n) || n < 0 || n > 18) return null;
      age = Math.floor(n);
    } else if (g.age !== undefined && g.age !== null && g.age !== '') {
      const n = typeof g.age === 'number' ? g.age : Number(g.age);
      if (!Number.isFinite(n) || n < 0) return null;
      age = Math.floor(n);
    }
    const intolerances = validateIntolerances(g.intolerances);
    if (intolerances === null) return null;
    out.push({ name, type, age, intolerances });
  }
  return out;
}
