# Rules

Every rule is a heuristic with a context window. Severity says how urgently a human should read the line; it is not a proof.

| Rule | Severity | Triggers on | Silent when | Fix |
|---|---|---|---|---|
| `secret-in-code` | critical | AWS keys, Stripe live keys, GitHub tokens, Slack tokens, Google API keys, private key blocks | never | Move to env or a secrets manager; rotate now; add a scanner to CI |
| `password-literal` | high | `password`, `secret`, `apiKey`, `token` assigned a literal of 8+ chars | the line mentions example, placeholder, changeme, `process.env`, test, mock, fixture | Read from configuration at startup; fail fast if missing |
| `env-file-not-ignored` | high | a `.env` file exists and `.gitignore` does not list `.env` | `.env.example` / `.env.sample` only | Ignore `.env*`, purge history, rotate |
| `fetch-without-timeout` | medium | `fetch(`, `axios(`, `got(`, `ky(`, `undici.request(` | `signal`, `timeout`, `AbortController` or `AbortSignal` within 6 lines | `AbortSignal.timeout(ms)` or the client's timeout, shorter than the caller's |
| `retry-without-backoff` | medium | a loop whose line mentions retry/attempts | backoff, jitter, sleep, delay, setTimeout or wait within 15 lines | Exponential backoff with jitter and a maximum |
| `no-rate-limit` | info | express/fastify/koa/hono/nest/next in dependencies without a rate-limit package | a rate-limit dependency exists (edge rate limiting is not detected) | Rate limit login, reset, OTP and expensive endpoints |
| `swallowed-error` | medium | `catch {}` empty, or containing only `console.log` | anything else in the block | Retry, degrade or fail; if ignoring is right, log with context and say why |
| `mutation-without-idempotency` | medium | `.post/.put/.patch('…pay|charge|checkout|order|refund|transfer|withdraw|send|invoice|subscribe…')` or `export async function POST/PUT/PATCH` in an API route | the file mentions idempotency anywhere | Idempotency key scoped to the principal, stored before the side effect |
| `sql-string-concat` | high | a string starting with SELECT/INSERT/UPDATE/DELETE/WHERE containing `${…}` or `' + var` | never | Parameterised queries |
| `shell-exec-interpolation` | high | `exec(`/`execSync(` with a template literal containing `${` or string concatenation | never | `execFile`/`spawn` with an argument array |
| `eval-usage` | high | `eval(` or `new Function(` with a non-literal argument | literal string argument | Remove; use a parser, a table or a sandbox |
| `unsafe-html` | medium | `dangerouslySetInnerHTML={{ __html: <non-literal>` or `.innerHTML = <non-literal>` | literal strings | Render as text or sanitise with an allow-list |
| `insecure-random-for-secret` | high | `Math.random()` within 4 lines of token/otp/password/secret/nonce/session/reset/verif | no such word nearby | `crypto.randomBytes` / `randomUUID` / `getRandomValues` |
| `cookie-without-flags` | medium | `res.cookie(`, `cookies().set(`, `setCookie(`, `response.cookies.set(` | `httpOnly` and `secure` within 6 lines | Set httpOnly, secure and sameSite |
| `jwt-verify-without-algorithms` | medium | `jwt.verify(` | `algorithms` within 4 lines | Pin the algorithm list |
| `cors-wildcard-with-credentials` | high | `Access-Control-Allow-Origin: *`, `origin: '*'` or `origin: true` with credentials enabled within 8 lines | no credentials nearby | Explicit origin allow-list |
| `query-without-tenant` | low | `.findMany/.findFirst/.findUnique/.find/.findAll/.select(` in a repository that uses `tenant_id`/`tenantId`/`organizationId`/`workspaceId` | tenant/org/workspace/account/rls within 8 lines, or the file path names the tenant module | Filter by tenant everywhere or enforce row-level security |
| `select-star` | low | `SELECT * FROM` | count/EXISTS/catalog queries, migrations, seeds, fixtures, tests | List the columns |
| `unbounded-list-query` | low | `.findMany()` or `.findMany({…})` without `take`/`limit` | `take` or `limit` present | Paginate with a cursor |
| `blank-target-without-noopener` | low | `<a … target="_blank">` | `noopener` present | Add `rel="noopener noreferrer"` |
| `dockerfile-latest-or-root` | low | `FROM …:latest`; no `USER` instruction | pinned tag and a `USER` | Pin the tag; add `USER` |
| `no-lockfile` | medium | `package.json` without `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock` or `bun.lock` | a lockfile exists | Commit the lockfile |

## Suppressing

- `// faultline-ignore` on the line, or `// faultline-ignore-next` on the line above.
- `.faultlineignore` at the scan root with one glob per line, or `--ignore <glob>`.

Suppressions are meant to be visible in code review. A silenced rule with no comment explaining why is itself a finding for a human.

## Severity guide

| Severity | Read it |
|---|---|
| critical | now; it is exploitable or already leaked |
| high | before the next deploy |
| medium | this sprint |
| low | when touching the file |
| info | context for the reviewer |
