# dsh-plugins — agent instructions

This repository is a pnpm workspace of installable DeepSeek Harness (dsh) plugin packages. This
file is the **table of contents**: it names what the repository is and where each piece of
knowledge lives. Read it once, then open the doc for the task at hand.

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

## Table of contents

| Document                                                                                     | What it holds                                                                                                                                        |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`ARCHITECTURE.md`](ARCHITECTURE.md)                                                         | How a plugin is layered and wired into dsh: the bundle, the host/browser halves, the patch layer, the file anatomy. Start here for the mental model. |
| [`docs/development.md`](docs/development.md)                                                 | The working loop: add, install, verify, remove; reload/HMR; the definition of done.                                                                  |
| [`docs/conventions.md`](docs/conventions.md)                                                 | Naming, layout, and formatting rules every plugin follows.                                                                                           |
| [`docs/reliability.md`](docs/reliability.md)                                                 | Version gating and known pitfalls.                                                                                                                   |
| [`docs/references/plugin-development-notes.md`](docs/references/plugin-development-notes.md) | How to find the real API facts, plus the verified deep mechanics of dsh plugin loading.                                                              |

## Development Commands

- `pnpm new <slug> --title "…" --description "…"` — scaffold `plugins/<slug>` from `templates/plugin`
- `pnpm check` — validate every plugin (manifest, patch, locales, icon, JS syntax)
- `pnpm format` — rewrite files with Prettier (`.prettierrc.json`)
- `pnpm test` — run each plugin's `test` script

## Practical Notes

- Use Conventional Commits: `<type>(<scope>): <description>`, See `git log --oneline` for examples
  - `docs(skills): ...` when only skill changes
  - `docs(agents): ...` when only AGENTS.md changes

## Definition of done

Before reporting a change complete, satisfy [`docs/development.md`](docs/development.md)'s
definition of done: `pnpm check` passes, `pnpm format` leaves no diff, the bundle installs with
`application: "applied"`, and the report states what was verified and what remains unverified.
