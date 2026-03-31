/**
 * Contrast Checker - WCAG AA compliance for globals.css tokens.
 * Wave 3 - Token-based contrast audit.
 *
 * Run: tsx scripts/a11y/check-contrast.ts
 */

const WCAG_AA_NORMAL = 4.5;
const WCAG_AA_LARGE = 3;

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return null;
  return {
    r: parseInt(m[1], 16),
    g: parseInt(m[2], 16),
    b: parseInt(m[3], 16),
  };
}

function parseRgba(css: string): { r: number; g: number; b: number } | null {
  const m = css.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!m) return null;
  return { r: +m[1], g: +m[2], b: +m[3] };
}

function parseColor(css: string): { r: number; g: number; b: number } | null {
  const t = css.trim();
  if (t.startsWith('#')) return hexToRgb(t);
  if (t.startsWith('rgba') || t.startsWith('rgb')) return parseRgba(t);
  return null;
}

function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return rs * 0.2126 + gs * 0.7152 + bs * 0.0722;
}

function contrastRatio(
  fg: { r: number; g: number; b: number },
  bg: { r: number; g: number; b: number }
): number {
  const l1 = relativeLuminance(fg.r, fg.g, fg.b);
  const l2 = relativeLuminance(bg.r, bg.g, bg.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

interface CheckPair {
  name: string;
  fg: string;
  bg: string;
  minRatio: number;
  note?: string;
}

// Light mode pairs from globals.css :root
const PAIRS: CheckPair[] = [
  {
    name: 'text/primary on surface/1',
    fg: '#0f172a',
    bg: '#ffffff',
    minRatio: WCAG_AA_NORMAL,
  },
  {
    name: 'text/secondary on surface/1',
    fg: '#475569',
    bg: '#ffffff',
    minRatio: WCAG_AA_NORMAL,
    note: 'Secondary can be borderline; AA requires 4.5',
  },
  {
    name: 'text/muted on surface/1',
    fg: '#64748b',
    bg: '#ffffff',
    minRatio: 3,
    note: 'Tertiary/muted; large text only or justified exception',
  },
  {
    name: 'accent text on accent background',
    fg: '#1e40af',
    bg: '#eff6ff',
    minRatio: WCAG_AA_NORMAL,
  },
  {
    name: 'accent primary on white (buttons)',
    fg: '#ffffff',
    bg: '#1e40af',
    minRatio: WCAG_AA_NORMAL,
  },
  {
    name: 'status success chip',
    fg: '#065f46',
    bg: '#ecfdf5',
    minRatio: WCAG_AA_NORMAL,
  },
  {
    name: 'status warning chip',
    fg: '#92400e',
    bg: '#fffbeb',
    minRatio: WCAG_AA_NORMAL,
  },
  {
    name: 'status danger chip',
    fg: '#991b1b',
    bg: '#fef2f2',
    minRatio: WCAG_AA_NORMAL,
  },
  {
    name: 'status info chip',
    fg: '#1e40af',
    bg: '#eff6ff',
    minRatio: WCAG_AA_NORMAL,
  },
  {
    name: 'status neutral chip',
    fg: '#475569',
    bg: '#f1f5f9',
    minRatio: WCAG_AA_NORMAL,
  },
];

function main() {
  let failed = 0;
  console.log('Contrast Check (WCAG AA, light mode)\n');

  for (const p of PAIRS) {
    const fg = parseColor(p.fg);
    const bg = parseColor(p.bg);
    if (!fg || !bg) {
      console.error(`  [SKIP] ${p.name}: could not parse color`);
      continue;
    }
    const ratio = contrastRatio(fg, bg);
    const ok = ratio >= p.minRatio;
    if (!ok) failed++;
    const status = ok ? 'PASS' : 'FAIL';
    const detail = p.note ? ` (${p.note})` : '';
    console.log(
      `  [${status}] ${p.name}: ${ratio.toFixed(2)}:1 (min ${p.minRatio})${detail}`
    );
  }

  console.log('');
  if (failed > 0) {
    console.error('Some pairs failed. Adjust CSS variables in globals.css.');
    process.exit(1);
  }
  console.log('All primary UI pairs meet WCAG AA.');
}

main();
