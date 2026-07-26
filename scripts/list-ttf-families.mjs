// Lists the fontconfig-visible family name of each TTF in apps/web/assets/fonts.
// Uses fontkit (already installed at repo root, no-save) to parse the name table.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

let fontkit;
try {
  fontkit = await import('fontkit');
} catch (e) {
  console.error('fontkit missing:', e.message);
  process.exit(1);
}

const dir = 'apps/web/assets/fonts';
const files = readdirSync(dir).filter(f => f.toLowerCase().endsWith('.ttf')).sort();

console.log('file|family (internal)|subfamily');
console.log('----|----|----');
for (const f of files) {
  try {
    const buf = readFileSync(join(dir, f));
    const font = fontkit.create(buf);
    // font.familyName = nameID=1, font.subfamilyName = nameID=2
    console.log(`${f}|${font.familyName ?? '<no family>'}|${font.subfamilyName ?? ''}`);
  } catch (e) {
    console.log(`${f}|<error: ${e.message}>|`);
  }
}
