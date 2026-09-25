<h1 align="center">faultline</h1>
<p align="center"><b>Find the failure nobody finds.</b></p>
<p align="center">A zero-dependency auditor for the boundaries in your codebase: outbound calls without timeouts, retries without backoff, swallowed errors, money endpoints without idempotency keys, SQL and shell built from strings, secrets in code, cookies without flags, queries that forget the tenant.</p>
<p align="center">
  <a href="https://github.com/thefgxdev/faultline/actions/workflows/ci.yml"><img alt="ci" src="https://github.com/thefgxdev/faultline/actions/workflows/ci.yml/badge.svg"></a>
  <img alt="node" src="https://img.shields.io/badge/node-%3E%3D18-339933?logo=nodedotjs&logoColor=white">
  <img alt="dependencies" src="https://img.shields.io/badge/dependencies-0-4f8cff">
  <img alt="license" src="https://img.shields.io/badge/license-AGPL--3.0-blue">
</p>

```bash
npx github:thefgxdev/faultline .
# without git installed:
npx https://codeload.github.com/thefgxdev/faultline/tar.gz/main .
```

```
faultline · scanned 214 files in /srv/shop

CRITICAL Credential committed in source  [secret-in-code]
         fix: Move it to an environment variable or a secrets manager, rotate the credential now …
         src/api/pay.ts:7  sk_live_51H8…
HIGH     SQL built by string concatenation or interpolation  [sql-string-concat]
         fix: Use parameterised queries ($1, ?, named parameters) …
         src/api/pay.ts:13  `SELECT * FROM orders WHERE id = ${req.body.orderId}`
HIGH     Shell command built from variables  [shell-exec-interpolation]
         src/api/pay.ts:16  exec(`convert ${req.body.file} out.png`)
MEDIUM   Outbound call without a timeout  [fetch-without-timeout]
         src/api/pay.ts:12  const r = await fetch('https://api.payments.example/charge', …
MEDIUM   Money or irreversible endpoint without an idempotency key  [mutation-without-idempotency]
         src/api/pay.ts:10  app.post('/api/pay', async (req, res) => {
MEDIUM   Error caught and discarded  [swallowed-error]
         src/api/pay.ts:17  catch (e) {}

  critical 1 · high 4 · medium 6 · low 3 · info 1
```

## Why

Across 600+ systems built, reviewed or audited, the pattern never changes: **the failure is in a boundary someone trusted.** The network call that has no timeout. The payment endpoint that charges twice when the client retries. The `catch` that hides the outage. The query that forgets `tenant_id`. None of these is exotic; all of them are found by reading the code where money and data pass.

faultline reads that code for you first, so the human review starts at the right lines. It is a flashlight, not a judge: every finding names the boundary, shows the evidence and says what to do.

## What it finds

| Category | Rules |
|---|---|
| **Secrets** | credentials committed in source · password/secret literals · `.env` present but not git-ignored |
| **Boundaries** | outbound call without timeout · retry loop without backoff · HTTP server without rate limiting |
| **Errors** | error caught and discarded |
| **Idempotency** | money or irreversible endpoint without an idempotency key |
| **Injection** | SQL from string concatenation · shell command from variables · `eval` / `new Function` · HTML injected from a variable |
| **Auth** | `Math.random` for tokens · cookies without `httpOnly`/`secure` · JWT verified without pinned algorithms · CORS `*` with credentials |
| **Tenancy** | query in a multi-tenant codebase without a tenant filter nearby |
| **Data** | `SELECT *` · list query without a limit |
| **Web / infra** | `target="_blank"` without `noopener` · Dockerfile `:latest` or running as root · no lockfile |

Full descriptions, severities and fixes in [`docs/rules.md`](docs/rules.md).

## Usage

```bash
# scan the current directory, fail the process on high or critical findings
npx github:thefgxdev/faultline . --fail-on high

# write a Markdown report and only show medium and above
npx github:thefgxdev/faultline ./apps/api --min medium --md faultline-report.md

# machine-readable
npx github:thefgxdev/faultline . --json > findings.json
```

Ignore paths with `--ignore "glob"` (repeatable) or a `.faultlineignore` file. Silence one line with `// faultline-ignore`, or the next line with `// faultline-ignore-next`. Silences are visible in review; that is the point.

### GitHub Action

```yaml
- uses: thefgxdev/faultline@main
  with:
    path: .
    fail-on: high
```

### As a library

```js
import { scan, toMarkdown } from 'faultline/src/scan.mjs';
const result = await scan('./my-app', { minSeverity: 'low' });
console.log(result.findings.length, toMarkdown(result));
```

## Design

- **Zero dependencies.** Node 18+. Nothing to install, nothing to trust.
- **Heuristics, honestly labelled.** Rules are regular expressions with context windows, tuned for low false positives on real codebases. They do not parse your program; they point at boundaries. A finding is an invitation to read, not a verdict.
- **Fixes, not just alarms.** Every rule ships with the change that closes it.
- **CI-first.** Exit code by severity, Markdown report, JSON output, composite Action.
- **Fast.** Walks the tree once, skips `node_modules`, `dist`, `.git`, and files over 1 MB.

## Adding a rule

A rule is an object in [`src/rules.mjs`](src/rules.mjs): `id`, `title`, `severity`, `category`, `files` (path regex), `fix`, and `test(ctx)` returning `[{ line, evidence }]`. Add a line to the bad fixture that must trigger it and keep the good fixture quiet, then `node test/run.mjs`. Pull requests with a rule, its fixture and its fix text are welcome.

## Roadmap

- Rules for Python, Go and PHP boundaries (the file matchers already accept them; the rule set is JavaScript/TypeScript-first today).
- SARIF output for code-scanning integrations.
- Baseline file to adopt faultline on a large legacy codebase without fixing everything on day one.

## Em português

Auditor sem dependências que encontra as falhas nas fronteiras do seu código: chamadas sem timeout, retentativas sem backoff, erros engolidos, endpoints de pagamento sem chave de idempotência, SQL e shell montados por string, segredos no código, cookies sem flags, consultas que esquecem o tenant. Um comando, relatório em Markdown, bloqueia o CI. Feito a partir da prática de auditoria descrita em [fgxdev.com/pt/auditoria-de-software-e-seguranca](https://fgxdev.com/pt/auditoria-de-software-e-seguranca/).

## Authorship and license

faultline is created and maintained by **[Felipe Guedes](https://fgxdev.com)**, Software Engineer and Systems Architect, Toledo, Paraná, Brazil. First published on 2026-09-25 at [github.com/thefgxdev/faultline](https://github.com/thefgxdev/faultline). Every source file carries the copyright notice; `faultline --version` prints it; every report is signed.

**License: AGPL-3.0-or-later.** Use it freely, in any project, commercial or not: running faultline on your code creates no obligation. If you modify faultline and distribute it, or offer it as a service, you must publish your modified source under the same license and keep the author's notice. That is the whole point: improvements come back, and nobody re-labels this work as theirs. See [`AUTHORSHIP.md`](AUTHORSHIP.md) for the full authorship and licensing statement, plus [`LICENSE`](LICENSE), [`NOTICE`](NOTICE), [`CITATION.cff`](CITATION.cff), [`SECURITY.md`](SECURITY.md) and [`CONTRIBUTING.md`](CONTRIBUTING.md). Commercial licensing for closed modifications: contato@fgxdev.com.
