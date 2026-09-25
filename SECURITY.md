# Security policy

Faultline reads files and prints findings. It makes no network requests, executes no code from the scanned project, and writes only the report you ask for with `--md`.

## Reporting a vulnerability

If you find a way to make Faultline execute code, read files outside the scanned directory, or leak data, email **contato@fgxdev.com** with steps to reproduce. Do not open a public issue for security problems. You will get an answer within three business days, and credit in the fix if you want it.

## Scope

- Rules are heuristics. A missed finding (false negative) or a spurious one (false positive) is a normal issue, not a vulnerability. Open an issue with the code sample.
- Fixtures under `test/fixtures/bad` intentionally contain insecure code and fake credentials. They are not real secrets.
