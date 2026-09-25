#!/usr/bin/env node
// faultline CLI. Usage: faultline [dir] [--fail-on critical|high|medium|low] [--min info|low|medium|high] [--json] [--md report.md] [--ignore "glob" ...]
import { writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { scan, summarize, toMarkdown } from '../src/scan.mjs';
import { SEV } from '../src/rules.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def; };
const flag = (name) => args.includes(name);
if (flag('--help') || flag('-h')) {
  console.log(`faultline: find the failure nobody finds.\n\nUsage: faultline [dir] [options]\n  --fail-on <sev>   exit 1 if any finding is at or above this severity (default: high)\n  --min <sev>       hide findings below this severity (default: info)\n  --ignore <glob>   ignore paths (repeatable); .faultlineignore is read too\n  --json            print JSON instead of the table\n  --md <file>       also write a Markdown report\n  --no-color        plain output\n\nSeverities: critical, high, medium, low, info\nInline: add "faultline-ignore" to a line, or "faultline-ignore-next" to the line above.`);
  process.exit(0);
}
const dir = args.find((a) => !a.startsWith('--') && !['critical', 'high', 'medium', 'low', 'info'].includes(a) && args[args.indexOf(a) - 1] !== '--md' && args[args.indexOf(a) - 1] !== '--ignore') || '.';
const failOn = opt('--fail-on', 'high'), min = opt('--min', 'info');
const ignore = []; for (let i = 0; i < args.length; i++) if (args[i] === '--ignore' && args[i + 1]) ignore.push(args[i + 1]);
try { const extra = await readFile(path.join(path.resolve(dir), '.faultlineignore'), 'utf8'); for (const l of extra.split('\n')) { const t = l.trim(); if (t && !t.startsWith('#')) ignore.push(t); } } catch { /* optional */ }

const color = !flag('--no-color') && process.stdout.isTTY;
const paint = (sev, s) => { if (!color) return s; const c = { critical: '\x1b[41m\x1b[97m', high: '\x1b[31m', medium: '\x1b[33m', low: '\x1b[36m', info: '\x1b[90m' }[sev] || ''; return `${c}${s}\x1b[0m`; };

const result = await scan(dir, { ignore, minSeverity: min });
const counts = summarize(result);
if (flag('--json')) console.log(JSON.stringify({ root: result.root, files: result.scanned, counts, findings: result.findings }, null, 2));
else {
  console.log(`\nfaultline · scanned ${result.scanned} files in ${result.root}\n`);
  if (!result.findings.length) console.log('  No findings. Read the boundaries anyway.\n');
  let lastRule = '';
  for (const f of result.findings) {
    if (f.rule !== lastRule) { console.log(`${paint(f.severity, f.severity.toUpperCase().padEnd(8))} ${f.title}  [${f.rule}]`); console.log(`         fix: ${f.fix}`); lastRule = f.rule; }
    console.log(`         ${f.path}:${f.line}  ${f.evidence || ''}`);
  }
  console.log(`\n  critical ${counts.critical} · high ${counts.high} · medium ${counts.medium} · low ${counts.low} · info ${counts.info}\n`);
}
const md = opt('--md', null); if (md) { await writeFile(md, toMarkdown(result)); if (!flag('--json')) console.log(`  report: ${md}\n`); }
const worst = Math.max(-1, ...result.findings.map((f) => SEV[f.severity]));
process.exit(worst >= (SEV[failOn] ?? SEV.high) ? 1 : 0);
