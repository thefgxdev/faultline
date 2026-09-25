// faultline · https://github.com/thefgxdev/faultline
// Copyright (c) 2026 Felipe Guedes (fgxdev.com). MIT License: keep this notice when you copy or adapt this file.
//
// faultline rules. Each rule: id, title, severity, category, files (regex on path), test(ctx) → findings.
// Rules are heuristics tuned for low false positives: they point at boundaries a human should read. They do not prove bugs.
// ctx = { path, text, lines, ext, repo: { hasTenant, hasLockfile, deps } }

const SEV = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
const CODE = /\.(m?[jt]sx?|cjs|cts|mts)$/;
const SQLISH = /\.(sql|m?[jt]sx?|cjs|py|php|rb|go)$/;
const WEBISH = /\.(m?[jt]sx?|html?|vue|svelte|astro|php)$/;

const lineOf = (text, index) => text.slice(0, index).split('\n').length;
const near = (lines, i, radius, re) => { for (let k = Math.max(0, i - radius); k <= Math.min(lines.length - 1, i + radius); k++) if (re.test(lines[k])) return true; return false; };
const ignored = (lines, i) => /faultline-ignore/.test(lines[i]) || (i > 0 && /faultline-ignore-next/.test(lines[i - 1]));
const find = (ctx, re, make) => { const out = []; for (const m of ctx.text.matchAll(re)) { const line = lineOf(ctx.text, m.index); if (ignored(ctx.lines, line - 1)) continue; const f = make(m, line); if (f) out.push({ line, ...f }); } return out; };

export const rules = [
  {
    id: 'secret-in-code', title: 'Credential committed in source', severity: 'critical', category: 'secrets', files: /.*/,
    fix: 'Move it to an environment variable or a secrets manager, rotate the credential now (it is already exposed in history), and add a secret scanner to CI.',
    test: (ctx) => find(ctx, /(AKIA[0-9A-Z]{16}|sk_live_[0-9a-zA-Z]{16,}|ghp_[0-9A-Za-z]{30,}|xox[baprs]-[0-9A-Za-z-]{10,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|AIza[0-9A-Za-z_-]{30,})/g, (m) => ({ evidence: m[0].slice(0, 12) + '…' })),
  },
  {
    id: 'password-literal', title: 'Password or secret assigned as a literal', severity: 'high', category: 'secrets', files: CODE,
    fix: 'Read it from configuration at startup and fail fast if missing. Never a literal, even in "temporary" code.',
    test: (ctx) => find(ctx, /\b(password|passwd|secret|api[_-]?key|token)\s*[:=]\s*['"`][^'"`\n]{8,}['"`]/gi, (m, line) => (/example|placeholder|changeme|your[_-]|xxx|\$\{|process\.env|test|mock|fixture/i.test(ctx.lines[line - 1]) ? null : { evidence: ctx.lines[line - 1].trim().slice(0, 80) })),
  },
  {
    id: 'fetch-without-timeout', title: 'Outbound call without a timeout', severity: 'medium', category: 'boundaries', files: CODE,
    fix: 'Pass an AbortSignal (AbortSignal.timeout(ms)) or the client\'s timeout option. A call without a timeout can hold a request thread forever; keep it shorter than the caller\'s timeout.',
    test: (ctx) => find(ctx, /\b(fetch|axios(?:\.(?:get|post|put|patch|delete|request))?|got|ky|undici\.request)\s*\(/g, (m, line) => (near(ctx.lines, line - 1, 6, /signal|timeout|AbortController|AbortSignal/) ? null : { evidence: ctx.lines[line - 1].trim().slice(0, 80) })),
  },
  {
    id: 'retry-without-backoff', title: 'Retry loop without backoff or jitter', severity: 'medium', category: 'boundaries', files: CODE,
    fix: 'Add exponential backoff with jitter and a maximum number of attempts. Retrying immediately turns one failure into a self-inflicted flood.',
    test: (ctx) => find(ctx, /\b(?:retry|retries|attempts?)\b[^\n]*\b(?:for|while)\s*\(|\b(?:for|while)\s*\([^\n]*\b(?:retry|retries|attempts?)\b/gi, (m, line) => (near(ctx.lines, line - 1, 15, /backoff|jitter|sleep|delay|setTimeout|wait\(/i) ? null : { evidence: ctx.lines[line - 1].trim().slice(0, 80) })),
  },
  {
    id: 'swallowed-error', title: 'Error caught and discarded', severity: 'medium', category: 'errors', files: CODE,
    fix: 'Decide at the boundary: retry, degrade or fail. If ignoring is correct, log it with context and say why in a comment.',
    // a catch whose only content is a comment is considered a deliberate, explained decision and is not flagged
    test: (ctx) => find(ctx, /catch\s*(?:\([^)]*\))?\s*\{\s*(?:console\.(?:log|debug)\([^)]*\);?\s*)?\}/g, (m) => ({ evidence: m[0].replace(/\s+/g, ' ').slice(0, 80) })),
  },
  {
    id: 'sql-string-concat', title: 'SQL built by string concatenation or interpolation', severity: 'high', category: 'injection', files: SQLISH,
    fix: 'Use parameterised queries ($1, ?, named parameters) or the query builder\'s bindings. Never interpolate user input into SQL.',
    test: (ctx) => find(ctx, /(['"`])\s*(?:SELECT|INSERT|UPDATE|DELETE|WHERE)\b[^'"`\n]*(?:\$\{[^}]+\}|['"`]\s*\+\s*[A-Za-z_])/gi, (m, line) => ({ evidence: ctx.lines[line - 1].trim().slice(0, 80) })),
  },
  {
    id: 'shell-exec-interpolation', title: 'Shell command built from variables', severity: 'high', category: 'injection', files: CODE,
    fix: 'Use execFile/spawn with an argument array, never a concatenated command string.',
    test: (ctx) => find(ctx, /\b(?:exec|execSync)\s*\(\s*(?:`[^`]*\$\{|['"][^'"]*['"]\s*\+)/g, (m, line) => ({ evidence: ctx.lines[line - 1].trim().slice(0, 80) })),
  },
  {
    id: 'eval-usage', title: 'eval or new Function on dynamic input', severity: 'high', category: 'injection', files: CODE,
    fix: 'Remove it. Use a parser, a lookup table or a sandboxed runtime designed for untrusted code.',
    test: (ctx) => find(ctx, /\b(?:eval|new Function)\s*\(\s*(?!['"`][^'"`]*['"`]\s*\))/g, (m) => ({ evidence: m[0].slice(0, 80) })),
  },
  {
    id: 'unsafe-html', title: 'HTML injected from a variable', severity: 'medium', category: 'injection', files: WEBISH,
    fix: 'Render text through the template engine or React; if HTML is required, sanitise with an allow-list first.',
    test: (ctx) => find(ctx, /(?:dangerouslySetInnerHTML\s*=\s*\{\{\s*__html\s*:\s*(?!['"`])|\.innerHTML\s*=\s*(?!['"`]))/g, (m, line) => ({ evidence: ctx.lines[line - 1].trim().slice(0, 80) })),
  },
  {
    id: 'insecure-random-for-secret', title: 'Math.random used for a token, code or password', severity: 'high', category: 'auth', files: CODE,
    fix: 'Use crypto.randomBytes / crypto.randomUUID / crypto.getRandomValues. Math.random is predictable.',
    test: (ctx) => find(ctx, /Math\.random\(\)/g, (m, line) => (near(ctx.lines, line - 1, 4, /token|otp|password|secret|nonce|session|reset|verif/i) ? { evidence: ctx.lines[line - 1].trim().slice(0, 80) } : null)),
  },
  {
    id: 'cookie-without-flags', title: 'Cookie set without httpOnly / secure / sameSite', severity: 'medium', category: 'auth', files: CODE,
    fix: 'Set httpOnly, secure and sameSite on every session or auth cookie.',
    test: (ctx) => find(ctx, /(?:res\.cookie|cookies\(\)\.set|setCookie|response\.cookies\.set)\s*\(/g, (m, line) => (near(ctx.lines, line - 1, 6, /httpOnly/i) && near(ctx.lines, line - 1, 6, /secure/i) ? null : { evidence: ctx.lines[line - 1].trim().slice(0, 80) })),
  },
  {
    id: 'jwt-verify-without-algorithms', title: 'JWT verified without pinning algorithms', severity: 'medium', category: 'auth', files: CODE,
    fix: 'Pass { algorithms: ["HS256"] } (or your algorithm) to verify. Algorithm confusion is a classic bypass.',
    test: (ctx) => find(ctx, /\bjwt\.verify\s*\(/g, (m, line) => (near(ctx.lines, line - 1, 4, /algorithms/) ? null : { evidence: ctx.lines[line - 1].trim().slice(0, 80) })),
  },
  {
    id: 'cors-wildcard-with-credentials', title: 'CORS allows any origin with credentials', severity: 'high', category: 'auth', files: CODE,
    fix: 'Use an explicit allow-list of origins. "*" with credentials lets any site act as the logged-in user.',
    test: (ctx) => find(ctx, /Access-Control-Allow-Origin['"]?\s*[,:]\s*['"]\*['"]|origin\s*:\s*['"]\*['"]|origin\s*:\s*true/g, (m, line) => (near(ctx.lines, line - 1, 8, /credentials\s*:\s*true|Allow-Credentials['"]?\s*[,:]\s*['"]?true/) ? { evidence: ctx.lines[line - 1].trim().slice(0, 80) } : null)),
  },
  {
    id: 'mutation-without-idempotency', title: 'Money or irreversible endpoint without an idempotency key', severity: 'medium', category: 'idempotency', files: CODE,
    fix: 'Accept an Idempotency-Key scoped to the principal, store it before the side effect, and return the stored result on repeat. Double submits and lost responses are normal.',
    test: (ctx) => (/idempoten/i.test(ctx.text) ? [] : find(ctx, /(?:\.(?:post|put|patch)\s*\(\s*['"`][^'"`]*(?:pay|charge|checkout|order|refund|transfer|withdraw|send|invoice|subscribe)[^'"`]*['"`]|export\s+async\s+function\s+(?:POST|PUT|PATCH)\b)/gi, (m, line) => (/\/api\/|route\.|pay|charge|checkout|order|refund|transfer|withdraw|send|invoice|subscri/i.test(ctx.path + m[0]) ? { evidence: ctx.lines[line - 1].trim().slice(0, 80) } : null))),
  },
  {
    id: 'query-without-tenant', title: 'Query in a multi-tenant codebase without a tenant filter nearby', severity: 'low', category: 'tenancy', files: CODE,
    fix: 'Filter by tenant in every read, or enforce it with row-level security so a forgotten filter returns nothing instead of everything.',
    // only ORM/query-builder reads; Array.prototype.find and DOM .select() are not queries
    test: (ctx) => (!ctx.repo.hasTenant || /tenant|org(?:anization)?Id|workspace/i.test(ctx.path) ? [] : find(ctx, /\.(?:findMany|findFirst|findUnique|findAll|findOne)\s*\(|\bfrom\(\s*['"][^'"]+['"]\s*\)\s*\.select\s*\(|\.query\(\s*['"`]\s*SELECT\b/gi, (m, line) => (near(ctx.lines, line - 1, 8, /tenant|organization|orgId|workspace|account_id|accountId|rls|row_level/i) ? null : { evidence: ctx.lines[line - 1].trim().slice(0, 80) }))),
  },
  {
    id: 'select-star', title: 'SELECT * in application code', severity: 'low', category: 'data', files: SQLISH,
    fix: 'List the columns. SELECT * serialises fields you did not mean to expose and breaks when the table changes.',
    test: (ctx) => find(ctx, /SELECT\s+\*\s+FROM\b/gi, (m, line) => (/count|EXISTS|information_schema|pg_|migration|seed|fixture|test/i.test(ctx.lines[line - 1] + ctx.path) ? null : { evidence: ctx.lines[line - 1].trim().slice(0, 80) })),
  },
  {
    id: 'unbounded-list-query', title: 'List query without a limit', severity: 'low', category: 'data', files: CODE,
    fix: 'Paginate: take/limit plus a cursor. One customer with a million rows will find this endpoint.',
    test: (ctx) => find(ctx, /\.findMany\s*\(\s*(?:\{[^}]*\})?\s*\)/g, (m) => (/take\s*:|limit\s*:/.test(m[0]) ? null : { evidence: m[0].replace(/\s+/g, ' ').slice(0, 80) })),
  },
  {
    id: 'blank-target-without-noopener', title: 'target="_blank" without rel="noopener"', severity: 'low', category: 'web', files: WEBISH,
    fix: 'Add rel="noopener noreferrer". The opened page can otherwise navigate yours.',
    test: (ctx) => find(ctx, /<a\b[^>]*target=["']_blank["'][^>]*>/g, (m) => (/noopener/.test(m[0]) ? null : { evidence: m[0].slice(0, 80) })),
  },
  {
    id: 'dockerfile-latest-or-root', title: 'Dockerfile uses :latest or runs as root', severity: 'low', category: 'infra', files: /(?:^|\/)Dockerfile[^/]*$/,
    fix: 'Pin the base image tag and add a USER instruction. Unpinned images change under you; root containers widen every exploit.',
    test: (ctx) => { const out = []; for (const m of ctx.text.matchAll(/^FROM\s+[^\s]+:latest\b/gm)) out.push({ line: lineOf(ctx.text, m.index), evidence: m[0] }); if (!/^USER\s+/m.test(ctx.text)) out.push({ line: 1, evidence: 'no USER instruction' }); return out; },
  },
  {
    id: 'env-file-not-ignored', title: '.env file present and not git-ignored', severity: 'high', category: 'secrets', files: /(?:^|\/)\.gitignore$/,
    fix: 'Add .env and .env.* to .gitignore, remove the file from history, rotate what it contained.',
    test: (ctx) => (ctx.repo.hasEnvFile && !/^\s*\.env(?:\*|\.\*)?\s*$/m.test(ctx.text) ? [{ line: 1, evidence: '.env exists but .gitignore does not list it' }] : []),
  },
];

export const repoRules = [
  {
    id: 'no-lockfile', title: 'No lockfile committed', severity: 'medium', category: 'supply-chain',
    fix: 'Commit package-lock.json, pnpm-lock.yaml or yarn.lock so every install is reproducible.',
    test: (repo) => (repo.hasPackageJson && !repo.hasLockfile ? [{ path: 'package.json', line: 1, evidence: 'package.json without a lockfile' }] : []),
  },
  {
    id: 'no-rate-limit', title: 'HTTP server without a rate limiter in dependencies', severity: 'info', category: 'boundaries',
    fix: 'Add rate limiting on login, password reset, OTP and expensive endpoints, in the app or at the edge.',
    test: (repo) => (repo.deps.some((d) => /^(express|fastify|koa|hono|@nestjs\/core|next)$/.test(d)) && !repo.deps.some((d) => /rate-?limit|throttl|@upstash\/ratelimit|bottleneck/i.test(d)) ? [{ path: 'package.json', line: 1, evidence: 'no rate-limit dependency (may be handled at the edge)' }] : []),
  },
];

export { SEV };
