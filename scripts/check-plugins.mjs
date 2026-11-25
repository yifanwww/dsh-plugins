#!/usr/bin/env node
/**
 * Validate every plugin package in the workspace against the rules dsh applies
 * when it installs a bundle and activates its rows.
 *
 *   pnpm check
 *
 * Errors are things installation or activation would reject, or that produce a
 * visibly broken plugin (missing entry file, unregistered browser id, empty
 * locale text, oversized icon). Warnings are quality or packaging problems
 * that still install. Exit code is 1 when any error is reported.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import semver from 'semver';
import { parse as parseYaml } from 'yaml';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pluginsRoot = join(root, 'plugins');
const configPath = join(root, 'dsh-plugins.config.json');
const MAX_ICON_BYTES = 256 * 1024;
const MAX_DETAIL_BYTES = 1024 * 1024;
const ICON_EXTENSIONS = new Set(['.svg', '.png', '.jpg', '.jpeg', '.webp']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'out']);

const findings = [];
const record = (level, where, message) => findings.push({ level, where, message });
const error = (where, message) => record('error', where, message);
const warn = (where, message) => record('warning', where, message);

const posix = (path) => path.split(sep).join('/');

const isFile = (path) => {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
};

const isDirectory = (path) => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function firstLine(text) {
  return (
    String(text)
      .split('\n')
      .find((line) => line.trim() !== '') ?? String(text)
  );
}

/** Every file below `dir`, as paths relative to it. */
function listFiles(dir, base = dir) {
  if (!isDirectory(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, base));
    else if (entry.isFile()) out.push(relative(base, full));
  }
  return out;
}

/** Resolve an export entry written as a plain string or a conditions object. */
function exportTarget(exports, key) {
  const entry = exports?.[key];
  if (typeof entry === 'string') return entry;
  if (entry !== null && typeof entry === 'object') {
    for (const condition of ['default', 'import', 'node']) {
      if (typeof entry[condition] === 'string') return entry[condition];
    }
    return Object.values(entry).find((value) => typeof value === 'string');
  }
  return undefined;
}

/** A `files` entry as a matcher: plain paths cover their subtree, globs match. */
function filesEntryMatches(entry, path) {
  const normalized = posix(entry).replace(/^\.\//, '');
  if (!/[*?]/.test(normalized)) return path === normalized || path.startsWith(`${normalized}/`);
  let pattern = '^';
  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    if (char === '*') {
      if (normalized[i + 1] === '*') {
        i += 1;
        if (normalized[i + 1] === '/') {
          i += 1;
          pattern += '(?:.*/)?';
        } else {
          pattern += '.*';
        }
      } else {
        pattern += '[^/]*';
      }
    } else if (char === '?') {
      pattern += '[^/]';
    } else {
      pattern += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`${pattern}$`).test(path);
}

const filesCover = (files, path) => files.some((entry) => filesEntryMatches(entry, posix(path).replace(/^\.\//, '')));

/** Returns a short message when Node cannot parse the file as the module it is. */
function syntaxProblem(file) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    return undefined;
  } catch (cause) {
    const output = cause.stderr?.toString() || cause.message;
    const lines = output
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '');
    return lines.find((line) => /^[A-Za-z]*Error\b/.test(line)) ?? lines[0] ?? 'cannot be parsed';
  }
}

function readPatch(where, dir, rel) {
  const file = join(dir, rel);
  if (!isFile(file)) {
    error(where, `patch file ${rel} does not exist`);
    return [];
  }
  let document;
  try {
    document = parseYaml(readFileSync(file, 'utf8'), { logLevel: 'silent' });
  } catch (cause) {
    error(where, `${rel} is not valid YAML: ${firstLine(cause.message)}`);
    return [];
  }
  if (!Array.isArray(document)) {
    error(where, `${rel} must be a top-level YAML array of loader patch entries`);
    return [];
  }
  const rows = [];
  for (const [index, entry] of document.entries()) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      error(where, `${rel}: entry ${index + 1} is not a mapping`);
      continue;
    }
    if (!('insert' in entry)) continue;
    if (!Array.isArray(entry.insert)) {
      error(where, `${rel}: entry ${index + 1} has an "insert" that is not a list`);
      continue;
    }
    for (const row of entry.insert) {
      if (row === null || typeof row !== 'object' || Array.isArray(row)) {
        error(where, `${rel}: entry ${index + 1} inserts something that is not a mapping`);
        continue;
      }
      if (typeof row.name !== 'string' || row.name.trim() === '') {
        error(where, `${rel}: an inserted row has no "name"`);
        continue;
      }
      if (typeof row.id !== 'string' || row.id.trim() === '') {
        warn(where, `${rel}: the row for ${row.name} has no "id"; a profile cannot target it with an override`);
      }
      rows.push({ id: row.id, name: row.name, disabled: row.disabled === true, rel });
    }
  }
  return rows;
}

function checkLocale(where, dir, manifest) {
  const localeDir = join(dir, 'locale');
  const files = isDirectory(localeDir)
    ? readdirSync(localeDir)
        .filter((name) => name.endsWith('.json'))
        .sort()
    : [];
  if (exportTarget(manifest.exports, './locale/*.json') === undefined) {
    warn(
      where,
      'export "./locale/*.json" and add locale/en.json, so Plugin Manager can show a title and description without activating the plugin',
    );
  }
  if (files.length === 0) {
    warn(where, 'no locale files: the plugin row falls back to the package name and description');
    return { detail: undefined };
  }
  let detail;
  for (const name of files) {
    const rel = `locale/${name}`;
    let document;
    try {
      document = readJson(join(localeDir, name));
    } catch (cause) {
      error(where, `${rel} is not valid JSON: ${firstLine(cause.message)}`);
      continue;
    }
    const meta = document?.meta;
    for (const field of ['title', 'description']) {
      const value = meta?.[field];
      if (typeof value !== 'string' || value.trim() === '') {
        error(where, `${rel} has no meta.${field}; Plugin Manager shows a fallback without it`);
      } else if (value.includes('TODO')) {
        warn(where, `${rel} still says TODO in meta.${field}`);
      }
    }
    if (meta?.detail === undefined) continue;
    if (typeof meta.detail !== 'string' || !/\.md$/i.test(meta.detail)) {
      error(where, `${rel}: meta.detail must be a .md path relative to the package root`);
      continue;
    }
    detail = meta.detail;
    const detailFile = join(dir, meta.detail);
    if (!isFile(detailFile)) {
      error(where, `${rel}: meta.detail names ${meta.detail}, which does not exist`);
      continue;
    }
    if (statSync(detailFile).size > MAX_DETAIL_BYTES) {
      error(where, `${meta.detail} is larger than the 1 MiB detail limit`);
    }
    const images = [...readFileSync(detailFile, 'utf8').matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)].map((match) => match[1]);
    if (images.length !== 1) {
      warn(where, `${meta.detail} should hold exactly one image line; found ${images.length}`);
    }
    for (const image of images) {
      if (/^(?:https?:|data:)/.test(image)) {
        error(
          where,
          `${meta.detail} references a remote or inline image; keep images beside the document and inside the package`,
        );
      } else if (!isFile(join(dirname(detailFile), image))) {
        error(where, `${meta.detail} references ${image}, which does not exist`);
      }
    }
  }
  return { detail };
}

function checkIcon(where, dir, manifest) {
  const iconRel =
    exportTarget(manifest.exports, './icon') ?? (typeof manifest.icon === 'string' ? manifest.icon : undefined);
  if (iconRel === undefined) {
    warn(where, 'no icon: Plugin Manager draws the default artwork; add icon.svg and export "./icon"');
    return undefined;
  }
  const file = join(dir, iconRel);
  if (!isFile(file)) {
    error(where, `icon ${iconRel} does not exist`);
    return iconRel;
  }
  const extension = extname(file).toLowerCase();
  if (!ICON_EXTENSIONS.has(extension)) {
    error(where, `icon must be SVG, PNG, JPEG or WebP; found ${extension || 'no extension'}`);
  }
  if (statSync(file).size > MAX_ICON_BYTES) {
    error(where, `icon is larger than the 256 KiB icon limit`);
  }
  if (extension === '.svg') {
    const svg = readFileSync(file, 'utf8');
    if (!/<svg[\s>]/.test(svg)) error(where, 'icon has no <svg> root element');
    for (const tag of ['script', 'foreignObject', 'image']) {
      if (new RegExp(`<${tag}[\\s>]`, 'i').test(svg)) {
        error(where, `icon must not contain <${tag}>; icons are loaded as self-contained images`);
      }
    }
    if (/<text[\s>]/i.test(svg)) {
      warn(where, 'icon draws <text>; convert lettering to paths so font substitution cannot change it');
    }
    if (!/viewBox\s*=/.test(svg)) warn(where, 'icon has no viewBox, so it will not scale predictably');
  }
  return iconRel;
}

function checkClient(where, dir, manifest, name) {
  const client = manifest.dsh?.client;
  const clientRel = exportTarget(manifest.exports, './client');
  if (client === undefined) {
    if (clientRel !== undefined) {
      warn(where, 'exports a "./client" bundle but declares no dsh.client, so the browser half never loads');
    }
    return undefined;
  }
  if (client === null || typeof client !== 'object' || Array.isArray(client)) {
    error(where, 'dsh.client must be an object');
    return clientRel;
  }
  if (client.platform !== 'web') {
    error(
      where,
      `dsh.client.platform must be "web"; this repo targets the Web/Desktop client, and any other value means the row is ignored`,
    );
  }
  if (client.inject !== undefined && !Array.isArray(client.inject)) {
    error(where, 'dsh.client.inject must be a list of package names');
  }
  if (client.external !== undefined && !Array.isArray(client.external)) {
    error(where, 'dsh.client.external must be a list of module specifiers, and each one must be supplied by the host');
  }
  if (clientRel === undefined) {
    error(where, 'declares dsh.client but exports no "./client" bundle; the client graph cannot load the browser half');
    return undefined;
  }
  if (!isFile(join(dir, clientRel))) {
    error(where, `exports["./client"] points at ${clientRel}, which does not exist`);
    return clientRel;
  }
  const code = readFileSync(join(dir, clientRel), 'utf8');
  if (!code.includes('__ModuleLoader__.load')) {
    error(where, `${clientRel} never calls window.__ModuleLoader__.load(...), so it registers no module`);
  } else if (
    name !== undefined &&
    !new RegExp(`id\\s*:\\s*['"]${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`).test(code)
  ) {
    error(where, `${clientRel} must register id '${name}'; the browser module id is the package name`);
  }
  if (/^\s*(?:import|export)\s/m.test(code)) {
    warn(
      where,
      `${clientRel} looks like an ES module; the page loads it as a classic script, so use require() inside the factory`,
    );
  }
  return clientRel;
}

function checkPlugin(directoryName, config) {
  const where = `plugins/${directoryName}`;
  const dir = join(pluginsRoot, directoryName);
  let manifest;
  try {
    manifest = readJson(join(dir, 'package.json'));
  } catch (cause) {
    error(where, `package.json is missing or not valid JSON: ${firstLine(cause.message)}`);
    return { rows: [], name: undefined };
  }
  const name = typeof manifest.name === 'string' && manifest.name.trim() !== '' ? manifest.name : undefined;
  if (name === undefined) error(where, 'package.json has no "name"');
  else {
    const pattern = new RegExp(
      `^${config.packagePrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[a-z0-9]+(?:-[a-z0-9]+)*$`,
    );
    if (!pattern.test(name)) {
      error(
        where,
        `package name "${name}" should match ${config.packagePrefix}<slug>, because the browser module id equals the package name`,
      );
    }
    if (name !== `${config.packagePrefix}${directoryName}`) {
      warn(
        where,
        `package name "${name}" differs from the directory convention ${config.packagePrefix}${directoryName}`,
      );
    }
  }
  if (!semver.valid(manifest.version)) warn(where, 'set a semver "version"; installation reports it');
  if (manifest.private !== true) warn(where, 'set "private": true unless you intend to publish this package');
  if (manifest.type !== 'module') error(where, '"type": "module" is required: the Host imports the plugin as ESM');

  // dsh evaluates engines.dsh with includePrerelease, so ">=0.2.0 <0.3.0"
  // accepts 0.2.2-rc.5; this check mirrors that exactly.
  const engine = manifest.engines?.dsh;
  if (typeof engine !== 'string' || engine.trim() === '') {
    warn(
      where,
      'declare "engines": { "dsh": ">=0.2.0 <0.3.0" }; without it dsh checks @deepseek-ai/dsh* peer ranges instead, and the release recorded in dsh-plugins.config.json is not enforced',
    );
  } else if (!semver.validRange(engine)) {
    error(where, `engines.dsh "${engine}" is not a valid semver range`);
  } else if (
    semver.valid(config.dshVersion) &&
    !semver.satisfies(config.dshVersion, engine, { includePrerelease: true })
  ) {
    error(where, `engines.dsh "${engine}" excludes the recorded dsh ${config.dshVersion}, so installation is refused`);
  }

  const bundle = manifest.dsh?.bundle;
  let patchPaths = [];
  let rows = [];
  if (bundle === null || typeof bundle !== 'object') {
    error(
      where,
      'declare "dsh": { "bundle": { "patch": "./cordis.patch.yml" } }; without it the package installs as a plain dependency and contributes no row',
    );
  } else {
    const patch = bundle.patch;
    patchPaths = Array.isArray(patch) ? patch : typeof patch === 'string' ? [patch] : [];
    if (patchPaths.length === 0) error(where, 'dsh.bundle.patch must be a patch file path or a list of them');
    for (const rel of patchPaths) rows = rows.concat(readPatch(where, dir, rel));
    if (name !== undefined && !rows.some((row) => row.name === name)) {
      error(where, `no inserted row names "${name}", so the bundle would contribute nothing when a profile lists it`);
    }
    if (rows.length > 0 && rows.every((row) => row.disabled)) {
      warn(where, 'every inserted row is disabled, so the bundle installs but contributes nothing');
    }
  }

  const mainRel = exportTarget(manifest.exports, '.');
  if (mainRel === undefined) error(where, 'exports must map "." to the Host entry, for example "./src/index.js"');
  else if (!isFile(join(dir, mainRel))) error(where, `exports["."] points at ${mainRel}, which does not exist`);

  const clientRel = checkClient(where, dir, manifest, name);
  const iconRel = checkIcon(where, dir, manifest);
  const locale = checkLocale(where, dir, manifest);

  for (const rel of listFiles(dir)) {
    if (!rel.endsWith('.js') && !rel.endsWith('.mjs')) continue;
    const problem = syntaxProblem(join(dir, rel));
    if (problem !== undefined) error(where, `${rel} does not parse: ${problem}`);
  }

  const files = Array.isArray(manifest.files) ? manifest.files : undefined;
  if (files === undefined) {
    warn(where, 'no "files" list: a published tarball would ship the whole directory (a linked install ignores it)');
  } else {
    const runtime = new Set();
    if (mainRel !== undefined) runtime.add(posix(mainRel));
    if (clientRel !== undefined) runtime.add(posix(clientRel));
    for (const rel of patchPaths) runtime.add(posix(rel));
    if (iconRel !== undefined) runtime.add(posix(iconRel));
    if (isDirectory(join(dir, 'locale'))) runtime.add('locale/en.json');
    if (locale.detail !== undefined) runtime.add(posix(locale.detail));
    for (const rel of runtime) {
      if (!filesCover(files, rel)) error(where, `"files" omits ${rel}, so a published tarball would leave it out`);
    }
  }

  return { rows, name };
}

function main() {
  if (!existsSync(configPath)) {
    console.error(`check: missing ${posix(relative(root, configPath))}`);
    process.exit(1);
  }
  let config;
  try {
    config = readJson(configPath);
  } catch (cause) {
    console.error(`check: dsh-plugins.config.json is not valid JSON: ${firstLine(cause.message)}`);
    process.exit(1);
  }
  if (!semver.valid(config.dshVersion)) {
    error('dsh-plugins.config.json', 'dshVersion must be a semver version such as 0.2.2-rc.5');
  }
  if (typeof config.packagePrefix !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*-$/.test(config.packagePrefix)) {
    error('dsh-plugins.config.json', 'packagePrefix must look like "dsh-plugin-"');
  }

  const workspacePath = join(root, 'pnpm-workspace.yaml');
  try {
    const workspace = parseYaml(readFileSync(workspacePath, 'utf8'), { logLevel: 'silent' });
    const patterns = Array.isArray(workspace?.packages) ? workspace.packages.map((entry) => String(entry)) : [];
    if (!patterns.some((pattern) => pattern === 'plugins/*' || pattern === 'plugins/**')) {
      error('pnpm-workspace.yaml', 'list "plugins/*" under packages so every plugin directory is a workspace package');
    }
  } catch (cause) {
    error('pnpm-workspace.yaml', `cannot read the workspace file: ${firstLine(cause.message)}`);
  }

  const directories = isDirectory(pluginsRoot)
    ? readdirSync(pluginsRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
        .map((entry) => entry.name)
        .sort()
    : [];
  const plugins = directories.filter((name) => isFile(join(pluginsRoot, name, 'package.json')));
  for (const name of directories.filter((entry) => !isFile(join(pluginsRoot, entry, 'package.json')))) {
    warn(`plugins/${name}`, 'directory has no package.json, so it is not a workspace package');
  }
  if (plugins.length === 0) {
    warn('plugins', 'no plugins yet; create one with "pnpm new <slug>"');
  }

  const names = new Map();
  const rowIds = new Map();
  for (const directoryName of plugins) {
    const { name, rows } = checkPlugin(directoryName, config);
    if (name !== undefined) {
      if (names.has(name))
        error(`plugins/${directoryName}`, `package name "${name}" is already used by plugins/${names.get(name)}`);
      else names.set(name, directoryName);
    }
    for (const row of rows) {
      if (row.id === undefined) continue;
      const seen = rowIds.get(row.id);
      if (seen !== undefined && seen !== directoryName) {
        error(
          `plugins/${directoryName}`,
          `row id "${row.id}" is already inserted by plugins/${seen}; ids must be unique across the profile`,
        );
      } else if (seen === undefined) {
        rowIds.set(row.id, directoryName);
      }
    }
  }

  const grouped = new Map();
  for (const finding of findings) {
    const bucket = grouped.get(finding.where) ?? [];
    bucket.push(finding);
    grouped.set(finding.where, bucket);
  }
  for (const [where, bucket] of grouped) {
    console.log(`\n${where}`);
    for (const finding of bucket) console.log(`  ${finding.level === 'error' ? '✗' : '!'} ${finding.message}`);
  }

  const errors = findings.filter((finding) => finding.level === 'error').length;
  const warnings = findings.length - errors;
  const summary = `${plugins.length} plugin${plugins.length === 1 ? '' : 's'} checked`;
  console.log(
    `\n${summary} — ${errors} error${errors === 1 ? '' : 's'}, ${warnings} warning${warnings === 1 ? '' : 's'}`,
  );
  if (errors > 0) process.exitCode = 1;
}

main();
