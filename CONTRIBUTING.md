# Contributing

Thank you. faultline grows one rule at a time, and every rule needs three things.

## A rule

1. Add it to `src/rules.mjs`: `id`, `title`, `severity`, `category`, `files`, `fix`, `test(ctx)`.
2. Add a line to `test/fixtures/bad` that must trigger it, and make sure `test/fixtures/good` stays quiet.
3. Document it in `docs/rules.md`: triggers on, silent when, fix.
4. Run `node test/run.mjs` and `node bin/faultline.mjs . --fail-on high`. Both must pass.

Rules must be explainable in one sentence and must ship with the fix. Rules that fire on most real codebases are wrong, not thorough.

## Sign-off

By submitting a pull request you certify the Developer Certificate of Origin (developercertificate.org): the contribution is yours to give and you agree it is released under the MIT License of this project. Add `Signed-off-by: Your Name <email>` to your commits.

## Attribution

faultline is created and maintained by Felipe Guedes (fgxdev.com). Contributors are credited in the release notes. Forks and derived tools must keep the copyright notice and the LICENSE, as the MIT License requires; a mention "based on faultline by Felipe Guedes" is appreciated.

## Issues

- False positive or false negative: open an issue with the smallest code sample that reproduces it.
- Idea for a rule: open an issue titled `rule: <what it finds>` with one example of the failure it prevents.
