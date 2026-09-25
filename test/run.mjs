// faultline tests: the bad fixture must trigger each expected rule; the good fixture must stay quiet.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scan } from '../src/scan.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const bad = await scan(path.join(here, 'fixtures', 'bad'));
const good = await scan(path.join(here, 'fixtures', 'good'));
const rulesHit = new Set(bad.findings.map((f) => f.rule));
const expected = ['secret-in-code', 'password-literal', 'fetch-without-timeout', 'swallowed-error', 'sql-string-concat', 'shell-exec-interpolation', 'insecure-random-for-secret', 'cookie-without-flags', 'jwt-verify-without-algorithms', 'mutation-without-idempotency', 'select-star', 'unbounded-list-query', 'blank-target-without-noopener', 'unsafe-html', 'dockerfile-latest-or-root', 'no-lockfile', 'no-rate-limit', 'retry-without-backoff'];
let failed = 0;
for (const r of expected) { if (rulesHit.has(r)) console.log(`ok   bad fixture triggers ${r}`); else { console.log(`FAIL bad fixture missing ${r}`); failed++; } }
const goodSerious = good.findings.filter((f) => f.severity !== 'info');
if (goodSerious.length) { console.log(`FAIL good fixture has ${goodSerious.length} findings above info:`); for (const f of goodSerious) console.log(`     ${f.rule} ${f.path}:${f.line} ${f.evidence}`); failed++; } else console.log('ok   good fixture is clean above info');
console.log(`\n${failed ? `${failed} failure(s)` : 'all tests passed'} · bad: ${bad.findings.length} findings · good: ${good.findings.length} findings`);
process.exit(failed ? 1 : 0);
