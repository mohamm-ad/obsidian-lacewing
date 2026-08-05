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
- Smart Fade migration, clamping, active/idle timing, activity triggers,
  all three fade-trigger modes, reading navigation and scrolling, focus/blur
  behavior, timer replacement, per-window overrides, session-only behavior,
  pin preservation, and unload restoration
- transition clamping, easing, interruption, reduced-motion behavior,
  per-window duration overrides, native show/restore correction, asynchronous
  Electron failures, and unload cancellation
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
10. Enable **Smart fade** in plugin settings. Set active opacity to 90%, idle
    opacity to 60%, and delay to 1.25 seconds. Confirm the focused window fades
    after the delay and brightens immediately when typing or clicking.
11. Switch repeatedly between Obsidian and another app. Confirm fade-on-blur
    moves directly to idle opacity and preserves pinning.
12. Give the main window and two single-note pop-outs different Smart Fade
    values. Close and reopen a single-note pop-out and confirm its values
    return. Confirm a mixed pop-out remains session-only.
13. Run the active-window restore command while Smart Fade is on. Confirm that
    window returns to 100% and Smart Fade is off for it. Run global restore and
    confirm Smart Fade is disabled globally.
14. Select **Focus loss only** and leave the Obsidian window focused without
    interacting past the idle delay. Confirm it remains at active opacity, then
    switches to idle opacity when another app receives focus.
15. Select a trigger that includes inactivity. Confirm arrow keys, Page Up or
    Down, space, mouse or trackpad scrolling, and dragging the scrollbar reset
    the idle timer when their corresponding activity controls are enabled.
16. Set transition duration to 180 ms and repeatedly alternate between active
    and idle states. Confirm each change feels smooth and reverses immediately
    when activity resumes rather than completing the obsolete transition.
17. Set transition duration to 0 ms and confirm opacity changes instantly.
    Enable macOS Reduce Motion and confirm **Respect reduced motion** also makes
    a nonzero transition instant.
18. Give two pop-outs different transition durations and confirm they behave
    independently and return after reopening persistent single-note pop-outs.
19. Trigger restore commands and disable the plugin during a transition.
    Confirm recovery is immediate and no delayed animation changes the restored
    opacity afterward.

The plugin intentionally does not test or support all-Spaces, click-through,
above-full-screen overlays, vibrancy, or capture exclusion.
