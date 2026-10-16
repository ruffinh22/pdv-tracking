// Génère src/styles/dark.css = dark.base.css (composants, graphiques, cartes)
//                            + surcharges des classes utilitaires Tailwind réellement utilisées.
// Lancé automatiquement avant chaque build (« prebuild ») ; manuellement : npm run gen:dark
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'src';
const BASE = join(SRC, 'styles', 'dark.base.css');
const OUT = join(SRC, 'styles', 'dark.css');

const INK_TEXT = { 950: '#eaf3ee', 900: '#eaf3ee', 800: '#d7e6dc', 700: '#bfd3c6', 600: '#a3bbab', 500: '#8ea898', 400: '#7f9b8c', 300: '#6b8a79' };
const INK_BG = { 50: '#0f261b', 100: '#12301f', 200: '#1d3d2c', 300: '#2a5640' };
const MIST_BG = { 50: '#0b2017', 100: '#12301f', 200: '#1d3d2c', 300: '#2a5640' };
const SOFT = { success: '0,136,64', primary: '255,130,0', danger: '200,40,40', warning: '230,160,0' };
const TXT = {
  success: { 500: '#5cc78a', 600: '#5cc78a', 700: '#6fd39a', 800: '#86dcab', 900: '#9fe5bd' },
  primary: { 500: '#ff9b3d', 600: '#ff9b3d', 700: '#ffa850', 800: '#ffb870', 900: '#ffc58a' },
  danger: { 500: '#ff8f8f', 600: '#ff8f8f', 700: '#ffa3a3', 800: '#ffb3b3', 900: '#ffc2c2' },
  warning: { 500: '#f2c14e', 600: '#f2c14e', 700: '#f5cd6b', 800: '#f7d88a', 900: '#f9e0a2' },
};
const BP = { sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1536 };

function valeur(prop, couleur) {
  let m;
  if (prop === 'bg') {
    if (couleur === 'white') return 'var(--surface)';
    if (couleur === 'zebra') return '#0f261b';
    if ((m = couleur.match(/^ink-(\d+)$/)) && INK_BG[m[1]]) return INK_BG[m[1]];
    if ((m = couleur.match(/^mist-(\d+)$/)) && MIST_BG[m[1]]) return MIST_BG[m[1]];
    if ((m = couleur.match(/^(success|primary|danger|warning)-(50|100)$/))) return `rgba(${SOFT[m[1]]},${m[2] === '50' ? '.16' : '.24'})`;
  }
  if (prop === 'text') {
    if ((m = couleur.match(/^ink-(\d+)$/)) && INK_TEXT[m[1]]) return INK_TEXT[m[1]];
    if ((m = couleur.match(/^(success|primary|danger|warning)-(\d+)$/)) && TXT[m[1]][m[2]]) return TXT[m[1]][m[2]];
  }
  if (['border', 'ring', 'divide'].includes(prop)) {
    if ((m = couleur.match(/^(ink|mist)-(\d+)$/))) return ['100', '200'].includes(m[2]) ? 'var(--border)' : 'var(--border-strong)';
    if ((m = couleur.match(/^(success|primary|danger|warning)-(100|200|300)$/))) return `rgba(${SOFT[m[1]]},.4)`;
  }
  return null;
}

const esc = (t) => t.replace(/([^a-zA-Z0-9_-])/g, '\\$1');

function fichiers(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? fichiers(p) : /\.tsx$/.test(n) ? [p] : [];
  });
}

const tokens = new Set();
for (const f of fichiers(SRC)) {
  for (const m of readFileSync(f, 'utf8').matchAll(/[A-Za-z0-9_:\-\[\]/.#%!()]+/g)) {
    const t = m[0];
    if (/ink-|mist-|white|success-|primary-|danger-|warning-|zebra/.test(t)) tokens.add(t);
  }
}

const regles = new Map(); // largeur minimale (ou 0) -> règles
const nonCouverts = [];
for (const t of [...tokens].sort()) {
  const parts = t.split(':');
  const base = parts[parts.length - 1];
  const variantes = parts.slice(0, -1);
  const important = base.startsWith('!');
  const m = base.replace(/^!/, '').match(/^(bg|text|border|ring|divide)-(.+)$/);
  if (!m) continue;
  const [, prop, couleur] = m;
  if (couleur.includes('/')) continue; // nuances d'opacité : conservées telles quelles
  const v = valeur(prop, couleur);
  if (v === null) {
    // Volontairement inchangés : texte blanc, bordures/anneaux blancs, fonds très foncés (bulles, badges).
    const voulu = (prop === 'text' && couleur === 'white') || (prop !== 'bg' && couleur === 'white') || (prop === 'bg' && /^ink-(800|900|950)$/.test(couleur));
    if (/^(ink|mist)-|^white$|^zebra$/.test(couleur) && !voulu) nonCouverts.push(t);
    continue;
  }
  let bp = 0, etat = null, groupe = null, ph = false, ok = true;
  for (const va of variantes) {
    if (BP[va]) bp = BP[va];
    else if (['hover', 'focus', 'active', 'focus-visible', 'focus-within', 'disabled'].includes(va)) etat = va;
    else if (va === 'placeholder') ph = true;
    else if (va.startsWith('group-hover')) groupe = va;
    else ok = false;
  }
  if (!ok) continue;
  const cls = '.' + esc(t);
  let sel;
  if (groupe) {
    const nom = groupe.includes('/') ? groupe.split('/')[1] : null;
    sel = `.group${nom ? '\\/' + nom : ''}:hover ${cls}`;
  } else {
    sel = cls + (etat ? ':' + etat : '') + (ph ? '::placeholder' : '');
  }
  sel = `[data-theme="dark"] ${sel}`;
  const imp = important ? ' !important' : '';
  let decl;
  if (prop === 'bg') decl = `background-color:${v}${imp}`;
  else if (prop === 'text') decl = `color:${v}${imp}`;
  else if (prop === 'border') decl = `border-color:${v}${imp}`;
  else if (prop === 'ring') decl = `--tw-ring-color:${v}${imp}`;
  else { sel = sel.replace(cls, cls + ' > :not([hidden]) ~ :not([hidden])'); decl = `border-color:${v}${imp}`; }
  if (!regles.has(bp)) regles.set(bp, []);
  regles.get(bp).push(`${sel}{${decl}}`);
}

let gen = '/* GÉNÉRÉ par scripts/gen-dark.mjs — ne pas modifier à la main. */\n';
for (const bp of [...regles.keys()].sort((a, b) => a - b)) {
  const corps = regles.get(bp).join('\n');
  gen += bp === 0 ? corps + '\n' : `@media (min-width:${bp}px){\n${corps}\n}\n`;
}
const sortie = readFileSync(BASE, 'utf8').trimEnd() + '\n\n@media screen {\n' + gen + '}\n';
writeFileSync(OUT, sortie);
const n = [...regles.values()].reduce((a, r) => a + r.length, 0);
console.log(`gen-dark : ${n} règles générées`);
if (nonCouverts.length) console.warn(`gen-dark : couleurs sans équivalent sombre (à compléter dans le script) : ${nonCouverts.join(', ')}`);
