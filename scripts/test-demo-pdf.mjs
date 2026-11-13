/**
 * Vérifie que le PDF généré pour la démonstration est structurellement valide :
 * en-tête, table xref, décalages d'objets, trailer.
 *   node scripts/test-demo-pdf.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDemoPdf } from '../assets/js/store-demo.js';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '..', '.tmp', 'demo.pdf');
mkdirSync(dirname(out), { recursive: true });

const pdf = buildDemoPdf('Chapitre 1 — Nombres relatifs');
writeFileSync(out, pdf, 'latin1');

const errors = [];
if (!pdf.startsWith('%PDF-1.4')) errors.push('en-tête %PDF-1.4 absent');
if (!pdf.trimEnd().endsWith('%%EOF')) errors.push('%%EOF absent');

const xrefPos = Number(/startxref\s+(\d+)/.exec(pdf)?.[1]);
if (!Number.isFinite(xrefPos)) errors.push('startxref introuvable');

const header = pdf.slice(xrefPos, xrefPos + 40);
if (!header.startsWith('xref')) errors.push('la position startxref ne pointe pas sur la table xref');

const offsets = [...pdf.matchAll(/^(\d{10}) 00000 n\s*$/gm)].map((m) => Number(m[1]));
if (offsets.length !== 5) errors.push(`5 entrées xref attendues, ${offsets.length} trouvées`);

offsets.forEach((offset, i) => {
  const chunk = pdf.slice(offset, offset + 12);
  if (!new RegExp(`^${i + 1} 0 obj`).test(chunk)) {
    errors.push(`objet ${i + 1} : décalage ${offset} invalide (« ${chunk.slice(0, 12)} »)`);
  }
});

const streamLength = Number(/<< \/Length (\d+) >>/.exec(pdf)?.[1]);
const streamStart = pdf.indexOf('stream\n') + 'stream\n'.length;
const streamEnd = pdf.indexOf('\nendstream');
if (streamLength !== streamEnd - streamStart) {
  errors.push(`longueur du flux incohérente (${streamLength} annoncée, ${streamEnd - streamStart} réelle)`);
}

if (errors.length) {
  console.error('PDF INVALIDE :');
  for (const e of errors) console.error(' -', e);
  process.exit(1);
}

console.log(`PDF valide (${pdf.length} octets) : ${out}`);
