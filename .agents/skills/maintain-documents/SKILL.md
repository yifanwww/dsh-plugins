---
name: maintain-documents
description: >-
  Use when adding, editing, reorganizing, or reviewing documentation in the dsh-plugins repository —
  README.md, AGENTS.md, ARCHITECTURE.md, the docs/ tree, or plugin and template READMEs. States each
  document's audience, where content belongs, and the conventions that keep the harness consistent.
---

# Maintaining dsh-plugins documentation

The documentation is a harness: a human-facing `README.md`, a short agent map (`AGENTS.md`), an
architecture doc, and a structured `docs/` tree. Each document has one audience and one job — put
content where that audience looks, and nowhere else.

## Audiences

| Document                     | Audience             | Job                                                     |
| ---------------------------- | -------------------- | ------------------------------------------------------- |
| `README.md`                  | users and developers | install/use the plugins; develop new ones               |
| `AGENTS.md`                  | agents               | a ~100-line table of contents into the repo's knowledge |
| `ARCHITECTURE.md`            | agents               | the bundle / host-browser / patch-layer model           |
| `docs/*.md`                  | agents               | the system of record, organized by concern              |
| `plugins/<slug>/README.md`   | users and developers | one plugin's install, usage, and development            |
| `templates/plugin/README.md` | developers           | the starter `pnpm new` copies                           |

## Rules

### README.md

- Write for humans. Do not route agents here (no "Agent sessions read …").
- Users install from the Git repo
  (`dsh plugin add "github:yifanwww/dsh-plugins#path:plugins/<slug>"`); developers install by
  absolute directory path to verify while working.
- No dedicated "Formatting" section — formatting is not important enough to headline.
- No "Publishing" or "Distribution" content — this repo does not support publishing.

### AGENTS.md

- Keep it a map, not a manual: roughly 100 lines, pointing into `docs/`.
- Keep the Non-negotiables visible; nothing in `docs/` overrides them.
- Update a map row whenever a document is added, renamed, or removed.

### ARCHITECTURE.md

- Holds the layer model: workspace → bundle → host/browser halves → file anatomy → wiring.
- Change it when the repo's structure changes, not for per-plugin details.

### docs/

- Organize by concern (development, conventions, reliability, references), not by how-to task.
- Keep cross-links current; a "See also" line names a document's neighbors.
- No `design-docs/` or `exec-plans/` subtrees, and no distribution/publish content.

### Plugin and template READMEs

- A plugin README leads with `## Install` (the Git command), then **What it does**, **Usage**,
  **Limitations**, **Development**.
- The template uses `{{SLUG}}` and `{{PACKAGE_NAME}}` placeholders — never `__NAME__` in Markdown,
  which Prettier rewrites as bold. `scripts/new-plugin.mjs` fills them in.

### Cross-references and hygiene

- When a file moves or is renamed, update every link to it: `README.md`, plugin READMEs, the
  template, and `AGENTS.md`.
- After any edit, run `pnpm format` and `pnpm check`; both must be clean.
