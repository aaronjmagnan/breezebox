#!/usr/bin/env node
/**
 * Cut a new tool from /apps/tool-template (backbone §2, §12).
 *
 *   pnpm new-tool coaching-tracker "Coaching Tracker"
 *
 * Copies the scaffold, substitutes the names, picks a free dev port, and
 * prints the steps that cannot be automated. It does NOT register the tool in
 * the shell or create a tool_instances row: both are decisions, and both are
 * listed at the end.
 */
import { cpSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const template = join(root, 'apps', 'tool-template');

const [slug, ...nameParts] = process.argv.slice(2);
const name = nameParts.join(' ');

function die(message) {
  console.error(`\n  ${message}\n`);
  console.error('  Usage: pnpm new-tool <slug> "<Name>"');
  console.error('  Example: pnpm new-tool coaching-tracker "Coaching Tracker"\n');
  process.exit(1);
}

if (!slug || !name) die('Both a slug and a name are required.');

// The slug becomes a URL path, a basePath, a package name and a database
// identifier. Anything outside this set breaks at least one of them.
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
  die(`Slug "${slug}" must be lowercase letters, digits and single hyphens.`);
}

// Kept in step with tool_instances_slug_not_reserved in the districts
// migration: these paths belong to the shell.
const RESERVED = [
  'api', 'auth', 'manifest', 'sw', 'offline', 'icons', 'assets', 'static',
  '_next', 'signin', 'sign-in', 'signout', 'sign-out', 'support',
];
if (RESERVED.includes(slug)) die(`Slug "${slug}" is reserved by the shell.`);

const target = join(root, 'apps', `tool-${slug}`);
if (existsSync(target)) die(`apps/tool-${slug} already exists.`);

// One dev port per tool, so two can run beside the shell without a clash.
const used = new Set([3000]);
for (const dir of readdirSync(join(root, 'apps'))) {
  const pkg = join(root, 'apps', dir, 'package.json');
  if (!existsSync(pkg)) continue;
  const text = readFileSync(pkg, 'utf8');
  for (const match of text.matchAll(/-p (\d{4})/g)) used.add(Number(match[1]));
}
let port = 3001;
while (used.has(port)) port += 1;

const ENV_VAR = `TOOL_${slug.toUpperCase().replace(/-/g, '_')}_ORIGIN`;
const TABLE = `${slug.replace(/-/g, '_')}_records`;

const substitutions = {
  __TOOL_SLUG__: slug,
  __TOOL_NAME__: name,
  __TOOL_PORT__: String(port),
  __TOOL_ENV_VAR__: ENV_VAR,
  __TOOL_TABLE__: TABLE,
};

cpSync(template, target, { recursive: true });

function substitute(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      substitute(path);
      continue;
    }
    let text = readFileSync(path, 'utf8');
    let changed = false;
    for (const [token, value] of Object.entries(substitutions)) {
      if (text.includes(token)) {
        text = text.split(token).join(value);
        changed = true;
      }
    }
    if (changed) writeFileSync(path, text);
  }
}
substitute(target);

const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);

console.log(`
  Created apps/tool-${slug}  (${name}, dev port ${port})

  Next, in this order. The first two are §3's rule: RLS before any UI.

  1. Schema and policies
       cp apps/tool-${slug}/supabase/migration.sql.template \\
          packages/db/supabase/migrations/${stamp}_${slug}.sql
       ...fill in the columns, then run: pnpm db:reset

  2. Tests that prove the isolation
       cp apps/tool-${slug}/supabase/test.sql.template \\
          packages/db/supabase/tests/${slug}_rls.sql
       ...then: pnpm --filter @breezebox/db test

  3. Declare the tool
       apps/tool-${slug}/template.config.mjs  -- category (§7), offline (§11)

  4. Register the zone in the shell
       apps/shell/src/config/tool-zones.mjs:
         { slug: '${slug}', envVar: '${ENV_VAR}' }

  5. Install and build
       pnpm install && pnpm build

  6. Give a district the tile
       insert into public.tool_instances
         (district_id, tool_type, tool_slug, name, accent)
       select id, 'data', '${slug}', '${name}', 'blue'
       from public.districts where slug = 'demo';

  7. Deploy
       A new Vercel project, Root Directory apps/tool-${slug},
       "include files outside root" ON, Deployment Protection OFF.
       Set ${ENV_VAR} on the SHELL project, then redeploy the shell --
       rewrites are baked in at build time.

  Locally, reach it through the shell at
  http://demo.localhost:3000/${slug}  -- not localhost:${port} directly, or the
  session cookie is on the wrong origin and you will look signed out.
`);
