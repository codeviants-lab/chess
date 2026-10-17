import { describe, expect, it } from 'vitest';

// Packages core/ may import. Adding one needs an Issue first (see core/README.md).
const ALLOWED_PACKAGES = ['chess.js'];

const sources = import.meta.glob<string>('../core/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const IMPORT_RE = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|import\s*['"]([^'"]+)['"]/g;

function importsOf(source: string): string[] {
  return [...source.matchAll(IMPORT_RE)].map((m) => m[1] ?? m[2] ?? m[3] ?? '');
}

// Resolves a relative specifier against the importing file and tells whether it stays in core/.
function staysInCore(file: string, spec: string): boolean {
  const parts = file.replace(/^\.\.\//, '').split('/').slice(0, -1);
  for (const seg of spec.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.') parts.push(seg);
  }
  return parts[0] === 'core';
}

export function violations(files: Record<string, string>): string[] {
  const found: string[] = [];
  for (const [file, source] of Object.entries(files)) {
    for (const spec of importsOf(source)) {
      const ok = spec.startsWith('.') ? staysInCore(file, spec) : ALLOWED_PACKAGES.includes(spec);
      if (!ok) found.push(`${file}: ${spec}`);
    }
  }
  return found;
}

describe('core/ sınırları', () => {
  it('core/ yalnızca kendi içinden ve izinli paketlerden import ediyor', () => {
    expect(violations(sources)).toEqual([]);
  });

  it('dışarı çıkan import yakalanıyor', () => {
    expect(
      violations({
        '../core/a.ts': "import { x } from '../app/main';\nimport y from 'node:fs';\nimport { Chess } from 'chess.js';",
        '../core/sub/b.ts': "export * from '../a';\nconst z = await import('@supabase/supabase-js');",
      }),
    ).toEqual(['../core/a.ts: ../app/main', '../core/a.ts: node:fs', '../core/sub/b.ts: @supabase/supabase-js']);
  });
});
