# Window Overlay

Window Overlay is a desktop-only Obsidian plugin that controls whole-window
opacity and always-on-top state independently for the main vault window and
each pop-out. It is designed for macOS note-taking workflows such as placing a
lightly translucent note above a video call.

The plugin targets Obsidian 1.13 or newer and Electron 39. It does not alter
Obsidian's built-in translucency option, themes, traffic lights, window chrome,
or macOS Space behavior.

## Features

- Manage the current vault's main window and every pop-out from one modal.
- Set opacity from 50% to 100% and pin any supported window at macOS's normal
  floating level.
- Open the active Markdown note in a new 85%-opacity pinned pop-out while
  leaving the original tab in place.
- Focus an existing plugin-created overlay for the same note instead of
  opening a duplicate.
- Persist the main-window preference for the vault and single-note pop-out
  preferences by vault-relative path.
- Optionally keep a window at a readable active opacity, then fade it after a
  configurable idle delay or as soon as focus moves elsewhere.
- Configure Smart Fade globally, then override its behavior for the main
  window or any individual pop-out.
- Reapply managed state after focus, show, restore, and visibility events.
- Restore original native window state when the plugin unloads.

Mixed-tab, duplicate-note, and non-note pop-outs remain controllable for the
current session, but they are deliberately not restored after restart because
their identities are ambiguous.

## Commands

Open the manager from the picture-in-picture icon in Obsidian's left ribbon,
from **Settings → Window Overlay → Open manager**, or from the Command Palette.

Default macOS hotkeys use a dedicated Command–Option–Shift family:

| Command | Default hotkey |
| --- | --- |
| Open window manager | `⌘⌥⇧O` |
| Open current note as overlay | `⌘⌥⇧N` |
| Increase active-window opacity | `⌘⌥⇧]` |
| Decrease active-window opacity | `⌘⌥⇧[` |
| Toggle active-window pinning | `⌘⌥⇧P` |
| Restore active window to 100% | `⌘⌥⇧0` |
| Restore every managed overlay | `⌘⌥⇧R` |

These do not overlap the primary development vault's existing custom hotkeys.
Change or remove them under **Settings → Hotkeys** by searching for “Window
Overlay.”

## Smart Fade

Open **Settings → Window Overlay → Smart fade** to enable the behavior and set
the active opacity, idle opacity, fade trigger, delay, and activity controls.
Existing users remain on fixed opacity until they enable it.

The fade trigger offers three modes:

- **Inactivity and focus loss** fades after the idle delay or immediately when
  focus moves elsewhere. This is the default and preserves earlier behavior.
- **Focus loss only** keeps a focused window bright indefinitely, which is
  useful for reading, then fades when you switch back to another app.
- **Inactivity only** uses the idle timer but does not fade immediately when
  focus moves elsewhere.

Typing, arrow and paging keys, clicks, and scrolling with a mouse, trackpad, or
scrollbar can all reset the inactivity timer when their activity controls are
enabled.

In the Window Manager, expand **Smart fade** on any window to inherit the
global setting or customize that window. The live badge shows whether the
window is Active or Idle. **Use global settings** removes only the Smart Fade
overrides; it does not discard that window's fixed opacity or pin preference.

While Smart Fade is enabled, the increase/decrease opacity hotkeys adjust the
active opacity for the current window. **Restore active window to 100%** is a
recovery action: it disables Smart Fade for that window and restores full
opacity. **Restore every managed overlay** disables Smart Fade globally and
returns all managed windows to 100% and unpinned.

## Safety model

- Opacity is clamped to 50–100% at every input and persistence boundary.
- Smart Fade timers are cancelled when settings change, a window closes, or
  the plugin unloads.
- The plugin snapshots opacity and pin state before adopting a native window.
- Disabling or reloading the plugin restores those original values.
- Electron access is isolated in a guarded adapter that resolves
  `@electron/remote`; the removed `electron.remote` API is never used.
- Unsupported native operations are contained and surfaced in the manager or
  an Obsidian notice.
- Pinning uses `floating` only. All-Spaces, click-through, vibrancy,
  above-full-screen behavior, and screen-capture exclusion are out of scope.

## Local development

Requirements: Node.js 20 or 22 and pnpm 9.6.0.

```sh
pnpm install --frozen-lockfile
pnpm check
```

For real-vault development, create an ignored `.env.local`:

```dotenv
OBSIDIAN_VAULT_PATH=/absolute/path/to/vault
```

Then run:

```sh
pnpm dev:install
```

The installer copies only `main.js`, `manifest.json`, and `styles.css` to
`.obsidian/plugins/window-overlay`. It never copies source files or
`node_modules` into the vault.

Useful scripts:

- `pnpm lint` — run the Obsidian ESLint rules.
- `pnpm typecheck` — type-check without emitting files.
- `pnpm test` — run the Vitest suite.
- `pnpm build` — produce a minified `main.js`.
- `pnpm check` — run lint, type-checking, tests, and a production build.
- `pnpm dev` — watch and rebuild during development.
- `pnpm dev:install` — build and install the three runtime artifacts.
- `pnpm release:check` — run every check and validate release artifacts.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for design boundaries and
[docs/TESTING.md](docs/TESTING.md) for the acceptance checklist.

## License

MIT
