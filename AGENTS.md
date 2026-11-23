# Working in dsh-plugins

Instructions for agent sessions in this repository. Read this before adding or changing a plugin.

## What this repository is

A pnpm workspace where every directory under `plugins/` is one installable DeepSeek Harness
(dsh) *bundle* package. Plugins are installed into a dsh profile by absolute path; the profile
then links the checkout, so this working tree is what runs.

## Non-negotiables

- **Never hand-edit the profile.** `$DSH_PROFILE_DIR/package.json`, its `cordis.patch.yml`, and
  its `cordis.yml`/lockfile belong to the user. Install, enable, disable, and remove through
  `plugin_manager` (`install_bundle` / `set_bundle` / `remove_bundle`) or the app's **Plugins**
  page. Do not run pnpm inside the profile yourself.
- **Never edit `dsh`'s installation.** It lives inside `app.asar`; read it, never write it.
- **One package per plugin.** Do not merge plugins into one package or create a shared package
  until a second plugin genuinely needs the same code (then use `packages/*` and `workspace:*`).
- **Record the release you target.** `dsh-plugins.config.json` holds the dsh version this repo is
  developed against. After a dsh upgrade, update it and every plugin's `engines.dsh`.

## Conventions

| Thing | Rule |
|---|---|
| Directory | `plugins/<slug>` — lower-case words, single hyphens |
| Package name | `dsh-plugin-<slug>` (prefix in `dsh-plugins.config.json`) |
| Patch row id | `<slug>`, unique across the whole repo |
| Browser module id | exactly the package name |
| Host entry | `src/index.js`, plain ESM, exports `apply(ctx, config)` |
| Browser entry | `src/client.js`, classic script, calls `window.__ModuleLoader__.load` |
| Locales | `locale/en.json` and `locale/zh.json`, each with `meta.title` and `meta.description` |
| Icon | `icon.svg` on a 36×36 canvas, exported as `./icon` |

No build step: the files in `src/` are the files dsh executes and serves. Add a bundler only if a
plugin needs JSX, TypeScript, or npm code in the browser half; then export built files instead
and update `files`.

## Add a plugin

```sh
pnpm new <slug> --title "Sentence case title" --description "What it does and where it appears."
pnpm check
```

Then implement, keeping `pnpm check` at zero errors:

1. Decide the extension point first (Host effect, tool policy, slot, Chat row, settings section).
   Read the applicable reference before writing code — see *Learning the APIs* below.
2. Keep `cordis.patch.yml` naming this package's own row. Add `config:` only when the plugin
   exports a `Config` schema.
3. `pnpm check` must pass; the only acceptable warnings are `locale/zh.json` TODOs you are about
   to translate.
4. Install and verify (next section), then report exactly what you observed and what you could
   not observe.

## Install, verify, remove

```
plugin_manager action=install_bundle target=<absolute path of plugins/<slug>>
```

A successful install reports `application: "applied"`. Verify, in this order:

1. `plugin_manager action=list_bundles`: the bundle appears with `availability: "profile"`,
   `source: "link:..."`, `enabled: true`, its locale `description`, and one row
   (`entryId: "include:<slug>"`).
2. The profile `package.json` gained `"<package name>": "link:<absolute path>"` and appended the
   package to `dsh.profile.bundles`. The user's `cordis.patch.yml` stays untouched.
3. The feature itself. Without browser control you cannot confirm rendering: say so, and do not
   claim visual success from installation alone.

Removal restores the profile manifest and lockfile but **leaves the `node_modules/<package>`
junction behind**. Delete it explicitly, without following the link:

```powershell
cmd /c rmdir "$env:DSH_PROFILE_DIR\node_modules\dsh-plugin-<slug>"
```

## Development loop

- Browser half: the app stat-polls each active plugin's client artifact and swaps a rewritten
  bundle in (`@deepseek-ai/dsh-client-hmr`), so saving `src/client.js` reaches the page without a
  restart.
- Host half: a linked package is replaced at the next profile recomposition. Automatic watching
  requires the profile's `hmr` row to include this repo (`root: [...]`, default `root: []`);
  otherwise restart the app.
- `package.json` edits take effect only when a row restarts. `cordis.patch.yml` is read at install
  and on recomposition.

## Learning the APIs

Do not guess service methods, event names, slot names, or props.

1. Load the `dsh-doc` skill (`skill` tool) — it is the maintained entry point and routes to the
   package READMEs, templates, and authoring references.
2. If the session has `cordis_inspect_list`/`cordis_inspect_query`, use them: they report the
   real services, events, mounted config schemas, and live Client slots.
3. Otherwise read the installation. On Desktop everything is inside an ASAR, where native tools
   (`grep`, `glob`, `ls`, `node`) fail; use the `read` tool on absolute paths:

   ```
   $env:DSH_INSTALL_DIR/package.json                     # running version
   $env:DSH_INSTALL_DIR/docs/user/develop/basic/publish.md
   $env:DSH_INSTALL_DIR/docs/user/develop/basic/config.md
   $env:DSH_INSTALL_DIR/../dsh-client-ui-conversation/src/client/contract/slots.ts   # slot names
   ```

   Package sources ship under each package's `src/`; the nearest `README.md` is the API reference.

## Gotchas

- `engines.dsh` is checked with `includePrerelease`, so `">=0.2.0 <0.3.0"` accepts `0.2.2-rc.5`.
- A bundle without `dsh.bundle` installs as a plain dependency and contributes no rows.
- Declaring `dsh.client` without exporting `./client` fails activation; declaring neither is a
  valid Host-only plugin.
- The browser half is a classic script: no `import`, no `export`, no top-level side effects.
  Only `react`/`react-dom` and modules named in `dsh.client.external` may be required.
- A throwing component blanks its slot entry. Do not import `@deepseek-ai/*` Client packages as
  modules at runtime; copy the markup/behavior you need instead.
- dsh packages whose *instance* must be shared (Cordis, service types) belong in both
  `peerDependencies` and `devDependencies`; stateless utilities (e.g. `@deepseek-ai/schemastery`
  for `Config`) belong in `dependencies`.
- `files` does not filter a linked install, but it decides what a published tarball ships.
- Reinstalling a name dsh considers already installed fails with `already-installed`; remove the
  bundle first.
- The `desktop` profile is Desktop-managed: the npm `dsh` CLI refuses it, so use the app or
  `plugin_manager`, not `dsh plugin --profile desktop`.

## Definition of done

- `pnpm check` passes with no errors (warnings understood and reported).
- The bundle installs with `application: "applied"` and its row is active in `list_bundles`.
- Locale title/description, detail document if declared, and a real (non-placeholder) icon are in
  place; `locale/zh.json` is translated.
- The report states where the plugin lives, what was verified, and what remains unverified.
