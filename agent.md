# Agent operating guide

Read `AGENTS.md` first: it is the authoritative engineering and security policy.
This guide adds branch ownership, execution context, and the work ledger. Read
`CONTRIBUTING.md`, both READMEs, the relevant feature tests, and nested instructions
before editing. Never replace those documents with this summary.

## Branch contract

- `main` is the general-purpose Buzz customization branch. Reusable bug fixes,
  protocol work, accessibility, security, and shared capabilities belong here first.
- `nusuk-buzz` derives from `main` and owns Nusuk-specific assets, themes, voice,
  onboarding, metadata, and public deployment defaults.
- Bring general changes forward deliberately. Do not merge Nusuk branding back
  into `main`. Keep general fixes and branded changes in separate commits.
- Never rewrite history, discard unrelated changes, or publish without approval.
  Use signed-off Conventional Commits and inspect the exact diff before staging.

## System boundaries

- `web/`: browser client; `agent-control/`: optional signed agent-start service;
  `deploy/`: client packaging only. Relay infrastructure and agent runtimes are external.
- Preserve configured Relay routing, NIP-42/NIP-98 authentication, NIP-29
  membership, encrypted identity vaults, and identity/Relay-scoped caches.
- Runtime `config.json` is public and authoritative. Never put credentials in it.
- Preserve persisted identity and theme storage keys across cosmetic rebrands.
  Do not clear storage or generate a replacement identity during migration.
- Mail, SSO, huddles, canvases, and agent creation are not implemented client
  capabilities. Marketing references do not authorize simulated functionality.

## Before every change

1. Inspect branch, status, diff, target files, callers, tests, and actual user flow.
2. State the smallest outcome, files affected, proving check, and rollback commit.
3. Track multi-step work with one active task and explicit blockers.
4. Separate local verification from staging/production. Stop for approval before
   releases, destructive operations, credential changes, or external publishing.
5. Never print environment files, raw private keys, tokens, or full agent configs.
   Public docs use example domains and placeholders, not operator paths or IDs.

## Implementation and proof

- Reuse existing primitives and patterns; no speculative abstractions or dependencies.
- Read before editing. Write a runnable regression test for behavior changes and
  observe it fail before the fix. Test invalid input and partial/network failure.
- Keep all UI copy localized in English and Simplified Chinese. Preserve keyboard,
  focus, touch targets, reduced motion, and contrast in both light and dark themes.
- Never silently swallow errors, announce success before acceptance, or infer
  authorization from a visible control. Preserve drafts on recoverable failures.
- Run Web typecheck, Vitest, Biome/custom checks, build, and Playwright journeys.
  Run Agent Control tests or Compose validation only when those areas change.
- Capture desktop/mobile screenshots for UI changes; check console, overflow,
  keyboard navigation, empty/error states, and theme persistence.
- Review the final diff independently. Report PASS/FAIL/NOT RUN with evidence.
  Do not commit generated builds, screenshots, test reports, or local runtime files.

## Operational handoff

Record source SHA, branch, check commands/results, artifact locations, known gaps,
and the exact next step. Keep deployment runbooks separate from public code.
Do not change Relay membership/data or existing OpenClaw agents as part of a rebrand.

Known external gap: a dedicated Buzz agent bridge was stopped after autonomous
reply delivery failed. Presence/typing are not proof of a published reply. Do not
restart it or label agents operational without a confirmed accepted message.
Open Relay abuse controls and dependency security advisories require separate,
evidence-led work; cosmetic changes do not resolve them.

## Current milestone

- General baseline: existing browser customization retained on `main`.
- `nusuk-buzz`: Nusuk family branding applied; see `docs/nusuk-buzz.md` for verification and remaining gaps.
- Brand authority: `nusuk-labs/nusuk-buzz-vision` and `https://nusuk.buzz/`.
- Preserve existing user flows and data. Deployment is a separate approval gate.
