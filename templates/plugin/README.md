# {{PACKAGE_NAME}}

{{DESCRIPTION}}

## What it does

<!-- The capability, in one or two sentences. Name the surface and the labels a
user sees. This text is the Plugin Manager detail page whenever no
`meta.detail` document is declared. -->

## Usage

<!-- How to trigger it, what it reads or sends, and the limitations that matter. -->

## Development

The package is linked into a dsh profile, so the profile reads this working
tree directly:

```sh
pnpm check    # validate manifests, patches, locales, icons, syntax
pnpm format   # rewrite with prettier; the pre-commit hook also formats staged files
```

Then install it once per profile: **Plugins > Add plugin** and give the
absolute path of this directory, or let an agent call
`plugin_manager` `install_bundle` with that path.

Browser changes are picked up by the running page. Host changes need the
plugin to restart: restart the app, or configure the profile's `hmr` row (see
the repo's `docs/plugin-development-notes.md`).

## Before you ship

- Replace `icon.svg` with an icon that reads at row size (36×36 canvas, no
  text, no background tile).
- Translate `locale/zh.json`; `pnpm check` warns while its text says `TODO`.
- Keep `engines.dsh` in step with the dsh release you test against.
