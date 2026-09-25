// faultline · https://github.com/thefgxdev/faultline · Copyright (c) 2026 Felipe Guedes (fgxdev.com) · AGPL-3.0-or-later
// Edge-case tests: CLI options, exit codes, suppressions, odd files, JSON/Markdown outputs, library API. No dependencies.
import { mkdtemp, writeFile, mkdir, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { scan, summarize, toMarkdown, matchGlob } from '../src/scan.mjs';

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const bin = path.join(here, '..', 'bin', 'faultline.mjs');
let failed = 0, passed = 0;
const ok = (cond, msg) => { if (cond) { passed++; console.log(`ok   ${msg}`); } else { failed++; console.log(`FAIL ${msg}`); } };
const cli = async (args, cwd) => { try { const r = await run(process.execPath, [bin, ...args, '--no-color'], { cwd }); return { code: 0, out: r.stdout, err: r.stderr }; } catch (e) { return { code: e.code, out: e.stdout || '', err: e.stderr || '' }; } };
const tmp = await mkdtemp(path.join(tmpdir(), 'faultline-'));
const dir = async (name, files) => { const d = path.join(tmp, name); for (const [rel, content] of Object.entries(files)) { await mkdir(path.dirname(path.join(d, rel)), { recursive: true }); await writeFile(path.join(d, rel), content); } return d; };

// 1. empty directory
const empty = await dir('empty', {});
let r = await cli([empty]); ok(r.code === 0 && /No findings/.test(r.out), 'empty directory: exit 0 and "No findings"');

// 2. nonexistent directory does not crash
r = await cli([path.join(tmp, 'does-not-exist')]); ok(r.code === 0 && /scanned 0 files/.test(r.out), 'nonexistent directory: exit 0, scanned 0 files');

// 3. exit codes per --fail-on
const med = await dir('medium', { 'a.js': 'const r = await fetch("https://x.example/");\n' });
r = await cli([med, '--fail-on', 'high']); ok(r.code === 0, '--fail-on high does not fail on a medium finding');
r = await cli([med, '--fail-on', 'medium']); ok(r.code === 1, '--fail-on medium fails on a medium finding');
r = await cli([med, '--fail-on', 'info']); ok(r.code === 1, '--fail-on info fails on any finding');

// 4. --min hides lower severities
r = await cli([med, '--min', 'high']); ok(/No findings/.test(r.out), '--min high hides a medium finding');

// 5. inline suppressions
const sup = await dir('suppress', { 'a.js': 'const a = await fetch("https://x/"); // faultline-ignore\n// faultline-ignore-next\nconst b = await fetch("https://y/");\nconst c = await fetch("https://z/");\n' });
let res = await scan(sup); ok(res.findings.length === 1 && res.findings[0].line === 4, 'inline faultline-ignore and faultline-ignore-next silence exactly their lines');

// 6. .faultlineignore and --ignore
const ign = await dir('ignore', { 'src/a.js': 'eval(userInput);\n', 'vendor-ish/b.js': 'eval(userInput);\n', '.faultlineignore': '# comment\nvendor-ish/**\n' });
res = await scan(ign, { ignore: ['vendor-ish/**'] }); ok(res.findings.every((f) => !f.path.startsWith('vendor-ish/')), '--ignore glob excludes a directory');
r = await cli([ign, '--json']); { const j = JSON.parse(r.out); ok(j.findings.every((f) => !f.path.startsWith('vendor-ish/')), '.faultlineignore is read from the scan root'); }
ok(matchGlob('**/*.min.js', 'a/b/c.min.js') && matchGlob('*.min.js', 'x.min.js') && matchGlob('*.min.js', 'deep/x.min.js') && !matchGlob('src/**', 'lib/a.js') && matchGlob('src/**', 'src/a/b.js') && matchGlob('file?.js', 'file1.js') && !matchGlob('file?.js', 'file/.js') && !matchGlob('a(b).js', 'aXbY.js') && matchGlob('a(b).js', 'a(b).js'), 'matchGlob handles **, *, ?, regex metachars and basename matches');

// 7. JSON output is valid and complete
r = await cli([med, '--json']); { let j = null; try { j = JSON.parse(r.out); } catch { /* invalid */ } ok(j && typeof j.files === 'number' && Array.isArray(j.findings) && j.counts && j.findings[0].fix, '--json prints valid JSON with counts, findings and fixes'); }

// 8. Markdown report written, with escaped pipes and backticks
const weird = await dir('weird', { 'a.js': 'const q = db.query(`SELECT * FROM t WHERE x = ${a | b}`);\n' });
const mdPath = path.join(tmp, 'report.md'); r = await cli([weird, '--md', mdPath]); const md = await readFile(mdPath, 'utf8');
ok(md.includes('# faultline report') && !/[^\\]\|[^|]*`[^`]*`[^|]*\|/.test(md.split('## Findings')[1].split('\n').slice(3).join('')) === false, '--md writes the report');
ok(!md.includes('| `SELECT * FROM t WHERE x = ${a | b}`'), 'Markdown table cells escape pipes');

// 9. CRLF and BOM files do not break line numbers
const crlf = await dir('crlf', { 'a.js': '﻿const a = 1;\r\nconst b = 2;\r\nconst r = await fetch("https://x/");\r\n' });
res = await scan(crlf); ok(res.findings.some((f) => f.rule === 'fetch-without-timeout' && f.line === 3), 'CRLF + BOM: finding reported on the right line');

// 10. huge file is skipped, binary-ish file does not crash
const big = await dir('big', { 'big.js': 'x'.repeat(1_100_000), 'bin.js': Buffer.from([0, 255, 254, 0, 1, 2]).toString('latin1') });
res = await scan(big); ok(res.scanned === 1 && res.findings.length === 0, 'files over 1 MB are skipped; odd bytes do not crash');

// 11. node_modules and dist are skipped
const nm = await dir('nm', { 'node_modules/x/index.js': 'eval(a);\n', 'dist/b.js': 'eval(a);\n', 'src/c.js': 'const ok = 1;\n' });
res = await scan(nm); ok(res.scanned === 1 && res.findings.length === 0, 'node_modules and dist are skipped');

// 12. secret-in-code fires on AWS and private key shapes; password-literal is quiet on placeholders
const sec = await dir('secrets', { 'a.js': 'const k = "AKIAIOSFODNN7EXAMPLE";\nconst p = "-----BEGIN RSA PRIVATE KEY-----";\nconst password = "your-password-here";\nconst apiKey = process.env.API_KEY;\n' });
res = await scan(sec); ok(res.findings.filter((f) => f.rule === 'secret-in-code').length === 2, 'secret-in-code: AWS key and private key block detected');
ok(!res.findings.some((f) => f.rule === 'password-literal'), 'password-literal: placeholders and process.env are not flagged');

// 13. tenant rule only fires when the repo uses tenants, and not on Array.prototype.find
const ten = await dir('tenant', { 'schema.prisma.ts': 'export const t = { tenantId: "" };\n', 'svc.ts': 'const x = list.find((i) => i.id === id);\nconst rows = await prisma.order.findMany({ where: { status: "open" } });\n' });
res = await scan(ten); ok(res.findings.some((f) => f.rule === 'query-without-tenant' && f.line === 2) && !res.findings.some((f) => f.rule === 'query-without-tenant' && f.line === 1), 'query-without-tenant: ORM read flagged, Array.find ignored');
const noten = await dir('notenant', { 'svc.ts': 'const rows = await prisma.order.findMany({ where: { status: "open" }, take: 10 });\n' });
res = await scan(noten); ok(!res.findings.some((f) => f.rule === 'query-without-tenant'), 'query-without-tenant: silent in a single-tenant codebase');

// 14. swallowed-error: a catch with only a comment is not flagged; empty catch is
const sw = await dir('swallow', { 'a.js': 'try { a(); } catch (e) { /* intentionally ignored: cache warmup */ }\ntry { b(); } catch (e) {}\ntry { c(); } catch {}\n' });
res = await scan(sw); { const lines = res.findings.filter((f) => f.rule === 'swallowed-error').map((f) => f.line).sort(); ok(JSON.stringify(lines) === '[2,3]', 'swallowed-error: empty catches flagged, explained catch not'); }

// 15. idempotency rule: quiet when the file mentions idempotency; quiet on non-money routes
const idem = await dir('idem', { 'a.ts': 'app.post("/api/pay", h); // uses Idempotency-Key\n', 'b.ts': 'app.post("/api/comments", h);\n', 'c.ts': 'app.post("/api/checkout", h);\n' });
res = await scan(idem); { const p = res.findings.filter((f) => f.rule === 'mutation-without-idempotency').map((f) => f.path).sort(); ok(JSON.stringify(p) === '["c.ts"]', 'mutation-without-idempotency: only the money route without the word idempotency'); }

// 16. retry rule: real loops only
// the rule looks 15 lines around the loop for backoff, so each case lives in its own file
const retry = await dir('retry', { 'text.js': 'log.warn("queued for retry");\n', 'bare.js': 'for (let attempt = 0; attempt < 3; attempt++) { await call(); }\n', 'good.js': 'for (let attempt = 0; attempt < 3; attempt++) {\n  await call();\n  await sleep(2 ** attempt * 100 + Math.random() * 50);\n}\n' });
res = await scan(retry); { const p = res.findings.filter((f) => f.rule === 'retry-without-backoff').map((f) => f.path); ok(JSON.stringify(p) === '["bare.js"]', 'retry-without-backoff: loop without backoff flagged, with backoff and plain text not'); }

// 17. cookie rule accepts flags within the window; CORS rule needs credentials
// CORS rule looks 8 lines around the wildcard for credentials, so each case lives in its own file
const ck = await dir('cookie', { 'a.js': 'res.cookie("s", t, {\n  httpOnly: true,\n  secure: true,\n});\n', 'open.js': 'app.use(cors({ origin: "*" }));\n', 'bad.js': 'app.use(cors({\n  origin: "*",\n  credentials: true,\n}));\n' });
res = await scan(ck); ok(!res.findings.some((f) => f.rule === 'cookie-without-flags'), 'cookie-without-flags: multi-line options with flags are accepted');
{ const p = res.findings.filter((f) => f.rule === 'cors-wildcard-with-credentials').map((f) => f.path); ok(JSON.stringify(p) === '["bad.js"]', 'cors-wildcard-with-credentials: only the credentialed wildcard is flagged'); }

// 18. Dockerfile variants
const dk = await dir('docker', { 'Dockerfile': 'FROM node:20-alpine\nUSER node\n', 'Dockerfile.dev': 'FROM node:latest\n' });
res = await scan(dk); { const f = res.findings.filter((x) => x.rule === 'dockerfile-latest-or-root'); ok(f.length === 2 && f.every((x) => x.path === 'Dockerfile.dev'), 'dockerfile rule: pinned+USER clean, :latest without USER flagged twice'); }

// 19. env rule
const env = await dir('env', { '.env': 'SECRET=1\n', '.gitignore': 'node_modules\n' });
res = await scan(env); ok(res.findings.some((f) => f.rule === 'env-file-not-ignored'), 'env-file-not-ignored: .env present and not ignored');
const env2 = await dir('env2', { '.env': 'SECRET=1\n', '.gitignore': '.env\n' });
res = await scan(env2); ok(!res.findings.some((f) => f.rule === 'env-file-not-ignored'), 'env-file-not-ignored: quiet when .gitignore lists .env');

// 20. lockfile detection for pnpm/yarn/bun
for (const lock of ['pnpm-lock.yaml', 'yarn.lock', 'bun.lock']) { const d = await dir('lock-' + lock, { 'package.json': '{"name":"x"}', [lock]: '' }); res = await scan(d); ok(!res.findings.some((f) => f.rule === 'no-lockfile'), `no-lockfile: ${lock} recognised`); }

// 21. --version and --help
r = await cli(['--version']); ok(r.code === 0 && /faultline \d+\.\d+\.\d+ · Felipe Guedes/.test(r.out), '--version prints version and author');
r = await cli(['--help']); ok(r.code === 0 && /--fail-on/.test(r.out), '--help prints usage');

// 22. positional dir after flags
r = await cli(['--min', 'low', '--md', path.join(tmp, 'x.md'), med, '--fail-on', 'info']); ok(r.code === 1 && /scanned 1 files/.test(r.out), 'directory is found among flags with values');

// 23. summarize and toMarkdown API
res = await scan(med); { const c = summarize(res); ok(c.medium === 1 && toMarkdown(res).includes('fetch-without-timeout'), 'library API: summarize and toMarkdown'); }

// 24. SQL rule: real SQL flagged, commit messages and Buffer.from are not
const sqlq = await dir('sql', { 'real.js': 'const rows = await db.query(`SELECT * FROM users WHERE email = ${email}`);\n', 'lower.js': 'const q = "select id from orders where status = " + status;\n', 'msg.js': 'const buf = Buffer.from(content, "base64");\nawait api("PUT", url, { message: sha ? `Update ${rel}` : `Add ${rel}` });\n', 'log.js': 'console.log(`Update ${n} rows`);\n' });
res = await scan(sqlq); { const p = res.findings.filter((f) => f.rule === 'sql-string-concat').map((f) => f.path).sort(); ok(JSON.stringify(p) === '["lower.js","real.js"]', 'sql-string-concat: SQL with interpolation flagged (upper and lower case), commit messages and logs not'); }

// 25. swallowed-error: a log that mentions the error is handling, a log that does not is discarding
const swl = await dir('swallow-log', { 'a.js': 'try { a(); } catch (e) { console.log(`failed: ${e.message}`); }\ntry { b(); } catch (err) { console.log("failed"); }\n' });
res = await scan(swl); { const l = res.findings.filter((f) => f.rule === 'swallowed-error').map((f) => f.line); ok(JSON.stringify(l) === '[2]', 'swallowed-error: log with the error is fine, log without it is flagged'); }

// 26. unicode paths and spaces
const uni = await dir('unicode ção', { 'pasta com espaço/ação.js': 'eval(x);\n' });
res = await scan(uni); ok(res.findings.some((f) => f.rule === 'eval-usage' && f.path === 'pasta com espaço/ação.js'), 'unicode and spaces in paths');

await rm(tmp, { recursive: true, force: true });
console.log(`\n${failed ? `${failed} failure(s)` : 'all edge tests passed'} · ${passed} passed`);
process.exit(failed ? 1 : 0);
