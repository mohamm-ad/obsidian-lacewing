# Lacewing — Window Transparency for Obsidian

Keep your notes in view without losing sight of what is behind them.

Lacewing Window Transparency is a macOS-first Obsidian plugin for making the
main vault window or any pop-out translucent and keeping selected windows above
other apps. It adds per-window controls, reading-aware Smart Fade, a Contrast
Shield, and a quick way to open the current note as an overlay.

Lacewing is useful when you want to:

- take notes over a video call without constantly switching windows;
- keep a checklist or reference note above another app;
- read from a translucent note while retaining context behind it; or
- give different Obsidian pop-outs their own opacity and pinning behavior.

## Requirements

- macOS
- Obsidian Desktop 1.13.0 or newer

Lacewing is desktop-only because it uses guarded Electron window APIs. Windows,
Linux, and Obsidian Mobile are not currently supported.

## Installation

### From Community Plugins

After Lacewing is listed in the Community Plugins directory:

1. Open **Settings → Community plugins** in Obsidian.
2. Select **Browse** and search for **Lacewing Window Transparency**.
3. Select **Install**, then **Enable**.

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the
   [latest GitHub release](https://github.com/mohamm-ad/obsidian-lacewing/releases/latest).
2. Put the three files in `<your-vault>/.obsidian/plugins/lacewing/`.
3. Reload Obsidian.
4. Enable **Lacewing Window Transparency** under **Settings → Community
   plugins**.

## Quick start

1. Open the Window Manager from the picture-in-picture icon in the left ribbon,
   **Settings → Lacewing Window Transparency → Open manager**, or the Command
   Palette command **Open window manager**.
2. Find the main window or pop-out you want to change.
3. Set **Fixed opacity**. Values are limited to a safe range of 50–100%.
4. Turn on **Always on top** if the window should remain above other apps.
5. Optionally choose a **Contrast shield** or expand **Smart fade** for that
   window.

Changes apply immediately. The main window and every pop-out are controlled
independently.

### Open a note as an overlay

Run **Open current note as overlay** from the Command Palette. Lacewing copies
the active Markdown note into a new single-note pop-out without moving the
original tab. The pop-out starts at 85% opacity by default and is pinned using
macOS's normal floating level.

Running the command again for the same note focuses the existing Lacewing
overlay instead of opening a duplicate. Change the starting opacity under
**Settings → Lacewing Window Transparency → Overlay defaults**.

## Window Manager

Each card represents one Obsidian window and shows whether it is the main
window or a pop-out, focused, pinned, and using Smart Fade or a Contrast Shield.

Controls for an unambiguous target are saved automatically:

- the current vault's main window is saved under a stable main-window key;
- a pop-out containing one unique Markdown note is saved by that note's
  vault-relative path; and
- mixed-tab, duplicate-note, and non-note pop-outs remain session-only because
  they cannot be restored unambiguously.

Saved note preferences follow file and folder renames and are removed after
deletion.

## Smart Fade

Smart Fade switches a window between a readable active opacity and a more
transparent idle opacity. Enable and configure the global default under
**Settings → Lacewing Window Transparency → Smart fade**. Expand **Smart fade**
on any Window Manager card to inherit the global behavior or override it for
that window.

Three triggers are available:

- **Inactivity and focus loss** fades after the idle delay or immediately when
  another app receives focus.
- **Focus loss only** keeps a focused window readable indefinitely. This is the
  best choice when you often read without typing or scrolling.
- **Inactivity only** uses the idle timer without fading immediately when focus
  moves elsewhere.

Typing, navigation keys such as arrows and Page Up or Down, clicks, and mouse,
trackpad, or scrollbar scrolling can all count as reading activity. These
activity types can be enabled independently.

Opacity changes can be instant or smoothly animated from 0–500 ms. Lacewing
can also honor the macOS **Reduce Motion** accessibility setting.

## Contrast Shield

Whole-window opacity affects text as well as the window background. Contrast
Shield adds a theme-aware backing surface behind Markdown content to improve
separation from a busy call or video behind the note.

Choose **None**, **Subtle**, **Medium**, or **Strong** globally under
**Settings → Lacewing Window Transparency → Readability**, then override the
level on individual windows in the Window Manager.

Contrast Shield affects Markdown source, Live Preview, and Reading view. It
does not alter your theme, links, selection, embeds, sidebars, window chrome,
or Obsidian's built-in translucency setting.

## Commands and suggested shortcuts

Lacewing does not claim hotkeys automatically. To assign one, open **Settings →
Hotkeys**, search for **Lacewing Window Transparency**, select the plus button
beside a command, and press the shortcut you want.

The following macOS suggestions use one memorable Command–Option–Shift family.
They also appear beside the relevant actions in Lacewing settings and the
Window Manager.

| Command | Suggested shortcut |
| --- | --- |
| Open window manager | `⌘⌥⇧O` |
| Open current note as overlay | `⌘⌥⇧N` |
| Increase active-window opacity | `⌘⌥⇧]` |
| Decrease active-window opacity | `⌘⌥⇧[` |
| Toggle active-window pinning | `⌘⌥⇧P` |
| Restore active window to 100% | `⌘⌥⇧0` |
| Restore every managed overlay | `⌘⌥⇧R` |

The opacity commands change fixed opacity when Smart Fade is off. When Smart
Fade is on, they change the active opacity for the current window.

## Recovery and safety

- Opacity is clamped to 50–100% at every input and persistence boundary.
- **Restore active window to 100%** disables Smart Fade for that window and
  restores full opacity.
- **Restore every managed overlay** disables Smart Fade and Contrast Shield,
  restores every open managed window to 100%, and turns off pinning.
- Lacewing snapshots a window's native opacity and always-on-top state before
  managing it, then restores that state when the plugin unloads.
- Unsupported native operations are contained and reported without preventing
  the plugin from loading or unloading.

## Limitations

- Always-on-top uses macOS's normal floating level. It does not place a window
  above full-screen apps or move it to every Space.
- Click-through, vibrancy, capture exclusion, and custom window chrome are not
  supported.
- Lacewing does not modify Obsidian's built-in translucency setting.
- Only unambiguous main-window and single-note preferences persist across
  restarts.

## Privacy

Lacewing has no analytics, accounts, network requests, or remote services. It
stores settings locally in the vault's plugin data and never reads note
contents beyond the file identity Obsidian exposes for window tracking.

## Troubleshooting

### A window does not change

Confirm that you are using Obsidian Desktop on macOS and Obsidian 1.13.0 or
newer. Reload Obsidian after installation. If a card says native controls are
unavailable, restart Obsidian and try again.

### Text is difficult to read

Raise the window opacity or enable **Contrast shield**. For calls and videos, a
good starting point is 85–90% active opacity, 60–70% idle opacity, and a Subtle
or Medium shield.

### A window feels stuck above other apps

Turn off **Always on top** for that window or run **Restore every managed
overlay**. Disabling Lacewing also restores the native window state captured
when it loaded.

### A pop-out preference was not restored

Only a pop-out containing one unique Markdown note has a persistent identity.
Mixed-tab, duplicate-note, and non-note pop-outs are labeled **Session only** in
the Window Manager.

## Development

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

Use a test vault when possible. `pnpm dev:install` overwrites Lacewing's
installed runtime files in the configured vault.

The installer copies only `main.js`, `manifest.json`, and `styles.css` to
`.obsidian/plugins/lacewing`. It never copies source files or `node_modules`
into the vault.

Useful scripts:

- `pnpm lint` — run the Obsidian ESLint rules.
- `pnpm typecheck` — type-check without emitting files.
- `pnpm test` — run the Vitest suite.
- `pnpm build` — produce a minified `main.js`.
- `pnpm check` — run lint, type-checking, tests, and a production build.
- `pnpm dev` — watch and rebuild during development.
- `pnpm dev:install` — build and install the three runtime artifacts.
- `pnpm release:check` — run every check and validate release artifacts.

See [Architecture](docs/ARCHITECTURE.md), [Testing](docs/TESTING.md), and
[Releasing](docs/RELEASING.md) for contributor documentation.

## Contributing

Contributions are welcome. For substantial changes, please open an issue first
so the approach can be discussed.

By submitting a contribution, you confirm that you have the right to contribute
it and agree that it will be licensed under the MIT License.

## License

Lacewing is available under the [MIT License](LICENSE). You may use, modify,
redistribute, sublicense, and sell copies, including for commercial purposes,
provided that the copyright and license notices are retained.

Lacewing is an independent community plugin and is not affiliated with or
endorsed by Obsidian.
