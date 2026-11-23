/**
 * Browser half of __PACKAGE_NAME__.
 *
 * The Host serves this file to the Web/Desktop page, where it registers one
 * lazy module under the package name. Keep `factory` free of side effects: it
 * only builds the module exports, and the returned plugin's `apply` runs when
 * the module materializes with `ctx` bound to the Client context.
 *
 * Only module-table entries may be required here. `react` and `react-dom` are
 * always available; list anything else in `dsh.client.external`.
 */
window.__ModuleLoader__.load({
  id: '__PACKAGE_NAME__',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /**
     * A small pill under the composer. It uses inherited colors instead of
     * theme tokens so it stays readable in both themes; a real plugin should
     * use the `--dsw-alias-*` tokens of the surface it renders into.
     */
    function Badge() {
      return h('span', {
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          margin: '4px 0',
          padding: '1px 8px',
          border: '1px solid currentColor',
          borderRadius: 999,
          fontSize: 11,
          lineHeight: 1.6,
          opacity: 0.55,
          pointerEvents: 'none',
        },
      }, '__TITLE__')
    }

    return {
      /** Services this module needs before it is applied. */
      inject: ['slots'],
      apply(ctx) {
        // `slots.inject` re-registers the callback whenever the owning slot
        // declaration changes; every registration it makes is disposed with it.
        ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
          name: 'conversation.composer.dock',
          id: '__SLUG__',
          order: 100,
        }, Badge))
      },
    }
  },
})
