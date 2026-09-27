'use strict'
const path = require('path')
const { BrowserWindow, screen, app } = require('electron')

const PRELOAD = path.join(__dirname, '..', 'preload', 'api.js')
const R = (...p) => path.join(__dirname, '..', 'renderer', ...p)

const DEBUG = !!process.env.GEEP_DEBUG

// surface renderer console output in the terminal while developing
function wire (win, role) {
  if (!DEBUG) return win
  win.webContents.on('console-message', (e) => {
    console.log(`[${role}] ${e.message || ''}`)
  })
  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.log(`[${role}] FAILED ${code} ${desc} ${url}`)
  })
  return win
}

const NUDGE_SHOWN = new Set(['prep', 'prepdone', 'persist'])
const OVERLAY_SHOWN = new Set(['disrupt', 'peak', 'goodnight'])

// how big the sticky panel gets as it loses patience
function nudgeSize (state) {
  if (state.phase === 'prepdone') return { w: 280, h: 132 }
  if (state.phase === 'prep') return { w: 400, h: 340 }
  const p = state.progress || 0
  return { w: Math.round(430 + 250 * p), h: Math.round(370 + 190 * p) }
}

class WindowManager {
  constructor (engine) {
    this.engine = engine
    this.overlays = new Map()
    this.nudge = null
    this.settings = null
    this.blocking = false
    this.blockUntil = 0
    this.lastMove = 0
    this.lastState = null
    screen.on('display-added', () => this.syncOverlays())
    screen.on('display-removed', () => this.syncOverlays())
  }

  // ---- creation --------------------------------------------------------
  makeNudge () {
    const win = new BrowserWindow({
      width: 400,
      height: 340,
      // a non-activating NSPanel: clicking it must not activate geep, or macOS
      // drags the user off their fullscreen video to the settings window
      type: 'panel',
      show: false,
      frame: false,
      transparent: true,
      hasShadow: false,
      resizable: false,
      movable: false,
      focusable: false,
      skipTaskbar: true,
      fullscreenable: false,
      webPreferences: { preload: PRELOAD, additionalArguments: ['--geep-role=nudge'] }
    })
    win.setAlwaysOnTop(true, 'screen-saver')
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    wire(win, 'nudge').loadFile(R('nudge', 'index.html'))
    win.on('closed', () => { this.nudge = null })
    this.nudge = win
    return win
  }

  makeOverlay (display) {
    const win = new BrowserWindow({
      ...display.bounds,
      type: 'panel', // same reason as the nudge: clicks must not activate geep
      show: false,
      frame: false,
      transparent: true,
      hasShadow: false,
      resizable: false,
      movable: false,
      skipTaskbar: true,
      enableLargerThanScreen: true,
      fullscreenable: false,
      webPreferences: { preload: PRELOAD, additionalArguments: ['--geep-role=overlay'] }
    })
    win.setAlwaysOnTop(true, 'screen-saver')
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    win.setIgnoreMouseEvents(true, { forward: true })
    wire(win, 'overlay').loadFile(R('overlay', 'index.html'))
    win.on('closed', () => { this.overlays.delete(display.id) })
    this.overlays.set(display.id, win)
    return win
  }

  syncOverlays () {
    const displays = screen.getAllDisplays()
    const ids = new Set(displays.map((d) => d.id))
    for (const [id, win] of this.overlays) {
      if (!ids.has(id)) { win.destroy(); this.overlays.delete(id) }
    }
    for (const d of displays) {
      const win = this.overlays.get(d.id) || this.makeOverlay(d)
      if (!win.isDestroyed()) win.setBounds(d.bounds)
    }
    if (this.lastState) this.apply(this.lastState)
  }

  openSettings () {
    if (this.settings && !this.settings.isDestroyed()) {
      this.settings.show(); this.settings.focus(); return this.settings
    }
    const win = new BrowserWindow({
      width: 940,
      height: 760,
      minWidth: 720,
      minHeight: 560,
      title: 'geep',
      titleBarStyle: 'hiddenInset',
      backgroundColor: '#1b1430',
      show: false,
      webPreferences: { preload: PRELOAD, additionalArguments: ['--geep-role=settings'] }
    })
    wire(win, 'settings').loadFile(R('settings', 'index.html'))
    win.once('ready-to-show', () => { win.show(); win.focus() })
    win.on('closed', () => { this.settings = null })
    this.settings = win
    return win
  }

  // ---- broadcast -------------------------------------------------------
  each (fn) {
    const wins = [this.nudge, this.settings, ...this.overlays.values()]
    for (const w of wins) if (w && !w.isDestroyed()) fn(w)
  }

  send (channel, payload) {
    this.each((w) => w.webContents.send(channel, payload))
  }

  // ---- the unpredictable bit ------------------------------------------
  // during `disrupt` the overlay swallows clicks in bursts that get longer
  // and more frequent; at peak it just never lets go.
  updateBlocking (state) {
    const now = Date.now()
    let blocking = false
    if (state.phase === 'peak' || state.phase === 'goodnight') {
      blocking = true
    } else if (state.phase === 'disrupt') {
      const p = state.progress || 0
      if (now < this.blockUntil) {
        blocking = true
      } else if (Math.random() < 0.12 + 0.5 * p) {
        this.blockUntil = now + 900 + 3200 * p
        blocking = true
      }
    } else {
      this.blockUntil = 0
    }
    if (blocking !== this.blocking) {
      this.blocking = blocking
      for (const win of this.overlays.values()) {
        if (!win.isDestroyed()) win.setIgnoreMouseEvents(!blocking, { forward: true })
      }
    }
    return blocking
  }

  // wander the sticky panel so it can't be tuned out
  maybeMoveNudge (state) {
    if (!this.nudge || this.nudge.isDestroyed()) return
    const { w, h } = nudgeSize(state)
    const area = screen.getPrimaryDisplay().workArea
    const wandering = state.phase === 'persist' && state.progress > 0.25
    const due = Date.now() - this.lastMove > (wandering ? 7000 : 60000)
    if (!due && this.nudge.isVisible()) {
      const b = this.nudge.getBounds()
      if (b.width !== w || b.height !== h) this.nudge.setBounds({ ...b, width: w, height: h })
      return
    }
    this.lastMove = Date.now()
    let x = area.x + area.width - w - 24
    let y = area.y + area.height - h - 24
    if (wandering) {
      x = area.x + Math.round(Math.random() * Math.max(0, area.width - w))
      y = area.y + Math.round(Math.random() * Math.max(0, area.height - h))
    }
    this.nudge.setBounds({ x, y, width: w, height: h })
  }

  apply (state) {
    this.lastState = state
    const blocking = this.updateBlocking(state)
    const payload = { ...state, blocking }

    // nudge panel
    if (NUDGE_SHOWN.has(state.phase)) {
      if (!this.nudge || this.nudge.isDestroyed()) this.makeNudge()
      this.maybeMoveNudge(state)
      if (!this.nudge.isVisible()) this.nudge.showInactive()
    } else if (this.nudge && !this.nudge.isDestroyed() && this.nudge.isVisible()) {
      this.nudge.hide()
    }

    // full-screen takeover
    if (OVERLAY_SHOWN.has(state.phase)) {
      if (this.overlays.size === 0) this.syncOverlays()
      for (const win of this.overlays.values()) {
        if (win.isDestroyed()) continue
        if (!win.isVisible()) {
          win.showInactive()
          win.setAlwaysOnTop(true, 'screen-saver')
        }
      }
      if (state.phase === 'peak' && !this._focusedPeak) {
        this._focusedPeak = true
        app.focus({ steal: true })
      }
      if (state.phase !== 'peak') this._focusedPeak = false
    } else {
      this._focusedPeak = false
      for (const win of this.overlays.values()) {
        if (!win.isDestroyed() && win.isVisible()) win.hide()
      }
    }

    this.send('geep:state', payload)
  }

  destroyAll () {
    this.each((w) => w.destroy())
    this.overlays.clear()
  }
}

module.exports = { WindowManager }
