/**
 * Browser half of dsh-plugin-composer-focus.
 *
 * Registers one application keyboard command, `composer.focus`, through the
 * client shortcut service. On Desktop the native keyboard bridge intercepts
 * the effective combination before DOM input, so the command runs even with
 * the composer unfocused; the command then returns the keyboard to the
 * session's message input through the product's own focus entry point.
 *
 * Only module-table entries may be required here. This half needs neither
 * React nor another Client package: every service it uses arrives through
 * `inject`.
 */
window.__ModuleLoader__.load({
  id: 'dsh-plugin-composer-focus',
  factory() {
    /** Client locale namespace; unregistered locales fall back to English. */
    const NS = 'composer-focus';
    const en = { command: 'Focus message input' };
    const zh = { command: '聚焦输入框' };

    /**
     * Resolve the input facade of the Session the main view displays.
     *
     * `uiSession.adapter.current` is the main-view Session binding: its `key`
     * is the Session id and its `ctx` is that Session's own scope, which is
     * what `conversation.input.for()` addresses. The SessionInput face is the
     * same one the composer and the command popup use, and `focus()` restores
     * the caret the editor last held.
     *
     * @param ctx - Client context carrying `uiSession` and `conversation`.
     * @returns the current Session's input facade, absent without a Session.
     */
    function mainSessionInput(ctx) {
      const binding = ctx.uiSession.adapter.current.getSnapshot();
      if (binding.ctx === undefined) return undefined;
      return ctx.conversation.input.for(binding.ctx);
    }

    return {
      /** Services this module needs before it is applied. */
      inject: ['shortcuts', 'locale', 'conversation', 'uiSession'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'composer-focus: dictionaries');
        const t = ctx.locale.bind(NS);

        ctx.effect(
          () =>
            ctx.shortcuts.register({
              // A dotted id: the Desktop configuration boundary accepts only
              // `<word>.<word>` command ids and rejects the whole catalog otherwise.
              id: 'composer.focus',
              label: () => t('command'),
              aliases: ['focus composer', 'composer', 'message input', 'prompt'],
              // Desktop only on purpose: the Web runtime admits only Mod+Alt,
              // Mod+Shift and a few special combinations, so a Mod+letter default
              // would be rejected there. An omitted profile stays unbound, and the
              // Web shortcut can still be recorded in Settings.
              defaults: {
                'desktop:macos': { code: 'KeyI', modifiers: ['primary'] },
                'desktop:windows': { code: 'KeyI', modifiers: ['primary'] },
                'desktop:linux': { code: 'KeyI', modifiers: ['primary'] },
              },
              regions: ['page', 'editable'],
              modals: [],
              resolve: (context) => {
                // Desktop gives application bindings priority over modal controls,
                // so a dialog has to be declined here rather than by `modals`.
                if (context.modal !== null) return { status: 'pass' };
                // Ctrl+I is Tab inside a terminal; leave that surface alone.
                if (context.region === 'terminal') return { status: 'pass' };
                // A global main panel (Settings, Plugins, …) replaces the
                // Conversation, so its composer is not mounted to receive focus.
                const layout = ctx.get('layout');
                if (layout !== undefined && layout.panelInfo.getSnapshot().activePanelId !== null) {
                  return { status: 'pass' };
                }
                let input;
                try {
                  input = mainSessionInput(ctx);
                } catch (error) {
                  console.error('composer-focus: cannot resolve the message input', error);
                  return { status: 'pass' };
                }
                if (input === undefined) return { status: 'pass' };
                return {
                  status: 'handled',
                  run: () => {
                    try {
                      input.focus();
                    } catch (error) {
                      console.error('composer-focus: focusing the message input failed', error);
                    }
                  },
                };
              },
            }),
          'composer-focus: command',
        );
      },
    };
  },
});
