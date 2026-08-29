# Architecture

Lacewing keeps Obsidian, persistence, and native Electron concerns in
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
clamps every managed opacity, uses `floating` for pinning, and delegates
active/idle behavior to a platform-independent Smart Fade state machine.
Keyboard navigation, pointer input, and document scrolling reset its idle
timer. Independent inactivity and focus-loss flags produce the three supported
trigger modes. Focus, blur, show, restore, and visibility events reapply the
correct current state. A separate `OpacityTransition` engine interpolates
native opacity with an interruptible ease-out curve. Reduced-motion matching,
show/restore correction, emergency recovery, and unload can bypass animation.
Disposal cancels both timers, removes every listener, and restores the
snapshot. Resolution that completes after registry disposal is ignored.

No Electron object or type crosses into the UI or persistence modules.

## Contrast shield boundary

Each live target owns a `ContrastShieldController` for its renderer document,
independently of native-window resolution. The controller writes one
plugin-owned data marker to the document root. Theme-aware CSS reads that
marker and changes only the backing color of Markdown source, Live Preview,
and Reading view surfaces; it never changes content opacity, sidebars, or
window chrome. The controller snapshots any pre-existing marker and restores
it exactly on target disposal or plugin unload.

## Persistence

`PreferenceStore` validates schema version 5 data at load time, safely migrates
versions 1–4 without changing their visible behavior, and serializes
immutable snapshots through a short debounce. Global Smart Fade and Contrast
Shield defaults are merged with optional target overrides. The main window is
stored under `main`; unambiguous single-note pop-outs are stored by
vault-relative note path. File and folder rename/delete events migrate or
remove affected entries.

The 50% floor is enforced while loading, changing, serializing, and applying a
preference. Session-only targets can be controlled but never enter saved data.

## UI and commands

The manager modal uses Obsidian `Modal`, `Setting`, slider, toggle, dropdown,
and button components with theme variables and keyboard-native controls. Smart
Fade uses progressive disclosure and exposes live active/idle state. Contrast
Shield uses a compact dropdown with explicit inheritance and a live level
badge. A shared hotkey-hint formatter renders the recommended shortcut
definitions as compact macOS glyphs with screen-reader labels. Commands
intentionally register without default hotkeys to avoid conflicts in community
vaults. Plugin settings use Obsidian 1.13's declarative, searchable settings
definitions and hide dependent controls until they are relevant.

Active-window commands select targets by Obsidian's `activeWindow` DOM object.
The command service has no Electron dependency and is unit-tested separately.
The overlay session tracker prevents duplicate plugin-created overlays without
changing normal pop-out or macOS Space behavior.
