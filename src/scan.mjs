// faultline · https://github.com/thefgxdev/faultline
// Copyright (c) 2026 Felipe Guedes (fgxdev.com). MIT License: keep this notice when you copy or adapt this file.
//
// faultline scanner: walks a directory, runs the rules, returns findings. Zero dependencies.
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { rules, repoRules, SEV } from './rules.mjs';

export const VERSION = '0.1.0';
export const AUTHOR = 'Felipe Guedes · fgxdev.com · https://github.com/thefgxdev/faultline';
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'out', 'coverage', 'vendor', '.turbo', '.cache', '__pycache__', 'target', '.venv', 'venv']);
const MAX_BYTES = 1_000_000;
const TEXT_EXT = /\.(m?[jt]sx?|cjs|cts|mts|sql|py|php|rb|go|html?|vue|svelte|astro|ya?ml|json|toml|gitignore)$|(?:^|\/)\.env(?:\.[^/]+)?$|(?:^|\/)Dockerfile[^/]*$/;

export async function collectFiles(root, ignore = []) {
  const out = [];
  const walk = async (dir) => {
    let entries; try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name), rel = path.relative(root, full).replace(/\\/g, '/');
      if (ignore.some((g) => matchGlob(g, rel))) continue;
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) await walk(full); continue; }
      if (!TEXT_EXT.test(rel) && !/\.gitignore$/.test(rel)) continue;
      out.push({ full, rel });
    }
  };
  await walk(root);
  return out;
}

export function matchGlob(glob, rel) {
  const re = new RegExp('^' + glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*\//g, '(?:.*/)?').replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*').replace(/\?/g, '.') + '$');
  return re.test(rel) || re.test(rel.split('/').pop());
}

export async function scan(root, { ignore = [], minSeverity = 'info' } = {}) {
  root = path.resolve(root);
  const files = await collectFiles(root, ignore);
  const rels = new Set(files.map((f) => f.rel));
  // repository-level facts used by rules
  let deps = [], hasPackageJson = rels.has('package.json');
  if (hasPackageJson) { try { const pj = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')); deps = Object.keys({ ...(pj.dependencies || {}), ...(pj.devDependencies || {}) }); } catch { /* ignore */ } }
  const repo = { hasPackageJson, deps, hasLockfile: ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb', 'bun.lock'].some((l) => rels.has(l)), hasEnvFile: [...rels].some((r) => /(?:^|\/)\.env(?:\.[^/]+)?$/.test(r) && !/example|sample|template/.test(r)), hasTenant: false };
  const texts = new Map();
  for (const f of files) {
    try { const s = await stat(f.full); if (s.size > MAX_BYTES) continue; const t = await readFile(f.full, 'utf8'); texts.set(f.rel, t); if (!repo.hasTenant && /\btenant_?id\b|\btenantId\b|\borganizationId\b|\bworkspaceId\b/i.test(t)) repo.hasTenant = true; } catch { /* binary or unreadable */ }
  }
  const findings = [];
  for (const [rel, text] of texts) {
    const ctx = { path: rel, text, lines: text.split('\n'), ext: path.extname(rel), repo };
    for (const rule of rules) {
      if (!rule.files.test(rel)) continue;
      let hits = []; try { hits = rule.test(ctx); } catch { /* a rule must never crash the scan */ }
      for (const h of hits) findings.push({ rule: rule.id, title: rule.title, severity: rule.severity, category: rule.category, fix: rule.fix, path: rel, line: h.line, evidence: h.evidence });
    }
  }
  for (const rule of repoRules) for (const h of rule.test(repo)) findings.push({ rule: rule.id, title: rule.title, severity: rule.severity, category: rule.category, fix: rule.fix, path: h.path, line: h.line, evidence: h.evidence });
  const min = SEV[minSeverity] ?? 0;
  const filtered = findings.filter((f) => SEV[f.severity] >= min).sort((a, b) => SEV[b.severity] - SEV[a.severity] || a.path.localeCompare(b.path) || a.line - b.line);
  return { root, files: files.length, scanned: texts.size, findings: filtered, repo };
}

export function summarize(result) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of result.findings) counts[f.severity]++;
  return counts;
}

export function toMarkdown(result) {
  const c = summarize(result);
  const cell = (s) => String(s || '').replace(/\|/g, '\\|').replace(/`/g, '\u02cb').replace(/\r?\n/g, ' ');
  const rows = result.findings.map((f) => `| ${f.severity} | ${f.title} | \`${f.path}:${f.line}\` | \`${cell(f.evidence)}\` |`).join('\n');
  const byRule = new Map(); for (const f of result.findings) byRule.set(f.rule, f);
  const fixes = [...byRule.values()].map((f) => `- **${f.title}** (${f.rule}): ${f.fix}`).join('\n');
  return `# faultline report\n\nScanned ${result.scanned} files in \`${result.root}\`.\n\n| Critical | High | Medium | Low | Info |\n|---|---|---|---|---|\n| ${c.critical} | ${c.high} | ${c.medium} | ${c.low} | ${c.info} |\n\n## Findings\n\n${result.findings.length ? `| Severity | Finding | Where | Evidence |\n|---|---|---|---|\n${rows}` : 'None. Read the boundaries anyway.'}\n\n## How to fix\n\n${fixes || '-'}\n\n_Generated by [faultline](https://github.com/thefgxdev/faultline) v${VERSION}, by Felipe Guedes (fgxdev.com). Findings are heuristics: they point at boundaries a human should read._\n`;
}
