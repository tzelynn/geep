'use strict'
const path = require('path')
const { app, ipcMain, Tray, Menu, nativeImage, globalShortcut, shell } = require('electron')
const { Config } = require('./config')
const { Engine } = require('./engine')
const { WindowManager } = require('./windows')
const system = require('./system')

let config, engine, windows, tray
let lastMute = 0

if (!app.requestSingleInstanceLock()) app.quit()

function trayImage () {
  const img = nativeImage.createFromPath(path.join(__dirname, '..', '..', 'assets', 'trayTemplate.png'))
  img.setTemplateImage(true)
  return img
}

function phaseBlurb (state) {
  const mins = Math.max(0, Math.round(state.minutesLeft ?? 0))
  switch (state.phase) {
    case 'off': return state.calledOff ? `called off · back tomorrow` : 'no bedtime set'
    case 'idle': return `bedtime ${state.targetLabel} · ${mins}m to go`
    case 'quiet': return `snoozed · bedtime ${state.targetLabel}`
    case 'prep': return `prep time! ${mins}m left`
    case 'prepdone': return `prep done ✓ · ${mins}m left`
    case 'persist': return `still not ready · ${mins}m left`
    case 'disrupt': return `${mins}m — wrap it up`
    case 'peak': return mins > 0 ? `${mins}m — GO TO BED` : 'you are late. go to bed.'
    case 'goodnight': return 'goodnight 🌙'
    default: return 'geep'
  }
}

function buildTray (state = {}) {
  if (!tray) {
    tray = new Tray(trayImage())
    tray.on('click', () => tray.popUpContextMenu())
  }
  tray.setToolTip(`geep — ${phaseBlurb(state)}`)
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: phaseBlurb(state), enabled: false },
    { type: 'separator' },
    { label: 'Settings & schedule…', click: () => windows.openSettings() },
    {
      label: 'Test drive',
      submenu: [
        { label: 'Full run (45 min in ~90s)', click: () => engine.startDemo({ fromMinutes: 46, speed: 30 }) },
        { label: 'Jump to sticky panel (30m)', click: () => engine.startDemo({ fromMinutes: 30, speed: 12 }) },
        { label: 'Jump to disruption (20m)', click: () => engine.startDemo({ fromMinutes: 20, speed: 8 }) },
        { label: 'Jump to peak (10m)', click: () => engine.startDemo({ fromMinutes: 10, speed: 4 }) },
        { type: 'separator' },
        { label: 'Stop test drive', click: () => engine.stopDemo() }
      ]
    },
    { label: 'Call it off for tonight', click: () => panic() },
    { type: 'separator' },
    { label: 'Panic key: ⌘G', enabled: false },
    { label: 'Quit geep', click: () => app.quit() }
  ]))
}

let loginItemState = null
function setLoginItem (on) {
  if (loginItemState === !!on) return
  loginItemState = !!on
  try {
    app.setLoginItemSettings({ openAtLogin: !!on })
  } catch (err) {
    console.warn('[geep] login item unavailable:', err.message)
  }
}

// ⌘G is Find Next everywhere else, so only hold it while geep is on screen
const PANIC_KEY = 'CommandOrControl+G'
const PANIC_PHASES = new Set(['prep', 'prepdone', 'persist', 'disrupt', 'peak', 'goodnight'])
function syncPanicKey (state) {
  const want = PANIC_PHASES.has(state.phase)
  const have = globalShortcut.isRegistered(PANIC_KEY)
  if (want && !have) {
    if (!globalShortcut.register(PANIC_KEY, panic)) console.warn(`[geep] could not register panic shortcut ${PANIC_KEY}`)
  } else if (!want && have) {
    globalShortcut.unregister(PANIC_KEY)
  }
}

function panic () {
  engine.action('panic')
  system.unmuteIfWeMuted()
}

async function handleAudio (state) {
  if (!config.get().options.muteAudio) return
  const now = Date.now()
  if (state.phase === 'peak' || state.phase === 'goodnight') {
    if (now - lastMute > 3000) { lastMute = now; system.mute() }
  } else if (state.phase === 'disrupt') {
    const p = state.progress || 0
    if (now - lastMute > 15000 && Math.random() < 0.2 + 0.6 * p) { lastMute = now; system.mute() }
  } else if (state.phase === 'idle' || state.phase === 'off' || state.phase === 'prep') {
    system.unmuteIfWeMuted()
  }
}

app.whenReady().then(() => {
  config = new Config()
  engine = new Engine(config)
  windows = new WindowManager(engine)

  setLoginItem(config.get().options.launchAtLogin)

  let lastPhase = null
  engine.on('state', (state) => {
    windows.apply(state)
    syncPanicKey(state)
    handleAudio(state)
    buildTray(state)
    if (state.phase !== lastPhase) {
      lastPhase = state.phase
      if (process.env.GEEP_DEBUG) {
        console.log(`[geep] ${state.phase} · ${Math.round(state.minutesLeft ?? 0)}m left · blocking=${windows.blocking} · overlays=${windows.overlays.size}`)
        for (const w of windows.overlays.values()) {
          const b = w.getBounds()
          console.log(`[geep]   overlay ${b.width}x${b.height} @${b.x},${b.y} visible=${w.isVisible()} onTop=${w.isAlwaysOnTop()}`)
        }
        if (windows.nudge && !windows.nudge.isDestroyed()) {
          const b = windows.nudge.getBounds()
          console.log(`[geep]   nudge ${b.width}x${b.height} @${b.x},${b.y} visible=${windows.nudge.isVisible()}`)
        }
      }
    }
  })
  config.on('change', (cfg) => {
    windows.send('geep:config', cfg)
    setLoginItem(cfg.options.launchAtLogin)
  })

  buildTray()
  windows.syncOverlays()
  engine.start()

  if (process.env.GEEP_DEMO) {
    engine.startDemo({
      fromMinutes: Number(process.env.GEEP_DEMO_FROM || 46),
      speed: Number(process.env.GEEP_DEMO_SPEED || 30)
    })
  }
  else windows.openSettings()

  app.on('activate', () => windows.openSettings())
})

// ---- ipc ---------------------------------------------------------------
ipcMain.on('geep:ready', (e) => {
  if (engine.state) e.sender.send('geep:state', { ...engine.state, blocking: windows.blocking })
  e.sender.send('geep:config', config.get())
})
ipcMain.on('geep:action', (_e, { type, payload }) => {
  if (type === 'open-settings') return windows.openSettings()
  if (type === 'quit-app') return app.quit()
  if (type === 'sleep-display') return system.sleepDisplay()
  if (type === 'panic') return panic()
  if (type === 'demo') return payload?.stop ? engine.stopDemo() : engine.startDemo(payload)
  if (type === 'open-external' && payload?.url) return shell.openExternal(payload.url)
  engine.action(type, payload)
})
ipcMain.handle('geep:get-config', () => config.get())
ipcMain.handle('geep:save-config', (_e, patch) => config.save(patch))
ipcMain.handle('geep:set-exceptions', (_e, list) => config.setExceptions(list))
ipcMain.handle('geep:get-state', () => engine.state)

app.on('window-all-closed', (e) => { /* menubar app: stay alive */ })
app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  system.unmuteIfWeMuted()
})
