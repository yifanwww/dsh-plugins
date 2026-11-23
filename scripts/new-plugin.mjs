#!/usr/bin/env node
/**
 * Scaffold one plugin package from `templates/plugin`.
 *
 *   pnpm new <slug> [--title <title>] [--description <text>]
 *
 * The slug names both the directory and the package: `plugins/<slug>` becomes
 * `<prefix><slug>` (prefix from `dsh-plugins.config.json`). The patch row id,
 * the browser module id, the locale stubs, and the README are derived from it,
 * so a generated plugin already satisfies `pnpm check`.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const templateDir = join(root, 'templates', 'plugin')
const pluginsDir = join(root, 'plugins')
const SLUG_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/

const config = JSON.parse(readFileSync(join(root, 'dsh-plugins.config.json'), 'utf8'))
const prefix = config.packagePrefix

function fail(message, hint) {
  console.error(`new-plugin: ${message}`)
  if (hint) console.error(`\n${hint}`)
  process.exit(1)
}

function parseArgs(argv) {
  const options = {}
  const positional = []
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') options.help = true
    else if (arg === '--title') options.title = argv[++i]
    else if (arg === '--description') options.description = argv[++i]
    else if (arg.startsWith('-')) fail(`unknown option ${arg}`)
    else positional.push(arg)
  }
  if (!options.help && positional.length !== 1) fail('expected exactly one <slug>', usage())
  return { slug: positional[0], ...options }
}

function usage() {
  return [
    'Usage: pnpm new <slug> [--title <title>] [--description <text>]',
    '',
    'Example:',
    '  pnpm new composer-badge --title "Composer badge"',
  ].join('\n')
}

/** `composer-badge` -> `Composer badge` (sentence case, as plugin titles use). */
function titleFromSlug(slug) {
  const words = slug.split('-').join(' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** Read every file below the template directory, as paths relative to it. */
function listTemplateFiles(dir, base = dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...listTemplateFiles(full, base))
    else if (entry.isFile()) out.push(relative(base, full))
  }
  return out.sort()
}

const { slug, title, description, help } = parseArgs(process.argv.slice(2))
if (help) {
  console.log(usage())
  process.exit(0)
}

if (!SLUG_PATTERN.test(slug)) {
  fail(`"${slug}" is not a slug`, 'Use lower-case words joined by single hyphens, starting with a letter: composer-badge.')
}
if (title !== undefined && /["\\\r\n]/.test(title)) fail('--title cannot contain quotes, backslashes or newlines')
if (description !== undefined && /["\\\r\n]/.test(description)) fail('--description cannot contain quotes, backslashes or newlines')

const packageName = `${prefix}${slug}`
const targetDir = join(pluginsDir, slug)
if (existsSync(targetDir)) {
  fail(`plugins/${slug} already exists`, 'Pick another slug or delete the directory first.')
}

const replacements = new Map([
  ['__PACKAGE_NAME__', packageName],
  ['__SLUG__', slug],
  ['__TITLE__', title ?? titleFromSlug(slug)],
  ['__DESCRIPTION__', description ?? 'TODO: one sentence describing what this plugin does and where it appears in the UI.'],
])

for (const rel of listTemplateFiles(templateDir)) {
  const source = readFileSync(join(templateDir, rel), 'utf8')
  let output = source
  for (const [token, value] of replacements) output = output.split(token).join(value)
  if (rel.endsWith('.json')) {
    try {
      JSON.parse(output)
    } catch (error) {
      fail(`templates/plugin/${rel} produced invalid JSON: ${error.message}`)
    }
  }
  const file = join(targetDir, rel)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, output)
}

const created = listTemplateFiles(targetDir)
console.log(`Created plugins/${slug} (${packageName})\n`)
for (const rel of created) console.log(`  plugins/${slug}/${rel}`)

console.log(`
Next:
  1. Implement src/index.js (Host) and src/client.js (browser).
  2. Run "pnpm check" from the repo root.
  3. Install it into a profile by absolute path (it becomes a linked checkout):
       ${targetDir}
     Use Plugins > Add plugin, or ask an agent to call plugin_manager
     install_bundle with that path.
  4. Replace the placeholder icon, and translate locale/zh.json.`)
