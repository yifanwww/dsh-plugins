# dsh-plugins

My [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh) plugins: one
installable package per plugin, developed in a pnpm workspace and linked live into a dsh
profile.

## Using the plugins

Install a plugin from this repository by pointing `dsh plugin add` at the plugin's folder inside
the repo:

```sh
dsh plugin add "github:yifanwww/dsh-plugins#path:plugins/<slug>"
```

Add `--profile <name>` to target a specific profile; on the Desktop app, use **Plugins → Add
plugin** instead, since the `dsh` CLI can't manage the Desktop-managed `desktop` profile. Remove a
plugin with `dsh plugin remove dsh-plugin-<slug>`, or from **Plugins**.

## Plugins

### [`composer-focus`](plugins/composer-focus)

Focus the chat composer from anywhere in the window, even while it's unfocused, so you can jump
back to typing without clicking first.

- **Install:** `dsh plugin add "github:yifanwww/dsh-plugins#path:plugins/composer-focus"`
- **Use it:** press `Ctrl+I` (`Cmd+I` on macOS).
- **Change the shortcut:** **Settings → Keyboard shortcuts** → **Focus message input**.
- **Details:** [`plugins/composer-focus/README.md`](plugins/composer-focus/README.md) — on the
  Web runtime the shortcut ships unbound, so record one there first.

## Developing

dsh loads plugins from _bundles_: an npm package whose `dsh.bundle.patch` names a YAML file that
inserts Loader rows, optionally plus a browser half that registers a module in the Web/Desktop
page. A profile installs each bundle separately, so every plugin here is its own package with
its own manifest, patch, locale files, and icon.

```sh
pnpm install
pnpm new my-plugin --title "My plugin"   # creates plugins/my-plugin (dsh-plugin-my-plugin)
# ... implement plugins/my-plugin/src/index.js and src/client.js ...
pnpm check                                # validate manifests, patches, locales, icons, syntax
pnpm format                               # rewrite with prettier (the pre-commit hook does this too)
```

Then install it into a profile by absolute directory path: **Plugins > Add plugin** in the dsh
app, or `plugin_manager` `install_bundle`. The profile links the checkout, so later edits reach
the running app without reinstalling.

## Layout

```
plugins/<slug>/          one package per plugin: dsh-plugin-<slug>
  package.json           dsh.bundle.patch, optional dsh.client, exports, engines.dsh
  cordis.patch.yml       the bundle layer: inserts the plugin's Loader row
  src/index.js           Host half (plain ESM, run by Node inside dsh)
  src/client.js          browser half (classic script registering window.__ModuleLoader__)
  locale/en.json         title and description shown by Plugin Manager
  locale/zh.json         the same, in Chinese (the app falls back to English)
  docs/DETAIL.md         optional detail page: one feature image, plus a localized variant
  icon.svg               row icon
  README.md              package documentation; the detail fallback without docs/DETAIL.md
templates/plugin/        the starter copied by `pnpm new`
scripts/                 new-plugin.mjs, check-plugins.mjs
dsh-plugins.config.json  recorded dsh release + package prefix
.prettierrc.json         formatting rules for every file (.prettierignore skips pnpm-lock.yaml)
.husky/pre-commit        git hook: lint-staged runs prettier on staged files
```

## Scripts

| Command           | What it does                                                                                                                                                                             |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm new <slug>` | Scaffold `plugins/<slug>` from `templates/plugin`, filling in the package name, row id, module id, and locale stubs.                                                                     |
| `pnpm check`      | Validate every plugin against the rules dsh applies on install/activation: manifest, patch rows, client export and module id, locale text, icon limits, `files` coverage, and JS syntax. |
| `pnpm format`     | Rewrite every supported file with Prettier (configuration in `.prettierrc.json`).                                                                                                        |
| `pnpm test`       | Run `test` scripts of plugins that define them (`node --test` is a good default).                                                                                                        |

## Development loop

- **Browser half**: the app polls each active plugin's client artifact (every 500 ms) and swaps
  in a rewritten bundle, so saving `src/client.js` updates the page without a restart. There is
  no build step here — the source file _is_ the served artifact.
- **Host half**: dsh replaces a linked plugin at the next profile recomposition. To get that
  automatically, enable source watching for this repo in the profile's `cordis.patch.yml`:

  ```yaml
  - id: hmr
    disabled: false
    config:
      root: ['C:/projects/yifanwww/dsh-plugins']
  ```

  Without it, restart the app after Host edits.

- **`package.json`**: read when a row starts, so manifest changes need a restart.
- **`cordis.patch.yml`**: applied on install; edit it in the repo and reinstall, or override the
  row in the profile's own patch layer.

Details, including exact install/remove behavior and the residue removal leaves behind, are in
[`docs/references/plugin-development-notes.md`](docs/references/plugin-development-notes.md).

## Removing a plugin

**Plugins >** remove, or `plugin_manager` `remove_bundle`. dsh restores the profile manifest and
lockfile but can leave the `node_modules/<package>` junction behind; delete it with `rmdir`
(not a recursive delete, which would follow the link into this repo):

```powershell
cmd /c rmdir "$env:DSH_PROFILE_DIR\node_modules\dsh-plugin-my-plugin"
```

## Requirements

- dsh 0.2.2-rc.5 (the release recorded in `dsh-plugins.config.json`; bump it and every plugin's
  `engines.dsh` when upgrading).
- Node.js 20+ and pnpm 12 (pnpm is pinned by `packageManager` in `package.json`).
- Git: `pnpm install` installs the pre-commit formatting hook. Where hooks cannot run, call
  `pnpm format` before committing.
- The `desktop` profile is managed by the Desktop app; the npm `dsh` CLI refuses it and is only
  useful for other profiles.
