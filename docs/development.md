# Development

The working loop for this repository: add a plugin, install it, verify it, remove it. Ends with
the definition of done.

## Add a plugin

```sh
pnpm new <slug> --title "Sentence case title" --description "What it does and where it appears."
pnpm check
```

`pnpm new` scaffolds `plugins/<slug>` from `templates/plugin`, filling in the package name, row
id, module id, and locale stubs. Then implement, keeping `pnpm check` at zero errors:

1. Decide the extension point first (Host effect, tool policy, slot, Chat row, settings section),
   and read the applicable reference before writing code — see
   [`references/plugin-development-notes.md`](references/plugin-development-notes.md).
2. Keep `cordis.patch.yml` naming this package's own row. Add `config:` only when the plugin
   exports a `Config` schema.
3. `pnpm check` must pass; the only acceptable warnings are `locale/zh.json` TODOs you are about
   to translate. Then run `pnpm format`.
4. Install and verify, then report exactly what you observed and what you could not observe.

## Install

```
plugin_manager action=install_bundle target=<absolute path of plugins/<slug>>
```

A successful install reports `application: "applied"`.

## Verify

1. `plugin_manager action=list_bundles`: the bundle appears with `availability: "profile"`,
   `source: "link:..."`, `enabled: true`, its locale `description`, and one row
   (`entryId: "include:<slug>"`).
2. The profile `package.json` gained `"<package name>": "link:<absolute path>"` and appended the
   package to `dsh.profile.bundles`. The user's `cordis.patch.yml` stays untouched.
3. The feature itself. Without browser control you cannot confirm rendering: say so, and do not
   claim visual success from installation alone.

## Reload

- **Browser half** hot-reloads: the app stat-polls each active plugin's client artifact and swaps
  a rewritten bundle in, so saving `src/client.js` reaches the page without a restart.
- **Host half** does not: a linked package is replaced at the next profile recomposition.
  Automatic watching requires the profile's `hmr` row to include this repo (`root: [...]`,
  default `root: []`); otherwise restart the app.
- **`package.json`** edits take effect only when a row restarts. **`cordis.patch.yml`** is read at
  install and on recomposition.

## Remove

`plugin_manager action=remove_bundle` restores the profile manifest and lockfile but **leaves the
`node_modules/<package>` junction behind**. Delete it without following the link:

```powershell
cmd /c rmdir "$env:DSH_PROFILE_DIR\node_modules\dsh-plugin-<slug>"
```

## Definition of done

- `pnpm check` passes with no errors (warnings understood and reported).
- `pnpm format` leaves no further diff, so the change is Prettier-clean.
- The bundle installs with `application: "applied"` and its row is active in `list_bundles`.
- Locale title/description, detail document if declared, and a real (non-placeholder) icon are in
  place; `locale/zh.json` is translated.
- The report states where the plugin lives, what was verified, and what remains unverified.
