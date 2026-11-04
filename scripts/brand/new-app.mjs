// Scaffolds a branded Buzz Web variant from an existing branch and a brand profile.
//   node scripts/brand/new-app.mjs --profile brand/nusuk.json --dry-run
//   node scripts/brand/new-app.mjs --profile brand/<id>.json --from origin/nusuk-buzz --path ../<id>-work
// Node 24, no dependencies. Never touches main, never pushes, deploys, or writes to a Relay.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const USAGE = `Usage: node scripts/brand/new-app.mjs --profile brand/<id>.json [options]

  --profile <path>  Brand profile to apply, relative to the repository root (required).
  --from <ref>      Base ref for a new variant (default: nusuk-buzz; pass origin/nusuk-buzz for the
                    pushed tip, because a local nusuk-buzz may hold unpushed work).
  --path <dir>      Worktree directory (default: <repo>/../<id>-work). Created with branch <id> when
                    absent; when it exists and is checked out on branch <id> the profile is simply
                    reapplied, which is idempotent.
  --dry-run         Print the planned changes and write nothing.

The script rewrites only the brand surface listed in brand/README.md. Product code, theme tokens,
tests, docs, and the Nusuk SSO wiring stay manual.`;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function fail(message, code = 2) {
  console.error(`${message}\n\n${USAGE}`);
  process.exit(code);
}

const options = { profile: null, from: "nusuk-buzz", path: null, dryRun: false };
const argv = process.argv.slice(2);
for (let index = 0; index < argv.length; index += 1) {
  const argument = argv[index];
  if (argument === "--dry-run") {
    options.dryRun = true;
    continue;
  }
  if (argument === "--profile" || argument === "--from" || argument === "--path") {
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) fail(`${argument} needs a value`);
    options[argument.slice(2)] = value;
    index += 1;
    continue;
  }
  fail(`Unknown argument: ${argument}`);
}
if (!options.profile) fail("--profile is required");

function readJson(file, label) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    fail(`${label} is not valid JSON: ${error.message}`);
  }
}

const schemaFile = path.join(repoRoot, "brand/profile.schema.json");
const schema = readJson(schemaFile, "brand/profile.schema.json");
const profileFile = path.resolve(repoRoot, options.profile);
if (!existsSync(profileFile)) fail(`Profile not found: ${options.profile}`);
const profile = readJson(profileFile, options.profile);

// Minimal JSON Schema reader: type, pattern, min/max length, minItems, enum, required,
// additionalProperties, $ref. Enough for profile.schema.json, which we ship next to this script.
const definitions = schema.$defs ?? {};
const typeOf = (value) =>
  Array.isArray(value) ? "array" : value === null ? "null" : typeof value;

function validate(value, node, at, errors) {
  const schemaNode = node.$ref ? definitions[node.$ref.replace("#/$defs/", "")] : node;
  if (schemaNode.type && typeOf(value) !== schemaNode.type) {
    errors.push(`${at}: expected ${schemaNode.type}, found ${typeOf(value)}`);
    return;
  }
  if (typeof value === "string") {
    if (schemaNode.pattern && !new RegExp(schemaNode.pattern, "u").test(value)) {
      errors.push(`${at}: ${JSON.stringify(value)} does not match ${schemaNode.pattern}`);
    }
    if (schemaNode.minLength !== undefined && value.length < schemaNode.minLength) {
      errors.push(`${at}: shorter than ${schemaNode.minLength}`);
    }
    if (schemaNode.maxLength !== undefined && value.length > schemaNode.maxLength) {
      errors.push(`${at}: longer than ${schemaNode.maxLength}`);
    }
  }
  if (schemaNode.enum && !schemaNode.enum.includes(value)) {
    errors.push(`${at}: ${JSON.stringify(value)} is not one of ${schemaNode.enum.join(", ")}`);
  }
  if (typeOf(value) === "object") {
    for (const key of schemaNode.required ?? []) {
      if (!(key in value)) errors.push(`${at}: missing field "${key}"`);
    }
    for (const [key, child] of Object.entries(value)) {
      const childSchema = schemaNode.properties?.[key];
      if (childSchema) validate(child, childSchema, `${at}.${key}`, errors);
      else if (schemaNode.additionalProperties === false) {
        errors.push(`${at}: unknown field "${key}"`);
      } else if (typeof schemaNode.additionalProperties === "object") {
        validate(child, schemaNode.additionalProperties, `${at}.${key}`, errors);
      }
    }
  }
  if (typeOf(value) === "array") {
    if (schemaNode.minItems !== undefined && value.length < schemaNode.minItems) {
      errors.push(`${at}: fewer than ${schemaNode.minItems} items`);
    }
    if (schemaNode.items) {
      value.forEach((item, index) => validate(item, schemaNode.items, `${at}[${index}]`, errors));
    }
  }
}

const profileErrors = [];
validate(profile, schema, "profile", profileErrors);
if (profileErrors.length) {
  fail(`Invalid brand profile ${options.profile}:\n- ${profileErrors.join("\n- ")}`);
}

const { id, displayName, themeColor, relayUrl } = profile;
const backgroundColor = profile.backgroundColor ?? themeColor;
const assetExtension = (role) => path.extname(profile.assets[role]);
const targetFor = {
  favicon: () => `web/public/${id}-favicon${assetExtension("favicon")}`,
  favicon32: () => `web/public/${id}-favicon-32${assetExtension("favicon32")}`,
  appleTouchIcon: () => `web/public/${id}-apple-touch-icon${assetExtension("appleTouchIcon")}`,
  icon192: () => `web/public/${id}-icon-192${assetExtension("icon192")}`,
  icon512: () => `web/public/${id}-icon-512${assetExtension("icon512")}`,
  ogImage: () => `web/public/${id}-og${assetExtension("ogImage")}`,
  logo: () => "web/src/assets/app-icon@3x.png",
  appIcon: () => "web/public/app-icon.png",
};
const publicFile = (role) => path.basename(targetFor[role]());

const targetRoot = path.resolve(
  options.path ?? path.join(path.dirname(repoRoot), `${id}-work`),
);
const creating = !existsSync(targetRoot);

function git(args) {
  try {
    return execFileSync("git", ["-C", repoRoot, ...args], { encoding: "utf8" }).trim();
  } catch (error) {
    fail(`git ${args.join(" ")}: ${(error.stderr || error.message).toString().trim()}`);
  }
}

function refExists(ref) {
  try {
    execFileSync("git", ["-C", repoRoot, "rev-parse", "--verify", "--quiet", ref], {
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

if (creating) {
  // A dry run plans the writes from the base ref, so it does not claim a branch or a directory.
  if (!options.dryRun) {
    if (refExists(`refs/heads/${id}`)) {
      fail(`Branch ${id} already exists. Pass --path to reapply into its worktree instead.`);
    }
    if (!refExists(`${options.from}^{commit}`)) fail(`Base ref ${options.from} does not exist.`);
    mkdirSync(path.dirname(targetRoot), { recursive: true });
    git(["worktree", "add", "-b", id, targetRoot, options.from]);
  }
} else {
  let branch;
  try {
    branch = execFileSync("git", ["-C", targetRoot, "rev-parse", "--abbrev-ref", "HEAD"], {
      encoding: "utf8",
    }).trim();
  } catch {
    fail(`${targetRoot} exists but is not a git worktree. Pass --path <dir> for a new worktree.`);
  }
  if (branch !== id) {
    fail(
      `${targetRoot} exists and is on branch ${branch}, expected ${id}. Pass --path <dir> for a new worktree.`,
    );
  }
}

function readBase(relFile) {
  // A dry run must not create the worktree, so it reads the base files from the requested ref.
  if (creating) {
    return execFileSync("git", ["-C", repoRoot, "show", `${options.from}:${relFile}`], {
      encoding: "utf8",
    });
  }
  const file = path.join(targetRoot, relFile);
  if (!existsSync(file)) throw new Error(`Missing ${relFile} in ${targetRoot}`);
  return readFileSync(file, "utf8");
}

const changes = [];
function diffHint(before, after) {
  const from = before.split("\n");
  const to = after.split("\n");
  if (from.length !== to.length) return `      (lines ${from.length} -> ${to.length})`;
  const lines = [];
  for (let index = 0; index < from.length && lines.length < 8; index += 1) {
    if (from[index] !== to[index]) lines.push(`      - ${from[index]}\n      + ${to[index]}`);
  }
  return lines.join("\n");
}
function planText(relFile, detail, transform) {
  const before = readBase(relFile);
  const after = transform(before);
  if (after === before) changes.push({ kind: "unchanged", file: relFile, detail });
  else {
    changes.push({
      kind: "write",
      file: relFile,
      detail,
      content: after,
      diff: diffHint(before, after),
    });
  }
}
function baseBytes(relFile) {
  try {
    return execFileSync("git", ["-C", repoRoot, "show", `${options.from}:${relFile}`], {
      maxBuffer: 32 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
}
function planCopy(role) {
  const source = path.resolve(repoRoot, profile.assets[role]);
  if (!existsSync(source)) {
    throw new Error(`assets.${role} does not exist: ${profile.assets[role]}`);
  }
  const targetRel = targetFor[role]();
  const targetAbs = path.join(targetRoot, targetRel);
  const sourceBytes = readFileSync(source);
  const existing = creating
    ? baseBytes(targetRel)
    : existsSync(targetAbs)
      ? readFileSync(targetAbs)
      : null;
  if (existing?.equals(sourceBytes)) {
    changes.push({ kind: "unchanged", file: targetRel, detail: `assets.${role}` });
    return;
  }
  changes.push({
    kind: "copy",
    file: targetRel,
    detail: `${profile.assets[role]} -> ${targetRel}`,
    source,
    targetAbs,
  });
}

// index.html: title, description, theme color, social cards, icon links.
function writeHtml(source) {
  const description = `${displayName} — ${profile.description.en}`;
  const social = profile.description.en.charAt(0).toUpperCase() + profile.description.en.slice(1);
  const tags = [
    [/<title>[\s\S]*?<\/title>/, `<title>${displayName}</title>`, "title"],
    [
      /<meta name="theme-color" content="[^"]*"/,
      `<meta name="theme-color" content="${themeColor}"`,
      "theme color",
    ],
    [
      /<meta name="description" content="[^"]*"/,
      `<meta name="description" content="${description}"`,
      "description",
    ],
    [
      /<meta property="og:site_name" content="[^"]*"/,
      `<meta property="og:site_name" content="${displayName}"`,
      "og:site_name",
    ],
    [
      /<meta property="og:title" content="[^"]*"/,
      `<meta property="og:title" content="${displayName}"`,
      "og:title",
    ],
    [
      /<meta property="og:description" content="[^"]*"/,
      `<meta property="og:description" content="${social}"`,
      "og:description",
    ],
    [
      /<meta property="og:image" content="[^"]*"/,
      `<meta property="og:image" content="${profile.ogImageUrl}"`,
      "og:image",
    ],
    [
      /<meta name="twitter:title" content="[^"]*"/,
      `<meta name="twitter:title" content="${displayName}"`,
      "twitter:title",
    ],
    [
      /<meta name="twitter:description" content="[^"]*"/,
      `<meta name="twitter:description" content="${social}"`,
      "twitter:description",
    ],
    [
      /<meta name="twitter:image" content="[^"]*"/,
      `<meta name="twitter:image" content="${profile.ogImageUrl}"`,
      "twitter:image",
    ],
    [
      /<link rel="icon" type="image\/x-icon" href="[^"]*"/,
      `<link rel="icon" type="image/x-icon" href="%BASE_URL%${publicFile("favicon")}"`,
      "favicon",
    ],
    [
      /<link rel="icon" type="image\/png" sizes="32x32" href="[^"]*"/,
      `<link rel="icon" type="image/png" sizes="32x32" href="%BASE_URL%${publicFile("favicon32")}"`,
      "favicon 32",
    ],
    [
      /<link rel="apple-touch-icon" sizes="180x180" href="[^"]*"/,
      `<link rel="apple-touch-icon" sizes="180x180" href="%BASE_URL%${publicFile("appleTouchIcon")}"`,
      "apple touch icon",
    ],
  ];
  let html = source;
  for (const [pattern, replacement, label] of tags) {
    const found = html.match(new RegExp(pattern.source, "g")) ?? [];
    if (found.length !== 1) {
      throw new Error(`web/index.html: expected one ${label} tag, found ${found.length}`);
    }
    html = html.replace(pattern, () => replacement);
  }
  return html;
}

function writeManifest() {
  return `${JSON.stringify(
    {
      name: displayName,
      short_name: profile.shortName,
      description: profile.manifestDescription.en,
      start_url: "./",
      scope: "./",
      display: "standalone",
      background_color: backgroundColor,
      theme_color: themeColor,
      icons: [
        {
          src: `./${publicFile("icon192")}`,
          sizes: "192x192",
          type: "image/png",
          purpose: "any",
        },
        {
          src: `./${publicFile("icon512")}`,
          sizes: "512x512",
          type: "image/png",
          purpose: "any",
        },
      ],
    },
    null,
    2,
  )}\n`;
}

function writeConfig() {
  const agents = (profile.agents ?? []).map((agent) => ({
    pubkey: agent.pubkey,
    name: agent.name,
    ...(typeof agent.startable === "boolean" ? { startable: agent.startable } : {}),
  }));
  return `${JSON.stringify(
    {
      communityName: profile.communityName,
      relayUrl,
      features: { projects: profile.features.projects, forum: profile.features.forum },
      ...(agents.length ? { agents } : {}),
    },
    null,
    2,
  )}\n`;
}

function writeCommunityFallback(source) {
  const anchor = source.indexOf("typeof raw.communityName");
  if (anchor === -1) throw new Error("runtime-config.ts: communityName fallback not found");
  const open = source.indexOf(': "', anchor);
  const close = open === -1 ? -1 : source.indexOf('"', open + 3);
  if (close === -1) {
    throw new Error("runtime-config.ts: communityName fallback is not a string literal");
  }
  return `${source.slice(0, open + 3)}${profile.communityName}${source.slice(close)}`;
}

// Brand-bearing i18n keys. Legal policy copy stays brand-neutral on purpose.
const messages = {
  "app.title": [displayName, displayName],
  "identity.createTitle": [
    `Create ${/^[aeiou]/i.test(displayName) ? "an" : "a"} ${displayName} identity`,
    `创建 ${displayName} 身份`,
  ],
  "identity.welcome": [
    profile.tagline.en,
    profile.tagline["zh-CN"] ?? profile.tagline.en,
  ],
  "identity.lossAcknowledgement": [
    `I understand that ${displayName} cannot recover this identity if I lose the encrypted vault and backup.`,
    `我明白，如果加密保险库和备份均丢失，${displayName} 无法恢复此身份。`,
  ],
  "error.relayUrlRequired": [
    `Configure a Relay address before starting ${displayName}.`,
    `启动 ${displayName} 前必须配置 Relay 地址。`,
  ],
  "error.signerLocked": [
    `Unlock your ${displayName} identity first.`,
    `请先解锁 ${displayName} 身份。`,
  ],
  "invite.policyAgreementPrefix": ["I agree to the ", "我同意 "],
  "invite.policyAgreementAccessible": [
    "I agree to the Terms of Service and Privacy Policy.",
    "我同意服务条款和隐私政策。",
  ],
};

// Biome measures East Asian characters as two columns, so a brand name can push a one-line
// message over the 100-column budget and the formatter would then reject the file.
const wideCharacter =
  /[\u1100-\u115F\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE6F\uFF00-\uFF60\uFFE0-\uFFE6]/u;
const displayWidth = (text) =>
  [...text].reduce((width, character) => width + (wideCharacter.test(character) ? 2 : 1), 0);

function writeMessages(source) {
  let output = source;
  for (const [key, [en, zh]] of Object.entries(messages)) {
    const entry = new RegExp(`(\\n[ \\t]*)("${key}":\\s*\\{)([\\s\\S]*?)(\\})`).exec(output);
    if (!entry) throw new Error(`i18n/index.ts: message key "${key}" not found`);
    const indent = entry[1].slice(1);
    const english = JSON.stringify(en);
    const chinese = JSON.stringify(zh);
    const oneLine = `${indent}"${key}": { en: ${english}, "zh-CN": ${chinese} },`;
    const body =
      entry[3].includes("\n") || displayWidth(oneLine) > 100
        ? `\n${indent}  en: ${english},\n${indent}  "zh-CN": ${chinese},\n${indent}`
        : ` en: ${english}, "zh-CN": ${chinese} `;
    output = `${output.slice(0, entry.index)}${entry[1]}${entry[2]}${body}${entry[4]}${output.slice(
      entry.index + entry[0].length,
    )}`;
  }
  return output;
}

const stripQuotes = (value) => value.replace(/["']/g, "");

function writeFonts(source) {
  if (!profile.fonts?.sans) return source;
  const match = /sans:\s*\[([^\]]*)\]/.exec(source);
  if (!match) throw new Error("tailwind.config.js: fontFamily.sans not found");
  const current = (match[1].match(/"[^"]*"|'[^']*'/g) ?? []).map(stripQuotes);
  // Compare without quote style so an unchanged font list keeps the file byte-identical.
  if (current.join("\u0000") === profile.fonts.sans.map(stripQuotes).join("\u0000")) return source;
  const next = `sans: [${profile.fonts.sans.map((font) => JSON.stringify(font)).join(", ")}]`;
  return source.slice(0, match.index) + next + source.slice(match.index + match[0].length);
}

try {
  planText("web/index.html", "title, description, social cards, icons", writeHtml);
  const manifest = writeManifest();
  planText("web/public/manifest.webmanifest", "name, description, colors, icons", () => manifest);
  const config = writeConfig();
  planText("web/public/config.json", "communityName, relay, features, agents", () => config);
  planText(
    "web/src/shared/config/runtime-config.ts",
    "communityName fallback",
    writeCommunityFallback,
  );
  planText("web/src/shared/i18n/index.ts", "brand message keys", writeMessages);
  planText("web/tailwind.config.js", "fontFamily.sans", writeFonts);
  for (const role of Object.keys(targetFor)) planCopy(role);
} catch (error) {
  fail(`Cannot scaffold ${id}: ${error.message}`, 1);
}

const label = { unchanged: "unchanged", write: "written  ", copy: "copied   " };
console.log(`Brand profile: ${options.profile}`);
console.log(`  product     ${displayName} (${id})`);
console.log(`  community   ${profile.communityName}`);
console.log(`  relay       ${relayUrl}`);
console.log(`  theme       ${themeColor} / ${backgroundColor}`);
console.log(`  assets      ${Object.keys(targetFor).map((role) => publicFile(role)).join(", ")}`);
if (options.dryRun && creating) {
  console.log(`  worktree    would create ${targetRoot} on branch ${id} from ${options.from}`);
} else if (creating) {
  console.log(`  worktree    created ${targetRoot} on branch ${id} from ${options.from}`);
} else {
  console.log(`  worktree    reusing ${targetRoot} on branch ${id}`);
}

const pending = changes.filter((change) => change.kind !== "unchanged");
if (!options.dryRun) {
  for (const change of pending) {
    const file = path.join(targetRoot, change.file);
    if (change.kind === "write") writeFileSync(file, change.content);
    else copyFileSync(change.source, change.targetAbs);
  }
}
for (const change of changes) {
  console.log(`  ${label[change.kind]} ${change.file}  ${change.detail}`);
  if (options.dryRun && change.kind === "write") console.log(change.diff);
}

for (const [flag, enabled] of Object.entries(profile.flags ?? {})) {
  if (enabled) {
    console.log(
      `  ! flag ${flag} is on: product code for it is not scaffolded, ` +
        `verify it exists in ${options.from}`,
    );
  }
}
if (profile.description["zh-CN"]) {
  console.log("  note  description.zh-CN is recorded only; metadata is English at build time");
}

if (options.dryRun) {
  console.log(`\nDry run: ${pending.length} change(s) planned, nothing written.`);
} else {
  console.log(`\n${pending.length} change(s) applied to ${targetRoot}`);
  console.log(`Next: cd ${targetRoot}/web && npm ci`);
  console.log("      npm run typecheck && npm test && npm run check && npm run build && npm run test:e2e");
  console.log("Then the manual steps in brand/README.md (product code, theme, tests, docs, gates).");
}
