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
- macOS recommended-shortcut glyph and accessible-label formatting
- uniqueness of the default pause shortcut among the suggested hotkeys
- overlay duplicate tracking
- Smart Fade migration, clamping, active/idle timing, activity triggers,
  all three fade-trigger modes, reading navigation and scrolling, focus/blur
  behavior, timer replacement, per-window overrides, session-only behavior,
  pin preservation, and unload restoration
- transition clamping, easing, interruption, reduced-motion behavior,
  per-window duration overrides, native show/restore correction, asynchronous
  Electron failures, and unload cancellation
- Contrast Shield schema migration, malformed-value rejection, global and
  per-window resolution, renderer-marker lifecycle, exact unload restoration,
  Markdown-only style scope, light/dark theme variants, and the absence of
  content opacity rules
- production bundling and manifest/version consistency
- external Obsidian and Electron runtimes are not embedded in `main.js`

## Real-vault smoke test

Install into a development vault with `pnpm dev:install`, enable **Lacewing
Window Transparency** in Community plugins, and reload Obsidian before testing.

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
10. Enable **Global smart fade** in plugin settings and select **Inactivity and
    focus loss**. Set active opacity to 90%, idle
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
20. Set the global Contrast Shield to each level in turn. Confirm changes
    preview immediately in the main window and inheriting pop-outs, while
    **None** removes the backing surface.
21. In both a light and dark theme, test **Subtle**, **Medium**, and **Strong**
    in source mode, Live Preview, and Reading view. Confirm each step improves
    separation from content behind the translucent window.
22. Check links, text selection, embeds, images, callouts, tables, inline code,
    fenced code blocks, and scrolling. Confirm they remain usable and that
    sidebars and window chrome do not receive the shield.
23. Give the main window and two single-note pop-outs different shield levels.
    Close and reopen one pop-out and confirm its level returns. Confirm a mixed
    pop-out is labeled session-only and does not persist after restart.
24. Disable or reload the plugin while shields are visible. Confirm every
    shield disappears completely; re-enable it and confirm persistent choices
    return. Run global restore and confirm its default becomes **None**.
25. Open plugin settings and confirm quick actions, overlay defaults, Smart
    Fade, readability, active-window shortcuts, and recovery are visually
    distinct. Turn Smart Fade off and on; confirm its detail controls stay
    visible and the page retains its scroll position and keyboard focus.
26. Switch the fade trigger between focus-loss-only and an inactivity mode.
    Confirm idle-delay and activity controls remain visible but are disabled
    for focus-loss-only mode, without scrolling or losing keyboard focus.
27. Confirm each command's suggested macOS shortcut is visible beside the
    relevant settings action. Only pause/resume has a default shortcut. Open
    the Window Manager and confirm its effective-opacity, pinned, and focused
    badges plus its per-control shortcut hints are readable in both light and
    dark themes without adding emphasis around the full card.

28. Hover over the ribbon icon and confirm the tooltip includes **Lacewing**.
29. With multiple cards open in the manager, expand Smart Fade, scroll down,
    and allow an inactivity fade. Resume activity and change a control.
    Confirm only status labels change during fades, controls stay usable,
    and the scroll position remains stable. Collapse a section with custom
    overrides and confirm it stays collapsed after focus or settings changes.
30. Toggle **Global smart fade** at the top of the manager. Confirm inheriting
    windows follow it while explicit on/off overrides remain unchanged. Check
    that each **Use global (On/Off)** label reflects the current global state.
31. In global settings, set active opacity to 90% and idle opacity to 80%.
    Lower active opacity to 70%; confirm both sliders display 70%, and idle
    cannot exceed active. Increase active to 90%; confirm idle stays at 70%
    and can now be raised to 90%. Repeat using keyboard controls and reopen
    settings to confirm displayed values match persisted values.
32. In a fresh development vault, confirm Smart Fade starts off, the trigger
    is **Focus loss only**, and selecting an inactivity trigger reveals an
    enabled idle delay of **5 s**. Upgrade a vault with existing custom Smart
    Fade settings and confirm its triggers, delays, and overrides are retained.

33. Configure fixed opacity, pinning, Smart Fade, and contrast shields across
    the main window and a session-only pop-out. Click **Pause Lacewing** at
    the top of the manager. Confirm every window becomes fully opaque and
    unpinned, shields disappear, and badges show paused state. Switch apps,
    scroll, type, and wait past the idle delay; all effects should stay paused.
34. While paused, open another pop-out and edit an existing window’s settings.
    Confirm effects remain paused. Click **Resume Lacewing** and confirm each
    window uses its latest settings, including session-only preferences.
35. Run **Pause / resume all effects** from the Command Palette and with the
    default **⌘⌥⇧L** hotkey. Reassign or remove it in Hotkeys settings and
    confirm the customization takes effect. Confirm the manager’s button and status follow the change.
    Confirm the ribbon changes to a pause icon with a paused tooltip, then
    returns to its normal icon and on-state tooltip after resuming. Reload the
    plugin while paused and confirm it resumes saved settings.

The plugin intentionally does not test or support all-Spaces, click-through,
above-full-screen overlays, vibrancy, or capture exclusion.
