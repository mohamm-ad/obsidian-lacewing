# Architecture

Window Overlay keeps Obsidian, persistence, and native Electron concerns in
separate layers so unsupported native behavior cannot prevent plugin loading
or unloading.

## Window discovery

`ObsidianWindowSource` groups every leaf returned by `iterateAllLeaves()` by
its `WorkspaceContainer`. The root split becomes the stable `main` target;
each `WorkspaceWindow` receives a session runtime ID. The source is refreshed
for initial layout, window open/close, layout change, and active-leaf events.

`WindowRegistry` owns the live target set. It classifies persistence identity,
resolves native windows, exposes UI descriptors, and disposes controllers when
windows close. Two pop-outs containing the same single note are downgraded to
session-only to avoid preference collisions.

## Native boundary

`ElectronWindowAdapter` is the only module that resolves Electron
`BrowserWindow` objects. It obtains `@electron/remote` through the renderer's
guarded `window.require`, resolves the main window directly, and matches a
pop-out with a temporary DOM marker and a bounded retry loop.

`NativeWindowController` snapshots native opacity and always-on-top state,
clamps every managed opacity, uses `floating` for pinning, and reapplies desired
state after native focus/show/restore and DOM focus/visibility events. Disposal
removes every listener and restores the snapshot. Resolution that completes
after registry disposal is ignored.

No Electron object or type crosses into the UI or persistence modules.

## Persistence

`PreferenceStore` validates schema version 1 data at load time and serializes
immutable snapshots through a short debounce. The main window is stored under
`main`; unambiguous single-note pop-outs are stored by vault-relative note
path. File and folder rename/delete events migrate or remove affected entries.

The 50% floor is enforced while loading, changing, serializing, and applying a
preference. Session-only targets can be controlled but never enter saved data.

## UI and commands

The manager modal uses Obsidian `Modal`, `Setting`, slider, toggle, and button
components with theme variables and keyboard-native controls. Plugin settings
use Obsidian 1.13's declarative, searchable settings definitions.

Active-window commands select targets by Obsidian's `activeWindow` DOM object.
The command service has no Electron dependency and is unit-tested separately.
The overlay session tracker prevents duplicate plugin-created overlays without
changing normal pop-out or macOS Space behavior.
