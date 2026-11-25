# dsh-plugin-composer-focus

Focus the chat composer from anywhere in the window with a keyboard shortcut.

## What it does

Registers one application command, **Focus message input**, in the client
shortcut service. On Desktop it ships bound to `Ctrl+I` (`Cmd+I` on macOS) and
appears in **Settings → Keyboard shortcuts** (`Mod+/`) as an editable row next
to the built-in commands.

Unlike a listener on the page, the command is delivered by the Desktop native
keyboard bridge, so it works while the composer is unfocused — including while
focus sits on the Conversation, the composer's own buttons, the sidebar, or an
embedded frame. The action returns the keyboard to the message input of the
session the main view shows and restores the caret the editor last held.

## Usage

Press `Ctrl+I` (`Cmd+I` on macOS). To change it, open **Settings → Keyboard
shortcuts**, find **Focus message input**, and record another combination.

The command deliberately declines, leaving the key to whatever already owns it:

- while a dialog or modal is open
- inside the embedded terminal, where `Ctrl+I` is Tab
- while a global main panel (Settings, Plugins, …) replaces the Conversation
- when no session is open, so no message input is mounted

## Limitations

- **Desktop default only.** The Web runtime admits only `Mod+Alt`, `Mod+Shift`
  and a few special combinations as command defaults, so the Web profile ships
  unbound; open the shortcut reference in a browser and record one there.
- **Shortcut only.** Typing with the composer unfocused does not yet move the
  keyboard into it; this plugin provides the explicit gesture.
- **Window scope.** The binding is intercepted only while the app window is
  focused, as with every other application command.

## Development

The package is linked into a dsh profile, so the profile reads this working
tree directly:

```sh
pnpm check                                     # from the repo root
pnpm test                                      # browser-half unit tests
```

Then install it once per profile: **Plugins > Add plugin** and give the
absolute path of this directory, or let an agent call `plugin_manager`
`install_bundle` with that path.

Edits to `src/client.js` reach the running page through the client HMR
transport, so no restart is needed. The Host row exists only to publish that
browser half and holds no runtime logic of its own — see
`docs/plugin-development-notes.md` in the repo for the development loop.
