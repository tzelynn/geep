# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

geep is a macOS menu-bar Electron app that escalates from cute reminders to a full screen
takeover as bedtime approaches. `specs/vision.md` is the product brief and the source of the
45/30/20/10-minute stage timings, the "cute aggression" tone, and the
"never-let-them-guess-your-next-move" unpredictability. `README.md` documents the user-facing side.

## Commands

```bash
npm start                # run from source against the real schedule
npm run demo             # launch straight into a fast-forwarded evening
npm run dist             # build release/mac-arm64/geep.app (unsigned, identity: null)
npm run icons            # regenerate assets/*.png + build/icon.png from scripts/make-icons.js
```

There is no test framework, linter, or bundler. Verification is manual — see Testing below.

## Architecture

**One clock, one state object.** `src/main/engine.js` ticks once a second and emits a `state`
object. `src/main/index.js` fans it out to three consumers: `WindowManager.apply()`, the audio
handler, and the tray title. Renderers receive the same object over `geep:state`. Everything is a
reaction to `state.phase` — add behaviour by deriving it from a phase, not by starting a new timer.

**Phases.** `phaseFor()` maps minutes-to-bedtime onto the raw stages
`idle → prep → persist → disrupt → peak` using the `*Lead` options. `tick()` then layers
overrides on top:

| phase | meaning |
| --- | --- |
| `quiet` | prep stage, but snoozed, already done, or between nudge bursts — nothing on screen |
| `prepdone` | a 5s pill acknowledging *prep done* (`DONE_ACK_MS`), then straight to `quiet` |
| `goodnight` | user pressed *goodnight* during disrupt/peak — calm screen, still covering |
| `off` | no bedtime scheduled, or tonight was called off (`state.calledOff` distinguishes them) |

`progress` is 0→1 *within the current raw stage*; `ramp` is 0→1 across the whole 45→10 runway.
Visuals ramp off these two rather than off raw minutes.

**Session.** Mutable per-bedtime state (`prepDone`, `snoozeUntil`, `goodnight`, `abandoned`, plus
`beatOffset`/`beatCycle` which randomise the nudge rhythm each night). It resets automatically
whenever the resolved target bedtime changes, and is never persisted.

**Virtual clock.** Phase logic reads `engine.now()`, never `Date.now()`. Demo mode ("test drive")
swaps in an accelerated clock and a synthetic target, which is why the whole escalation can be
replayed in seconds. Preserve that indirection in any new time-dependent code.

**Schedule maths** (`src/main/schedule.js`, pure functions):
- A time before **04:00 belongs to the previous day's night** — `00:30` under "friday" is
  saturday 00:30. `bedtimeFor()` owns this rule.
- Exceptions are keyed by `YYYY-MM-DD`, override the weekly entry for that night, and
  `enabled: false` skips that night without touching the weekly schedule.
- `nextTarget()` scans day offsets −2…+8 and discards targets more than `giveUpAfter` minutes old,
  which is how geep stops nagging and rolls over to tomorrow.

**Window choreography** (`src/main/windows.js`). `NUDGE_SHOWN` / `OVERLAY_SHOWN` decide which
windows exist for a phase. One transparent overlay per display, at `screen-saver` level with
`visibleOnFullScreen`, so the takeover covers the menu bar and fullscreen apps; `syncOverlays()`
rebuilds them on display add/remove. **Click blocking is decided in main**, not the renderer:
`updateBlocking()` toggles `setIgnoreMouseEvents` and puts a `blocking` flag into the state payload
the renderers get. (`setClickBlocking` in the preload is a leftover hook and currently unused.)
The sticky panel's size and its wandering are also driven from main via `setBounds`.

**Renderers** (`src/renderer/*`). Plain HTML/CSS/JS loaded over `file://` — classic `<script>` tags
exposing globals (`window.GEEP_CAST`, `window.GEEP_COPY`), never ES modules. They are stateless
projections of `state`: the overlay sets `body.phase-<name>` plus `body.blocking` and lets CSS do
the rest. The only channel to main is `window.geep` from `src/preload/api.js`.

**Characters and copy.** `src/renderer/shared/characters.js` generates the six placeholder blobs; a
single `render(char, mood)` is the swap point for the real SVGs that are coming later. `pick(dayStamp)`
hashes the date so each night gets a different character. Moods are `sweet | sleepy | stern | feral | shock`.
`copy.js` keys `LINES` by phase name — a new phase needs a matching `LINES` entry or it falls back.

**macOS side effects** (`src/main/system.js`). Muting goes through `osascript` and only unmutes if
geep was the one that muted (`weMuted`); `will-quit` and the panic path both unmute. Screen-off uses
`pmset displaysleepnow`. Any new system-level aggression must be reversible on quit the same way.

## Invariants worth keeping

- **Always leave an escape hatch that works while clicks are blocked.** Today: the global
  `⌘⌥⇧G` panic shortcut, the 1.5s hold-to-quit button, the tray menu, and ⌘Q.
- Quitting the app is the intended nuclear option per the vision doc — don't make it harder.
- Marking prep done skips only the sticky `persist` stage. The `disrupt` and `peak` log-off stages
  are unconditional.

## Testing and visual QA

No automated tests. Useful techniques:

- **Stage jumping:** `GEEP_DEMO=1 GEEP_DEMO_FROM=20 GEEP_DEMO_SPEED=8 npm start` starts the virtual
  clock at 20 minutes to bedtime running 8×. `GEEP_DEBUG=1` logs every phase transition plus overlay
  and nudge window bounds/visibility, and forwards renderer console output to the terminal.
- **Don't casually run to `peak` on a real machine** — it seizes every display and mutes audio.
  Keep smoke runs above `peakLead`, or kill the process on a timer and unmute afterwards.
- **Pure logic in plain node:** `config.js` (and therefore `schedule.js`) requires `electron` only for
  `app.getPath`. Stub it to test the maths without launching a window:
  ```js
  const Module = require('module'); const orig = Module._load
  Module._load = (r, p, i) => r === 'electron' ? { app: { getPath: () => '/tmp' } } : orig(r, p, i)
  ```
- **Renderer visuals:** `screencapture` has no Screen Recording permission here. Instead drive an
  offscreen `BrowserWindow` (`webPreferences.offscreen`) with the real preload, push a fake state over
  `geep:state`, and `webContents.capturePage()`. Reuse a single window across shots — creating and
  destroying one per shot makes `loadFile` fail with `ERR_FAILED`.
- CSS gotcha: keyframe animations override inline styles. When JS and an animation both touch a
  property, drive it through a CSS custom property (see `--vis` on the overlay vignette).

## Environment notes

- Runtime config lives at `~/Library/Application Support/geep/config.json`; defaults and the
  `deepMerge` patch semantics are in `src/main/config.js`. `saveConfig` takes partial patches;
  exceptions are replaced wholesale via `setExceptions`.
- If `npm install` leaves `node_modules/electron/dist` containing only `LICENSES.chromium.html`, the
  postinstall could not read `~/Library/Caches`. Recover with a project-local cache:
  ```bash
  electron_config_cache="$PWD/.electron-cache" node node_modules/electron/install.js
  unzip -q -o .electron-cache/*/electron-v*-darwin-arm64.zip -d node_modules/electron/dist
  printf 'Electron.app/Contents/MacOS/Electron' > node_modules/electron/path.txt
  ```
  and build with `ELECTRON_CACHE="$PWD/.electron-cache" npm run dist`.
