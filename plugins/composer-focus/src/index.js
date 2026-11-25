/**
 * Host half of dsh-plugin-composer-focus.
 *
 * The bundle row exists so the package is part of the active profile: the
 * client module system composes the browser roster from enabled Loader rows,
 * so `dsh.client` in `package.json` publishes `src/client.js` only while this
 * row is installed and enabled. Nothing in the Host contributes to the
 * shortcut itself — command registration and focus routing are browser-side —
 * so `apply` deliberately stays empty.
 */
export const name = 'composer-focus';

export function apply() {}
