# Reliability

The failure modes and rules that keep plugins working across dsh releases and installs.

## Version gating

- `engines.dsh` is checked with `includePrerelease`, so `">=0.2.0 <0.3.0"` accepts `0.2.2-rc.5`.
- Installation refuses a bundle whose range the running dsh does not satisfy.
- `pnpm check` compares each plugin's range against the release in `dsh-plugins.config.json`; bump
  both together after an upgrade.

## Known pitfalls

- A bundle without `dsh.bundle` installs as a plain dependency and contributes no rows.
- Declaring `dsh.client` without exporting `./client` fails activation; declaring neither is a
  valid Host-only plugin.
- The browser half is a classic script: no `import`, no `export`, no top-level side effects. Only
  `react`/`react-dom` and modules named in `dsh.client.external` may be required.
- A throwing component blanks its slot entry. Do not import `@deepseek-ai/*` Client packages as
  modules at runtime; copy the markup/behavior you need instead.
- dsh packages whose _instance_ must be shared (Cordis, service types) belong in both
  `peerDependencies` and `devDependencies`; stateless utilities (e.g. `@deepseek-ai/schemastery`
  for `Config`) belong in `dependencies`.
- `files` does not filter a linked install.
- Reinstalling a name dsh considers already installed fails with `already-installed`; remove the
  bundle first.
- The `desktop` profile is Desktop-managed: the npm `dsh` CLI refuses it, so use the app or
  `plugin_manager`, not `dsh plugin --profile desktop`.
- Template placeholders are `__NAME__` in code, YAML, and JSON, and `{{NAME}}` in Markdown:
  Prettier rewrites `__NAME__` there as bold, which is why `templates/plugin/README.md` uses the
  braces form. `scripts/new-plugin.mjs` substitutes both forms; keep the matching form when
  editing a template.
