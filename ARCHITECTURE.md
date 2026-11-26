# Architecture

How this repository and its plugins are structured. This is the map every other document assumes:
read it before [`docs/conventions.md`](docs/conventions.md) or
[`docs/development.md`](docs/development.md).

## The workspace

A pnpm workspace. Every directory under `plugins/` is one installable package named
`dsh-plugin-<slug>`. There is no shared runtime package until a second plugin genuinely needs the
same code; then it lives under `packages/` with `workspace:*`.

## The bundle

A plugin is a _bundle_: an npm package whose `dsh.bundle.patch` names a YAML patch file
(`cordis.patch.yml`). That file is a Cordis patch layer — a list of rows applied over the
profile's own layers. A plugin enters dsh by inserting its Loader row through this patch.

```json
{
  "name": "dsh-plugin-demo",
  "exports": { ".": "./src/index.js", "./client": "./src/client.js" },
  "engines": { "dsh": ">=0.2.0 <0.3.0" },
  "dsh": { "bundle": { "patch": "./cordis.patch.yml" } }
}
```

## The two halves

A plugin runs in two places, and the direction is one-way: the Host publishes capabilities, the
Browser renders them.

| Half    | File            | Runtime          | Shape                                          | Purpose                          |
| ------- | --------------- | ---------------- | ---------------------------------------------- | -------------------------------- |
| Host    | `src/index.js`  | Node, in dsh     | plain ESM, `apply(ctx, config)`                | services, effects, tool policies |
| Browser | `src/client.js` | Web/Desktop page | classic script, `window.__ModuleLoader__.load` | slots, UI, client commands       |

The halves never import each other. They communicate only through dsh: the Host exposes services
and tools, the Browser registers against the Client slots the app provides. A plugin may carry
either half; most carry both.

## File anatomy

```
plugins/<slug>/
  package.json           manifest: name, exports, engines.dsh, optional dsh.client
  cordis.patch.yml       the patch layer: inserts this package's Loader row
  src/index.js           Host half
  src/client.js          Browser half
  locale/en.json         title + description shown by Plugin Manager
  locale/zh.json         the same, in Chinese
  docs/DETAIL.md         optional detail page (README.md is the fallback)
  icon.svg               row icon, 36×36 canvas, exported as ./icon
  README.md              package documentation
```

## How a plugin reaches the running app

1. The bundle is installed into a profile by absolute path; pnpm links the checkout
   (`link:<abs path>`), so this working tree is what runs — no build step.
2. dsh reads `cordis.patch.yml` and inserts the row; the profile recomposes.
3. The Host half loads from `src/index.js` at recomposition. The Browser half is served from
   `src/client.js` and hot-swapped while the page runs.

Reload details are in [`docs/development.md`](docs/development.md); the verified mechanics are in
[`docs/references/plugin-development-notes.md`](docs/references/plugin-development-notes.md).
