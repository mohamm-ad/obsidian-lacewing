# Testing and acceptance

## Automated checks

Run the full release gate:

```sh
pnpm release:check
```

It verifies:

- Obsidian ESLint rules and TypeScript types
- opacity clamping, stable increments, and reset behavior
- settings validation, immutable serialization, debounce, and external reload
- note/folder rename, delete, and collision handling
- main, single-note, mixed, non-note, and duplicate-note classification
- delayed and unsupported native-window resolution
- focus reapplication, close cleanup, late-resolution disposal, and unload
  restoration
- manager view-model and active-window command targeting
- overlay duplicate tracking
- production bundling and manifest/version consistency
- external Obsidian and Electron runtimes are not embedded in `main.js`

## Real-vault smoke test

Install into a development vault with `pnpm dev:install`, enable **Window
Overlay** in Community plugins, and reload Obsidian before testing.

1. Open the window manager and set the main window to 80%. Confirm existing
   pop-outs do not change.
2. Open two different Markdown notes in separate pop-outs. Give them different
   opacity and pin values.
3. Switch repeatedly between Obsidian and another app. Confirm each managed
   window retains its selected opacity.
4. Close a single-note pop-out, reopen the same note in a pop-out, and confirm
   its saved preference returns.
5. Add a second tab to a pop-out and confirm the manager labels it session-only.
   Reload Obsidian and confirm that mixed pop-out does not receive a saved
   preference.
6. Run **Open current note as overlay**. Confirm a new single-note pop-out opens
   at the configured default (85% initially), is pinned, remains editable, and
   stays in the current macOS Space. Run the command again and confirm the
   existing overlay is focused.
7. Decrease opacity repeatedly and confirm it stops at 50%. Run the active and
   global restore commands and confirm lockout is impossible.
8. Disable or reload the plugin. Confirm all open windows remain usable and
   return to the opacity and pin state they had before the plugin adopted them.
9. Re-enable the plugin and confirm the main and single-note saved preferences
   return while mixed/non-note targets remain session-only.

The plugin intentionally does not test or support all-Spaces, click-through,
above-full-screen overlays, vibrancy, or capture exclusion.
