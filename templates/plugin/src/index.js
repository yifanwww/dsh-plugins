/**
 * Host half of __PACKAGE_NAME__.
 *
 * The bundle's `cordis.patch.yml` inserts the Loader row that points here, so
 * this plugin runs in the Host at profile start. The browser half lives in
 * `src/client.js` and is loaded separately through `dsh.client` in
 * `package.json`.
 *
 * Everything registered on `ctx` is an effect owned by this plugin: it is
 * disposed when the plugin unloads, so `ctx.effect`, `ctx.on`, and service
 * registrations need no manual cleanup.
 */
export const name = '__SLUG__';

export function apply(ctx) {
  // Contribute Host behavior here. Typical starts:
  //
  //   ctx.effect(() => ctx.systemPrompt.section({ /* ... */ }))
  //   ctx.on('agent/created', ({ agent }) => { /* ... */ })
  //
  // Choose the extension point before writing code: see
  // docs/plugin-development-notes.md and load the `dsh-doc` skill for the
  // current package READMEs and sources.
}
