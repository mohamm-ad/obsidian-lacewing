# Changelog

## 1.0.2 — 2026-09-11

- Include Lacewing in the ribbon icon tooltip.
- Prevent Smart Fade state changes from rebuilding window manager controls,
  and preserve scroll position, keyboard focus, and expanded sections.
- Keep Smart Fade controls visible when changing modes; disable inactivity
  controls when they do not apply.
- Add a global Smart Fade toggle to the window manager and show the inherited
  on/off state in each window’s settings.
- Keep active and idle opacity sliders synchronized with saved values.
- Default new installations to focus loss only, with a 5-second delay when
  inactivity fading is selected. Preserve existing saved preferences.

## 1.0.1 — 2026-08-29

- Remove the redundant word "Obsidian" from the plugin description to meet
  Community Plugins directory requirements.
- Add release validation that prevents the restricted term from returning to
  the manifest description.

## 1.0.0 — 2026-08-28

The first public release of Lacewing Window Transparency.

- Control whole-window opacity and always-on-top state independently for the
  main vault window and every pop-out.
- Open the current Markdown note as a pinned, 85%-opacity overlay without
  moving the original tab or opening duplicates.
- Use reading-aware Smart Fade with focus-loss and inactivity triggers,
  configurable activity detection, and reduced-motion-aware transitions.
- Improve Markdown readability over busy backgrounds with a theme-aware
  Contrast Shield and per-window overrides.
- Persist the main window and unambiguous single-note pop-outs while clearly
  labeling mixed, duplicate-note, and non-note windows as session-only.
- Recover safely with a 50% opacity floor, active-window and global restore
  commands, guarded native operations, and exact unload restoration.
- Use recommended macOS shortcut hints without automatically claiming hotkeys
  in users' vaults.
- Keep all settings local with no analytics, accounts, or network services.
