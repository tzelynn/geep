# geep

a cute desktop gremlin that nags you into bed, and gets less cute the longer you ignore it.

macOS menu-bar app (Electron). This is the **MVP** — the shape of the thing, meant to be
installed and lived with for a few nights before we refine it.

## install

```bash
npm install          # pulls electron
npm run dist         # builds release/mac-arm64/geep.app
open release/mac-arm64  # then drag geep.app into /Applications
```

The build is unsigned, so the first launch needs a right-click → **Open** (or
System Settings → Privacy & Security → *Open Anyway*).

Or just run it from source while you're poking at it:

```bash
npm start            # normal run, follows your real schedule
npm run demo         # starts a fast-forwarded evening immediately
```

## how the evening goes

| when | what geep does |
| --- | --- |
| T‑45m | a small card visits the corner every few minutes: brush teeth, fill water bottle, etc. **done ✓** or **5 more mins** |
| T‑30m | if prep isn't marked done, the card becomes sticky — no snooze, it grows, wobbles and starts wandering around the screen |
| T‑20m | screen disruption: a pink glow creeps in from the edges, characters drift across, a nag card hops around, audio gets muted, and clicks get swallowed in bursts that grow longer and more frequent |
| T‑10m | full takeover on **every** display, above fullscreen apps and the menu bar. Clicks are gone, audio stays muted, a countdown runs past zero. The only ways out are *okay, goodnight* or quitting geep |

Marking prep done skips the T‑30m sticky stage. It does **not** skip the log-off
stages — those are unconditional.

## escape hatches

- **⌘G** — calls off tonight entirely (global, works during the takeover)
- **hold to quit geep** — 1.5s hold button on the takeover screen
- tray menu → *Call it off for tonight* / *Quit geep*
- ⌘Q also still works

## testing it without waiting for midnight

Tray icon → **Test drive**, or the same buttons in settings:

- *full run* — the whole 45 minutes compressed into ~90 seconds
- *sticky panel* / *disruption* / *peak takeover* — drop straight into one stage
- *stop test* — back to the real schedule

`npm run demo` does the full run at launch. `GEEP_DEMO_FROM=20 GEEP_DEMO_SPEED=8 npm run demo`
starts wherever you like.

## schedule

Set a bedtime per weekday in settings (tray → *Settings & schedule…*). Times before
04:00 belong to the night before — 00:30 on friday means friday night, not friday morning.

Exceptions are one-off overrides for a specific date: give it a different time, or
switch it off to skip that night. The weekly schedule underneath stays untouched.

Config lives at `~/Library/Application Support/geep/config.json`.

## characters

Six placeholder blobs (Mochi, Nubbin, Tofu, Plum, Cloudy, Jelly) in
`src/renderer/shared/characters.js`. One is picked per night from the date, so each
evening has a different face; moods (`sweet`, `sleepy`, `stern`, `feral`, `shock`)
track how annoyed geep is.

They're placeholders. To swap in real art, replace `render(char, mood)` with your SVGs —
everything else reads from that one function.

## layout

```
src/main/       config · schedule maths · phase engine · window choreography · macOS bits
src/preload/    the small bridge the renderers see as window.geep
src/renderer/   nudge card · fullscreen overlay · settings
  shared/       characters, copy bank, theme
scripts/        icon generator (no image deps, writes PNGs directly)
```

The phase engine (`src/main/engine.js`) is the heart: it turns "minutes until bedtime"
into a phase, and everything else just reacts to that.

## known rough edges (MVP)

- placeholder art, placeholder copy
- muting uses the system volume; it unmutes when geep stops or you quit
- *turn the screen off* uses `pmset displaysleepnow`
- no stats/streaks yet, no sounds yet
