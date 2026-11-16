// Validate every data/glyph-styles/*.json against the GlyphStyle JSON Schema.
// Usage: npx tsx tools/validate-data.ts
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { GLYPH_STYLE_SCHEMA, validate } from '../src/render/glyph/schema';

const dir = 'data/glyph-styles';
writeFileSync('data/glyph-style.schema.json', JSON.stringify(GLYPH_STYLE_SCHEMA, null, 2) + '\n');
let bad = 0;
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
for (const f of files) {
  const errs = validate(JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')));
  if (errs.length) { bad++; console.error(`✗ ${f}\n  ` + errs.join('\n  ')); } else console.log(`✓ ${f}`);
}
console.log(`${files.length - bad}/${files.length} presets valid`);
if (bad || files.length < 16) process.exit(1);
