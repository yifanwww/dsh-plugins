# Conventions

The naming, layout, and formatting rules every plugin follows. These are what `pnpm check`
validates; keep them true rather than working around the checker. The file anatomy and the
host/browser split live in [`../ARCHITECTURE.md`](../ARCHITECTURE.md).

| Thing             | Rule                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------ |
| Directory         | `plugins/<slug>` — lower-case words, single hyphens                                  |
| Package name      | `dsh-plugin-<slug>` (prefix in `dsh-plugins.config.json`)                            |
| Patch row id      | `<slug>`, unique across the whole repo                                               |
| Browser module id | exactly the package name                                                             |
| Host entry        | `src/index.js`, plain ESM, exports `apply(ctx, config)`                              |
| Browser entry     | `src/client.js`, classic script, calls `window.__ModuleLoader__.load`                |
| Locales           | `locale/en.json` and `locale/zh.json`, each with `meta.title` and `meta.description` |
| Icon              | `icon.svg` on a 36×36 canvas, exported as `./icon`                                   |
| Formatting        | Prettier via `.prettierrc.json`; run `pnpm format`, never hand-align the diff        |

No build step: the files in `src/` are the files dsh executes and serves. Add a bundler only if a
plugin needs JSX, TypeScript, or npm code in the browser half; then export built files instead
and update `files`.
