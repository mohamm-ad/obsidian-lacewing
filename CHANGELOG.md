# Changelog

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
