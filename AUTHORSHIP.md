# Authorship and licensing statement

This document states who created faultline, how that authorship is evidenced, and what the license allows and forbids. It is written in plain language on purpose. It is not legal advice.

## 1. The work

| | |
|---|---|
| Name | faultline: find the failure nobody finds |
| Kind | Software (command-line tool, Node.js library and GitHub Action) and its documentation |
| Author and copyright holder | Felipe Guedes, Software Engineer and Systems Architect, Toledo, Paraná, Brazil |
| Contact | contato@fgxdev.com · https://fgxdev.com |
| Canonical repository | https://github.com/thefgxdev/faultline |
| First public release | v0.1.0, 2026-09-25, published on GitHub under the account @thefgxdev |
| Current license | GNU Affero General Public License v3.0 or later (AGPL-3.0-or-later) |
| Package name | `@thefgxdev/faultline` (npm scope owned by the author) |

The design, the rule set, the fix texts, the fixtures, the documentation and the name of this project were written by the author, from the audit practice described at https://fgxdev.com/software-audit-security/. No part of it was copied from another project.

## 2. How authorship is evidenced

Copyright exists from the moment a work is created; no registration is required in Brazil (Lei 9.610/1998 and Lei 9.609/1998, which covers software) or in the countries of the Berne Convention. What matters in a dispute is dated evidence. faultline keeps several independent pieces:

1. **Git history on GitHub.** Every commit is timestamped by GitHub's servers, not by the author's machine.
2. **Dated releases.** Each release is an immutable tag with a date and a tarball. The first one is `v0.1.0` (2026-09-25).
3. **Copyright header in every source file** (`bin/`, `src/`, `test/`): name, site, year and license, so a copied file carries its own origin.
4. **`NOTICE`**, which the AGPL requires downstream copies to keep.
5. **`CITATION.cff`**, a machine-readable citation record (author, date, version, license) that GitHub renders as "Cite this repository".
6. **`faultline --version`** prints the author, and every generated report ends with the author's signature line.
7. **`package.json`** names the author and license; the npm scope `@thefgxdev` is controlled by the author.
8. **The author's own site** (https://fgxdev.com) and social accounts (@thefgxdev) reference the project, and the project references them back.

Recommended additional steps, at the author's discretion: registration of the program at INPI (Brazil) under Lei 9.609/1998, which gives a government-dated certificate; and signed commits (GPG or SSH) so that "Verified" appears on each commit.

## 3. What the license allows and forbids

AGPL-3.0-or-later, in plain words:

| You want to | Allowed? | Condition |
|---|---|---|
| Run faultline on your code, at work, in CI, in a commercial product | Yes | None. Scanning your code creates no obligation; your code is not affected. |
| Read and study the source | Yes | None. |
| Copy the repository, fork it, keep it private | Yes | None, as long as you do not distribute it. |
| Modify faultline and use the modified version internally | Yes | None. |
| Distribute faultline, modified or not (binary, package, tarball, vendored copy) | Yes | You must provide the complete source under AGPL-3.0-or-later, keep the copyright notices and `NOTICE`, and state what you changed. |
| Offer faultline, or a modified faultline, as a network service (SaaS, web UI, hosted scanner) | Yes | Users of that service must be able to obtain the complete corresponding source of the version you run. |
| Put faultline's code inside a closed-source product | No | Not under AGPL. A separate commercial license is available: contato@fgxdev.com. |
| Remove the author's name, the notices or the license | No | Never. |
| Re-publish it as your own work, or under another license | No | Never. This is copyright infringement and a license violation. |
| Use the name "faultline" for a derived project in a way that suggests it is the original | No | Say "based on faultline by Felipe Guedes (fgxdev.com)". |

Documentation in this repository (README, `docs/`) is covered by the same license. Contributions are accepted under the same license through the Developer Certificate of Origin (see `CONTRIBUTING.md`).

## 4. Why AGPL

faultline is free for everyone who uses it. The AGPL adds one guarantee that permissive licenses (MIT, Apache-2.0) do not: anyone who improves it and ships it, as software or as a service, has to publish the improvement under the same terms with the original author's name intact. Improvements come back to the community, and the work cannot be quietly re-labelled or closed. Companies that need a closed modification can license it commercially.

## 5. How to cite or credit

- In a talk, article or paper: use the citation in `CITATION.cff` or "faultline, Felipe Guedes, https://github.com/thefgxdev/faultline".
- In a derived tool: "based on faultline by Felipe Guedes (fgxdev.com)", plus the `NOTICE` file.

## 6. If you find a copy that violates this

A copy published without the notices, under another author's name or under a different license violates the license and copyright law. Report it to contato@fgxdev.com with the link. The author can request removal from GitHub, npm and other hosts under their copyright (DMCA) procedures using the evidence listed in section 2.

## 7. Versions of this statement

| Date | Change |
|---|---|
| 2026-09-25 | First release, v0.1.0, published under MIT. |
| 2026-09-25 | License changed to AGPL-3.0-or-later from v0.1.1 onwards; `NOTICE`, `CITATION.cff` and this statement added. Copies of v0.1.0 obtained under MIT keep the MIT terms for that version only. |

Copyright (c) 2026 Felipe Guedes (fgxdev.com). This statement may be copied verbatim with the software.
