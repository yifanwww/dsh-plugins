# Plugin development notes

Mechanics of building and running dsh plugins, gathered while setting up this repository against
**dsh 0.2.2-rc.5** (Desktop, profile `desktop`). Paths beginning with `$DSH_INSTALL_DIR` live
inside `app.asar`, where native tools cannot read; open them with the `read` tool.

Facts are marked **[verified]** when observed on this machine, and **[source]** / **[docs]** when
they come from dsh's shipped code or documentation.

---

## 1. Installing a local directory

**[verified]** `plugin_manager` `install_bundle` with `target = <repo>/plugins/<slug>` produced:

- Profile `package.json`: a new dependency and an appended bundle, in this shape:

  ```json
  {
    "dependencies": {
      "dsh-plugin-smoke-test": "link:C:/projects/yifanwww/dsh-plugins/plugins/smoke-test"
    },
    "dsh": {
      "profile": { "bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "...", "dsh-plugin-smoke-test"] }
    }
  }
  ```

- A Windows **junction** at `<profile>/node_modules/<package>` pointing at the checkout.
- The user's `<profile>/cordis.patch.yml` left byte-identical, and the user patch layer still
  applies after every bundle layer.
- Result `application: "applied"`; the bundle then appears in the inventory with
  `availability: "profile"`, `source: "link:..."`, `enabled: true`, its locale description, and
  one row (`entryId: "include:<rowId>"`).

**[source]** The install runs `pnpm add <spec>` in the profile
(`dsh-plugin-manager/src/index.ts:1039`), and a local path must be absolute
(`src/install-spec.ts:74-78`); pnpm records it as `link:`
(`src/install-spec.ts:138-158`). Installation then calls `selectBundle(name, true)`, which is what
appends the name to `dsh.profile.bundles` (`src/index.ts:1103`).

**[docs]** `$DSH_INSTALL_DIR/docs/user/develop/basic/publish.md:85` — "pnpm links the checkout,
and `dsh` appends the bundle to `dsh.profile.bundles` because the package declares `dsh.bundle`".

Bundle order is precedence: later layers win per row, and a patch replaces a row's whole `config`
rather than merging keys (`publish.md:131-134`). A bundle re-enabled after being disabled is
appended at the end, so its precedence can change.

## 2. Removing a plugin

**[verified]** `remove_bundle` removed the dependency and the lockfile entry, deselected the
bundle, and left `package.json` byte-identical to its pre-install content. It **left the
`node_modules/<package>` junction behind**. Delete it without following the link:

```powershell
cmd /c rmdir "$env:DSH_PROFILE_DIR\node_modules\dsh-plugin-<slug>"
```

`Remove-Item -Recurse` on a junction can traverse into the link target (this repository), so do
not use it. The same residue pattern showed up as a dangling `@local/desktop-notifier` link in
this profile before this repo existed.

## 3. What a bundle must declare

**[docs]** A bundle is an npm package with `dsh.bundle.patch`; the patch is a YAML array applied
as one layer, and it may name several files applied in order (`publish.md:56-64`). Rows insert
plugins by package name, not by relative path, so Node resolution finds the installed code.

```json
{
  "name": "dsh-plugin-demo",
  "version": "0.1.0",
  "type": "module",
  "exports": { ".": "./src/index.js" },
  "engines": { "dsh": ">=0.2.0 <0.3.0" },
  "dsh": { "bundle": { "patch": "./cordis.patch.yml" } }
}
```

A package **without** `dsh.bundle` still installs, but only as a dependency: it prints a warning
and contributes no layer (`publish.md:64`). That is the right shape for a shared library.

## 4. The browser half

**[source]** A plugin joins the browser graph only when its manifest declares `dsh.client` with
`platform: "web"` **and** exports `./client`; otherwise the graph throws
`declares dsh.client but exports no "./client" bundle` (`dsh-client-modules/src/index.ts:906-909`).
The other supported fields are `inject` (ordering-only package dependencies), `immediately`
(boot-phase-one barrier), and `external` (exact extra module-table requests; type-only imports
create none) — `dsh-package-manifest/src/types.ts:86-100`.

The artifact is a **classic script**, not an ES module
(`dsh-client-modules/src/client/manifest.ts:348-374`):

```js
window.__ModuleLoader__.load({
  id: '<package name>', // must equal the package name
  factory(require) {
    const React = require('react'); // baseline external
    return {
      inject: ['slots'],
      apply(ctx) {
        /* register slots here */
      },
    };
  },
});
```

It is loaded with `document.createElement('script')` and no `type="module"`
(`src/client/system.ts:15-29`), `factory` runs once when the module materializes, and duplicate
registration throws. React/ReactDOM are the implicit baseline; anything else must be listed in
`dsh.client.external`.

Host-only plugins legitimately omit `dsh.client` entirely.

**[verified]** The slot used by this repo's template, `conversation.composer.dock`, is declared as
`{ kind: 'list', scope: 'session' }` (`dsh-client-ui-conversation/src/client/contract/slots.ts:315`)
and rendered by `src/client/skeleton/InputBar.tsx:598` in this build.

## 5. Reload behavior

- **Browser half** — **[source]** the client artifact is read from disk when the graph
  reconciles, and its revision is derived from `mtimeMs`/`ctimeMs`/`size`
  (`dsh-client-modules/src/index.ts:1099-1114`). `dsh-client-hmr` stat-polls every active row's
  bundle every 500 ms and republishes a changed one (`dsh-client-hmr/src/index.ts:2-8`), so
  rewriting the exported file is enough; nothing recompiles. Only the exported artifact is
  watched: a source-only edit changes nothing until something rewrites that file.
- **Host half** — **[docs]** a profile recomposition replaces plugins "whose loaded files below
  the profile directory changed on disk… [including] the targets of linked packages"
  (`dsh-hmr/README.md:49`). Recompositions are triggered by config/bundle changes, not by an
  arbitrary edit, so for automatic reload give the `hmr` row the repo as a watch root
  (default is `root: []`, `dsh-hmr/README.md:27-45`):

  ```yaml
  - id: hmr
    disabled: false
    config:
      root: ['C:/projects/yifanwww/dsh-plugins']
  ```

- **`package.json`** — **[source]** read when a Loader entry starts or restarts
  (`dsh-client-modules/README.md:149`), so manifest edits need a restart.

## 6. Version gating

**[source]** `engines.dsh` is evaluated with
`semver.satisfies(runtimeVersion, range, { includePrerelease: true })`
(`dsh-app-boot/src/plugin-compatibility.ts:51-53`), so `">=0.2.0 <0.3.0"` accepts `0.2.2-rc.5`.
Installation refuses a bundle whose range the running dsh does not satisfy (`publish.md:66`).
When `engines.dsh` is absent, dsh checks `@deepseek-ai/dsh*` peer ranges instead.

`pnpm check` compares each plugin's range against the release recorded in
`dsh-plugins.config.json`, so bump both together after an upgrade.

## 7. Dependencies of a linked package

**[docs]** "A linked checkout keeps its own `node_modules`. Declare dsh packages whose instances
the plugin must share with the host under both `peerDependencies` and `devDependencies`… Keep
independently versioned third-party dependencies and stateless dsh utilities under
`dependencies`." (`publish.md:105`). Peers resolve from the running installation at the link's
lookup position (`publish.md:107`).

This repo's plugins start with no runtime dependencies, so a linked install needs nothing else.
`Config` schemas need `@deepseek-ai/schemastery` as a dependency (that is how shipped plugins do
it, e.g. `dsh-repeat-tool-reminder/src/index.ts:10,52`).

## 8. Distributing later

**[docs]** `publish.md:161-186`:

- npm publish, then `dsh plugin add <package>` — prebuilt files, no build permission needed.
- `pnpm pack` + `dsh plugin add ./pkg.tgz`.
- `github:you/repo` — fetches **sources**: the package needs a self-contained `prepare` build, and
  the user must allow it via `allowBuilds` in their profile's `pnpm-workspace.yaml`. Only do this
  with code you trust, pinned to a commit.

The `desktop` profile cannot be managed by the npm `dsh` CLI; use the app or `plugin_manager`.

## 9. What this setup verified, and what it did not

Verified on 0.2.2-rc.5 by installing a generated template plugin and removing it again: link
dependency and junction creation, bundle selection, row activation (`include:smoke-test`),
locale-driven description in the inventory, `application: "applied"`, exact restoration of the
profile manifest on removal, and validator coverage of the failure modes it claims.

Not verified here: how the plugin renders in the page (no browser control in this session — the
GUI's HTTP surface requires an authenticated URL), and the live client-HMR swap, which follows
from the shipped poller but was not observed.
