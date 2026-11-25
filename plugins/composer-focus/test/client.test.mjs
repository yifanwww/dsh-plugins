/**
 * Unit tests for the browser half.
 *
 * The page loads `src/client.js` as a classic script; these tests install the
 * same `window.__ModuleLoader__` facade, materialize the factory, and drive the
 * registered command against stubbed Client services. They cannot prove that
 * the real Desktop bridge intercepts the combination — only a running app can —
 * but they do cover the registration shape and every resolve branch.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

/** Distinguishes module instances; ESM caches a specifier after its first import. */
let loads = 0

/** Load the browser bundle and return the plugin object its factory builds. */
async function loadPlugin() {
  let registration
  globalThis.window = {
    __ModuleLoader__: {
      load(value) {
        registration = value
      },
    },
  }
  loads += 1
  await import(`../src/client.js?case=${loads}`)
  assert.ok(registration, 'client.js must register a module')
  assert.equal(registration.id, 'dsh-plugin-composer-focus')
  return registration.factory()
}

/**
 * Build a Client context stand-in.
 * @param options - session binding, active main panel, and focus spies.
 * @returns the fake context, registered commands, and captured effects.
 */
function makeContext({ binding = { key: 'session-1', ctx: {} }, panel = undefined, focus = () => {}, forInput } = {}) {
  const commands = []
  const effects = []
  const ctx = {
    effect(callback, label) {
      const dispose = callback()
      effects.push({ dispose, label })
      return dispose
    },
    locale: {
      register: () => () => {},
      bind: () => key => key,
    },
    shortcuts: {
      register(command) {
        commands.push(command)
        return () => {}
      },
    },
    uiSession: { adapter: { current: { getSnapshot: () => binding } } },
    conversation: {
      input: {
        for: forInput ?? (() => ({ focus })),
      },
    },
    get(name) {
      if (name !== 'layout') return undefined
      return panel === undefined
        ? undefined
        : { panelInfo: { getSnapshot: () => ({ activePanelId: panel }) } }
    },
  }
  return { ctx, commands, effects }
}

const pageContext = { region: 'page', modal: null, target: null }

test('registers one rebindable command with desktop-only defaults', async () => {
  const plugin = await loadPlugin()
  assert.deepEqual([...plugin.inject], ['shortcuts', 'locale', 'conversation', 'uiSession'])
  const { ctx, commands, effects } = makeContext()
  plugin.apply(ctx)
  assert.equal(commands.length, 1)
  const [command] = commands
  assert.match(command.id, /^[a-z][a-zA-Z0-9-]*\.[a-zA-Z][a-zA-Z0-9-]*$/, 'the Desktop boundary requires a dotted id')
  assert.deepEqual(Object.keys(command.defaults).sort(), ['desktop:linux', 'desktop:macos', 'desktop:windows'])
  for (const binding of Object.values(command.defaults)) {
    assert.deepEqual(binding, { code: 'KeyI', modifiers: ['primary'] })
  }
  assert.deepEqual([...command.regions], ['page', 'editable'])
  assert.equal(command.label(), 'command')
  assert.equal(typeof effects[0].dispose, 'function', 'the locale registration is owned by an effect')
})

test('focuses the current session input', async () => {
  const plugin = await loadPlugin()
  let focused = 0
  const { ctx, commands } = makeContext({ focus: () => { focused += 1 } })
  plugin.apply(ctx)
  const resolution = commands[0].resolve(pageContext)
  assert.equal(resolution.status, 'handled')
  resolution.run()
  assert.equal(focused, 1)
})

test('declines while a modal is open', async () => {
  const plugin = await loadPlugin()
  const { ctx, commands } = makeContext()
  plugin.apply(ctx)
  assert.deepEqual(commands[0].resolve({ ...pageContext, modal: 'settings' }), { status: 'pass' })
})

test('declines inside a terminal', async () => {
  const plugin = await loadPlugin()
  const { ctx, commands } = makeContext()
  plugin.apply(ctx)
  assert.deepEqual(commands[0].resolve({ ...pageContext, region: 'terminal' }), { status: 'pass' })
})

test('declines while a global main panel replaces the conversation', async () => {
  const plugin = await loadPlugin()
  const { ctx, commands } = makeContext({ panel: 'settings' })
  plugin.apply(ctx)
  assert.deepEqual(commands[0].resolve(pageContext), { status: 'pass' })
})

test('handles the conversation panel when the layout service is present', async () => {
  const plugin = await loadPlugin()
  const { ctx, commands } = makeContext({ panel: null })
  plugin.apply(ctx)
  assert.equal(commands[0].resolve(pageContext).status, 'handled')
})

test('declines without a retained session', async () => {
  const plugin = await loadPlugin()
  const { ctx, commands } = makeContext({ binding: { key: undefined } })
  plugin.apply(ctx)
  assert.deepEqual(commands[0].resolve(pageContext), { status: 'pass' })
})

test('declines when the session input cannot be resolved', async () => {
  const plugin = await loadPlugin()
  const { ctx, commands } = makeContext({
    forInput: () => {
      throw new Error('session generation ended')
    },
  })
  plugin.apply(ctx)
  const original = console.error
  console.error = () => {}
  try {
    assert.deepEqual(commands[0].resolve(pageContext), { status: 'pass' })
  } finally {
    console.error = original
  }
})

test('a failing focus does not escape the shortcut dispatch', async () => {
  const plugin = await loadPlugin()
  const { ctx, commands } = makeContext({
    focus: () => {
      throw new Error('editor disposed')
    },
  })
  plugin.apply(ctx)
  const resolution = commands[0].resolve(pageContext)
  assert.equal(resolution.status, 'handled')
  const original = console.error
  console.error = () => {}
  try {
    assert.doesNotThrow(() => resolution.run())
  } finally {
    console.error = original
  }
})
