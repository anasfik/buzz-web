# Nusuk Buzz branch plan and brand contract

Reference: `nusuk-labs/nusuk-buzz-vision` at
`b47e5d70240f0e9d9ebe42ef4704e6965202753f` and https://nusuk.buzz/.

## Outcome

Keep `main` general-purpose. This branch owns Nusuk branding, public defaults,
and the calm, key-owned collaboration experience. Existing messaging, identities,
Chinese localization, theme preferences, and protocol behavior remain intact.
No mail, SSO, huddles, canvases, or autonomous agent capabilities are added.

## Design system

Emerald surfaces, ivory text and gold actions follow the reference dark palette.
Light mode uses warm ivory and emerald ink. Manrope is the reading face;
Cormorant Garamond is reserved for the welcome heading. Existing compact workspace
spacing and controls remain unchanged. The source logo is bundled locally.
No remote fonts, new JavaScript dependencies, or new motion are required.

## Execution ledger

- [x] General `agent.md` committed on `main` before branching (411d413).
- [x] Apply brand assets, tokens, welcome copy, metadata and config.
- [x] Verify unit, type, lint, build and browser paths, desktop and mobile.
- [x] Independent review and affected-path re-review: no remaining blockers.
- [x] Commit and push both branches: general baseline `411d413`, brand wave `0183076`.
  Deployment is separate and has not been performed.

Verification: 25 unit-test files / 101 tests pass; typecheck, lint and production
build pass, including `/app/` asset paths and local font loading. Seven welcome
checks cover light/dark at 390px and 1440px, short 320/390x480 viewports and Chinese
on mobile. Workspace screenshots at the same
widths show no horizontal overflow or console errors. Measured text, muted text,
button and focus contrast exceed AA thresholds in both themes.

The full browser suite reports 39 passes and one existing test mismatch:
`tests/e2e/p0.spec.ts:219` clicks Save profile after entering an invalid picture
URL, although the unchanged settings form disables that action and already shows
the validation error. This general test issue is not changed on the brand branch.
Live relay writes, deployment and a real screen-reader session are not tested.

Rollback: return to the general baseline commit; no data or storage migration.
Public config uses the existing Nusuk relay; deployment overrides remain
authoritative for workspace names and endpoints; the product title and identity
setup retain the Nusuk Buzz name. Empty agent configuration is deliberate: the external bridge is
not a working autonomous companion. No runtime service is modified here.

## Review record

The independent review found no blocker. The short-height clipping finding was
upgraded to important and fixed with auto-margin centering after a regression
test demonstrated a negative card top. All seven brand checks and 101 unit tests
pass after the fix. Keyboard testing now waits for the asynchronous vault check;
Chinese copy and layout have a mobile browser assertion.

Deferred minor work: remove the unused Inter package; audit remaining upstream
Buzz legal/recovery copy before changing legal attribution. Desktop-opening
labels intentionally refer to the upstream Buzz desktop app. Product branding
is intentionally fixed to Nusuk Buzz rather than inferred from community names.
PWA icon installability and a real screen-reader session remain unverified.
The review model catalog returned no coding models; the review used the configured
fallback `opencode-go/deepseek-v4.1-flash`.
