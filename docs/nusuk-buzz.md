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
- [x] Keep reusable identity work on `main`: profile hydration, readable
  `Member`/`Agent` fallbacks, bounded relay queries, malformed-event guards,
  known-agent channel association, and browser test corrections
  (7b1158e, 7044708, bc05005). Merged into this branch (eb48bfa, 931fee5).
- [x] Complete Nusuk brand copy, invite gradient, Open Graph/Twitter cards,
  favicons and install icons (9838d9d, 4a0705c).
- [x] Declare the known Nusuk Agent in the public config as offline and
  non-startable, and publish its kind:0 profile name/about/avatar.
- [x] Deploy `buzz-web:4a0705c` to https://buzz.nusuk.buzz/app/ and validate
  live HTTP and browser behavior.

Verification: 25 unit-test files / 113 tests pass; typecheck, lint and production
build pass, including `/app/` asset paths and local font loading. The full browser
suite passes 43/43, covering light/dark at 390px and 1440px, short viewports,
Chinese, invite consent, profile editing, channel/member management, local
identity lifecycle, NIP-07, and live-style chat flows.

Live checks: config serves `Nusuk Buzz` with `wss://relay.nusuk.buzz` and the
`Nusuk Agent` descriptor; favicon, 32px icon, Apple icon, 192/512 install icons,
manifest and 1200x640 OG image return 200 with correct MIME types; the app title,
OG/Twitter tags and `Nusuk Agent` (Offline) card render; the marketing site and
relay health remain 200. The agent profile is published on the relay. Unnamed
accounts render a deterministic localized `Member …` label, named accounts
upgrade to their profile name, and no raw hex is used as a display name.

Rollback: restore `/home/gw/ops/buzz-web/releases/4a0705c/config.before.json`
and `compose.before.yml`, then recreate only `web`; previous image
`buzz-web:5b36cda` is retained. No data or storage migration is involved.
Public config uses the existing Nusuk relay; deployment overrides remain
authoritative for workspace names and endpoints; the product title and identity
setup retain the Nusuk Buzz name. The agent is declared offline because its
external bridge is not a working autonomous companion. No runtime service is
modified by this branch.

## Review record

The independent review found no blocker. The short-height clipping finding was
upgraded to important and fixed with auto-margin centering after a regression
test demonstrated a negative card top. All seven brand checks and 113 unit tests
pass after the fix. Keyboard testing now waits for the asynchronous vault check;
Chinese copy and layout have a mobile browser assertion.

Deferred minor work: remove the unused Inter package; audit remaining upstream
Buzz legal/recovery copy before changing legal attribution. Desktop-opening
labels intentionally refer to the upstream Buzz desktop app. Product branding
is intentionally fixed to Nusuk Buzz rather than inferred from community names.
PWA icon installability and a real screen-reader session remain unverified.
The review model catalog returned no coding models; the review used the configured
fallback `opencode-go/deepseek-v4.1-flash`.
