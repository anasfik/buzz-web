# Brand kit: spawn a Buzz Web variant

One brand profile drives the whole visible brand surface, so a new app is a profile plus a short
manual pass over product code and tests. `brand/nusuk.json` is the worked example: applying it to
`origin/nusuk-buzz` produces **zero changes**, so the profile is a faithful extraction, not a
reinterpretation.

```bash
# What the scaffold would do (writes nothing, reads the base ref with git show)
node scripts/brand/new-app.mjs --profile brand/<id>.json --from origin/nusuk-buzz --dry-run

# Create branch <id> in a new worktree and apply the profile
node scripts/brand/new-app.mjs --profile brand/<id>.json --from origin/nusuk-buzz --path ../<id>-work
```

## 1. What to send for a new app

Send this filled in, plus the artwork files (or an explicit "reuse placeholder art"). Nothing else is
needed to start; anything missing is asked for before the branch is created.

```markdown
App
  display name:   <product name as users see it, e.g. "Aurora Buzz">   max 60 chars
  short name:     <home-screen label>                                  max 30 chars
  slug (id):      <lowercase a-z0-9-, 2-31 chars; branch + asset prefix>
  community name: <name shown in the app header and welcome heading>

Relay and hosting
  relay:          wss://<relay host>
  public app URL: https://<host>/<base path>     (build target for og:image)
  relay features: forum on/off, projects on/off

Audience and voice
  positioning:    <one sentence: what it is, for whom>
  tagline:        en: <one line>
                  zh-CN: <one line>
  description:    en: <one or two sentences for social cards>
                  zh-CN: <optional>
  manifest text:  en: <install description, one sentence>

Brand tokens
  theme color:    #RRGGBB   (browser chrome, PWA theme_color)
  background:     #RRGGBB   (PWA background_color; defaults to theme color)
  light/dark surfaces: <list the values, or "reuse the Nusuk emerald/ivory palette">
  fonts:          reading face <name + files>, display face <name + files, optional>
                  (self-hosted only: no remote font hosts)

Artwork (one file each)
  favicon .ico, 32x32 png, 180x180 apple png, 192x192 png, 512x512 png,
  1200x640 OG image, in-app logo png

Product
  features in:    <forum, projects, Nusuk SSO, demo mode, ...>
  features out:   <anything this app must not ship>
  product flags:  nusukAuth: true|false, other product-specific switches

Success criteria
  <what must work at 1440 and 390, in English and Simplified Chinese,
   and what "live" means: URL, health checks, screenshots>
```

The profile schema is `brand/profile.schema.json`; copy `brand/nusuk.json` and edit it. Unknown or
missing fields are refused before anything is written.

## 2. Pipeline

### Phase 1 - profile and branch

1. Write `brand/<id>.json` from the spec.
2. Dry run, check the plan and the reported values.
3. Run without `--dry-run`. The script creates branch `<id>` in `--path` (default
   `<repo>/../<id>-work`) from `--from` and rewrites only the brand surface in section 3.

Base ref: default is `nusuk-buzz`. Pass `--from origin/nusuk-buzz` when the local branch may hold
unpushed work, so the variant starts from a reviewed, pushed tip.

Re-running with the same `--path` reapplies the profile to that worktree and reports `0 change(s)`
when nothing differs. It never recreates an existing branch, never touches `main`, and never pushes.

### Phase 2 - product code and theme (manual)

The script does not touch code. Decide what the variant keeps:

- **Nusuk SSO - remove unless the new app uses it.** In the base ref, `nusuk-auth.ts` does not exist;
  where it does, it is wired through `web/src/shared/lib/nusuk-auth.ts` plus:
  - `web/src/features/chat/ui/IdentityGate.tsx`: the import block, `restoreNusukSession`,
    `completeNusukLogin`, the "Continue with Nusuk" button and its state, and
    `clearNusukSession` on sign-out;
  - `web/src/shared/lib/nostr-signer.ts`: the `"nusuk"` signer mode, `activateNusukSigner`,
    `callNusuk`, `signWithNusuk`, and the NIP-44 branches;
  - i18n keys `identity.nusuk` and `error.nusuk*`; env `VITE_NUSUK_AUTH_URL`,
    `VITE_NUSUK_CLIENT_ID`; the profile flag `nusukAuth`.
  - Start with `rg -n -i "nusuk" web/src web/tests web/public docs` and end with a clean sweep.
  - Removing it is not cosmetic: the sign-in path, the session restore and the Relay checks all
    reference it, so delete the wiring with the module and rerun the browser suite.
- **Theme tokens**: `web/src/shared/styles/globals.css` `:root` and `.dark` (`--background`,
  `--primary`, `--accent`, `--sidebar-*`, `--buzz-gradient-*`, `--buzz-content-dark`). The script
  only writes `theme_color`/`background_color`, which do not restyle the app.
- **Fonts**: self-host the files in `web/public/fonts`, add `@font-face` blocks, keep the licenses in
  `THIRD_PARTY_NOTICES.md`. The script only rewrites the Tailwind family list.
- **Long-form copy**: anything that names the old product but is not a brand message key (docs,
  README, notices, legal copy) is manual. `rg -n "Nusuk" .` outside `node_modules` is the checklist.

### Phase 3 - tests and copy sweep (manual)

The script deliberately does not rewrite tests, so a variant cannot silently weaken them.

```bash
cd web
rg -n "Nusuk|nusuk" src tests
git mv src/shared/config/nusuk-brand.test.ts src/shared/config/<id>-brand.test.ts   # then update values
git mv tests/e2e/nusuk.spec.ts tests/e2e/<id>.spec.ts                              # then update copy
```

Update the expected strings in the moved files, `playwright.config.ts` `testMatch`, and the specs
that embed brand copy (`smoke`, `p0`, `moderation`, `workflows`, `notifications`). Keep the same
assertions; only the literals change. Three traps seen in practice:

- the sweep must also replace the tagline, the create-identity heading (including `a`/`an`), the
  loss acknowledgement and the relay name, not only the product name;
- do not rewrite CSS class selectors such as `.nusuk-identity-surface` and `.nusuk-welcome-title`
  in the specs: they are code identifiers that the script leaves alone. Rename them in
  `globals.css` and the JSX first if the variant wants its own prefix;
- a variant that declares no agents has no `config.agents`, so the brand test's agent expectation
  becomes `toBeUndefined()`.

If the legal copy should name a company, edit `invite.policyAgreement*` by hand: the script keeps it
brand-neutral.

### Phase 4 - gates and evidence

Run them one at a time; heavy commands take
`flock /tmp/opencode/buzz-web-checks.lock <command>` and abort if `MemAvailable` is below 700 MB.

```bash
cd web
npm ci
npm run typecheck
npm test
npm run check          # biome + file sizes + i18n + pubkey truncation
npm run check:caddy    # only when deploy/ or the Caddyfile changed; needs Docker
npm run build
npm run test:e2e       # or: npm run test:e2e:smoke
```

The browser suite needs the demo bundle: `npm run test:e2e` builds with `VITE_ENABLE_DEMO=true`
before it runs Playwright. A bare `npx playwright test` against a production `dist` makes every
demo-mode spec fail, so use the npm scripts.

Evidence to attach to the branch or hand over with it:

- gate results with counts (unit test files/tests, e2e tests, build warnings);
- `git diff --check` clean;
- screenshots `1440x900` and `390x844`, English and Simplified Chinese, welcome screen and one
  workspace screen, showing the new name, icons, and no overflow;
- live verification after deploy: `config.json`, `manifest.webmanifest`, favicon, 32 px icon, apple
  icon, 192/512 icons and the OG image return 200 with the right MIME type; the page title, OG and
  Twitter tags show the new name; no console errors.

### Phase 5 - review and commit

```bash
git status --short
git diff                     # brand surface only, plus the manual product/test edits
git commit -s -m "feat(brand): brand Buzz Web as <display name>"
```

### Phase 6 - deploy (separate, never in this step)

Deployment is an operator action with its own rollback. The scaffold never pushes, deploys, or
writes to the Relay.

## 3. What the scaffold writes

| File | What changes |
| --- | --- |
| `web/index.html` | title, meta description, theme-color, OG/Twitter tags, favicon/apple icon links |
| `web/public/manifest.webmanifest` | name, short_name, description, colors, 192/512 icons |
| `web/public/config.json` | communityName, relayUrl, features, declared agents |
| `web/src/shared/config/runtime-config.ts` | communityName fallback |
| `web/src/shared/i18n/index.ts` | `app.title`, `identity.createTitle`, `identity.welcome`, `identity.lossAcknowledgement`, `error.relayUrlRequired`, `error.signerLocked`, `invite.policyAgreementPrefix`, `invite.policyAgreementAccessible` in en and zh-CN |
| `web/tailwind.config.js` | `fontFamily.sans`, only when the profile sets `fonts.sans` |
| `web/public/<id>-{favicon.ico,favicon-32.png,apple-touch-icon.png,icon-192.png,icon-512.png,og.<ext>}` | copied from the profile asset paths |
| `web/src/assets/app-icon@3x.png`, `web/public/app-icon.png` | copied from the profile asset paths |

Values are compared, not blindly rewritten: an unchanged file stays byte-identical, and a rerun on
the same worktree reports `0 change(s)`. That gives the kit a self-check: applying `brand/nusuk.json`
to the branch it was extracted from must plan zero changes.

```bash
node scripts/brand/new-app.mjs --profile brand/nusuk.json --from origin/nusuk-buzz --dry-run
```

## 4. What the scaffold does not do

| Not automated | Why / where |
| --- | --- |
| Removing Nusuk SSO and other product code | auth and signing behavior, phase 2 checklist |
| Theme tokens in `globals.css` | a palette needs human judgment and contrast checks |
| Self-hosted font files and `@font-face` | new binary assets and licenses |
| Test literals and spec file names | tests must change deliberately, phase 3 |
| `docs/`, `README*`, `THIRD_PARTY_NOTICES.md`, Roadmap | policy and legal wording |
| `og:image` hosting and the final absolute URL | the profile records the URL; hosting is deployment |
| Relay agents' kind:0 profile publishing | a Relay write, out of scope |
| Branch protection, push, deploy, rollback | operator actions |

## 5. Invariants

- `main` stays generic. Branding lives on one branch per app.
- One branch, one app. Never stack two brand profiles on one branch.
- No secrets, tokens, private keys, invite codes, or real relay credentials in a profile, a commit,
  or a screenshot.
- No new dependencies. The script is plain Node 24.
- Production source files stay under 1,000 lines.
- No brand commits toward upstream. If a brand change reveals a generic bug, fix it on `main`
  separately and merge it in.
- Every user-facing string stays in `web/src/shared/i18n/index.ts` with both `en` and `zh-CN`.
- The Relay URL always comes from runtime config; branding never hardcodes a fallback relay.

## 6. Rollback

- Nothing applied: `git worktree remove /path/to/<id> && git branch -D <id>` (the scaffold printed the
  path). Uncommitted brand edits vanish with the worktree.
- After a commit: `git worktree remove /path/to/<id>`, delete branch `<id>`, and redeploy the previous
  release. No data, storage, or Relay migration is involved; the brand surface is browser-only.
- Deployed variant: restore the previous `config.json` (the file is copied into the served assets) and
  the previous image; the Relay is untouched.
