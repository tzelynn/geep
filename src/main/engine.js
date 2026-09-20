'use strict'
const { EventEmitter } = require('events')
const { nextTarget, minutesUntil } = require('./schedule')

const MIN = 60 * 1000
// how long the "prep done ✓" pill sticks around before geep leaves you alone
const DONE_ACK_MS = 5000

// Which of the escalation stages we are in, given minutes to bedtime.
function phaseFor (m, o) {
  if (m > o.prepLead) return 'idle'
  if (m > o.persistLead) return 'prep'
  if (m > o.disruptLead) return 'persist'
  if (m > o.peakLead) return 'disrupt'
  return 'peak'
}

// 0 -> 1 across the whole runway, so visuals can ramp smoothly.
function rampFor (m, o) {
  const span = o.prepLead - o.peakLead
  if (span <= 0) return 1
  return Math.min(1, Math.max(0, (o.prepLead - m) / span))
}

// 0 -> 1 inside the current phase.
function phaseProgress (phase, m, o) {
  const bounds = {
    prep: [o.prepLead, o.persistLead],
    persist: [o.persistLead, o.disruptLead],
    disrupt: [o.disruptLead, o.peakLead],
    peak: [o.peakLead, o.peakLead - 15]
  }[phase]
  if (!bounds) return 0
  const [hi, lo] = bounds
  if (hi === lo) return 1
  return Math.min(1, Math.max(0, (hi - m) / (hi - lo)))
}

class Engine extends EventEmitter {
  constructor (config) {
    super()
    this.config = config
    this.session = null
    this.demo = null
    this.timer = null
    this.ackTimer = null
    this.state = { phase: 'idle' }
    config.on('change', () => this.tick())
  }

  start () {
    if (this.timer) clearInterval(this.timer)
    this.timer = setInterval(() => this.tick(), 1000)
    this.tick()
  }

  stop () {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.clearAck()
  }

  // the ack is shorter than the tick, so it gets its own wake-up. in demo mode
  // the 5s is virtual, so the real delay shrinks with the clock speed.
  scheduleAck () {
    this.clearAck()
    const speed = this.demo ? this.demo.speed : 1
    this.ackTimer = setTimeout(() => this.tick(), DONE_ACK_MS / speed + 50)
  }

  clearAck () {
    if (this.ackTimer) clearTimeout(this.ackTimer)
    this.ackTimer = null
  }

  // ---- virtual clock (test drive) -------------------------------------
  now () {
    if (!this.demo) return new Date()
    const elapsed = (Date.now() - this.demo.anchorReal) * this.demo.speed
    return new Date(this.demo.anchorVirtual + elapsed)
  }

  startDemo ({ fromMinutes = 46, speed = 30 } = {}) {
    const target = new Date(Date.now() + 6 * 60 * MIN)
    target.setSeconds(0, 0)
    this.demo = {
      target,
      speed,
      anchorReal: Date.now(),
      anchorVirtual: target.getTime() - fromMinutes * MIN
    }
    this.session = null
    this.tick()
  }

  stopDemo () {
    this.demo = null
    this.session = null
    this.tick()
  }

  // ---- session ---------------------------------------------------------
  ensureSession (target) {
    const iso = target.at.toISOString()
    if (!this.session || this.session.targetIso !== iso) {
      this.session = {
        targetIso: iso,
        prepDone: false,
        prepDoneAt: 0,
        snoozeUntil: 0,
        goodnight: false,
        abandoned: false,
        startedAt: Date.now(),
        // each night gets its own rhythm so the nudges never land at the
        // same clock minute twice
        beatOffset: Math.floor(Math.random() * 120),
        beatCycle: 170 + Math.floor(Math.random() * 90)
      }
      this.emit('session', this.session)
    }
    return this.session
  }

  action (type, payload = {}) {
    const o = this.config.get().options
    if (!this.session) return
    switch (type) {
      case 'done':
        this.session.prepDone = true
        this.session.prepDoneAt = this.now().getTime()
        this.session.snoozeUntil = 0
        this.scheduleAck()
        break
      case 'snooze':
        this.session.snoozeUntil = this.now().getTime() + (payload.minutes || o.snoozeMinutes) * MIN
        break
      case 'undone':
        this.session.prepDone = false
        this.session.prepDoneAt = 0
        this.clearAck()
        break
      case 'goodnight':
        this.session.goodnight = true
        break
      case 'panic':
        this.session.abandoned = true
        this.session.goodnight = false
        break
    }
    this.tick()
  }

  tick () {
    const cfg = this.config.get()
    const o = cfg.options
    const now = this.now()

    let target = this.demo
      ? { at: this.demo.target, source: 'demo', label: 'test drive', dayKey: 'demo' }
      : nextTarget(cfg, now)

    if (!target) {
      this.state = { phase: 'off', demo: false, now: now.toISOString() }
      this.emit('state', this.state)
      return
    }

    const session = this.ensureSession(target)
    const minutesLeft = minutesUntil(target.at, now)
    let phase = phaseFor(minutesLeft, o)

    // the gentle stage *visits* rather than squats: it shows up for ~80s at a
    // time, on a rhythm that shifts every night
    const sinceStart = Math.max(0, (o.prepLead - minutesLeft) * 60)
    const inBurst = sinceStart < 90 ||
      ((sinceStart + session.beatOffset) % session.beatCycle) < 80

    // gentle nudges can be snoozed; the sticky ones cannot
    const snoozed = phase === 'prep' && now.getTime() < session.snoozeUntil
    // prep marked done => the 30-minute sticky panel is skipped entirely; all
    // that's left is a 5-second "got it" pill before the screen goes quiet
    const acking = session.prepDone && now.getTime() - session.prepDoneAt < DONE_ACK_MS
    if (session.prepDone && (phase === 'prep' || phase === 'persist')) {
      phase = acking ? 'prepdone' : 'quiet'
    }
    if (phase === 'prep' && (snoozed || !inBurst)) phase = 'quiet'
    if (session.goodnight && (phase === 'peak' || phase === 'disrupt')) phase = 'goodnight'
    if (session.abandoned) phase = 'off'

    const ramp = rampFor(minutesLeft, o)
    this.state = {
      phase,
      calledOff: !!session.abandoned,
      minutesLeft,
      secondsLeft: Math.round(minutesLeft * 60),
      ramp,
      progress: phaseProgress(phaseFor(minutesLeft, o), minutesLeft, o),
      prepDone: session.prepDone,
      snoozeUntil: session.snoozeUntil,
      targetIso: target.at.toISOString(),
      targetLabel: target.at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      source: target.source,
      demo: !!this.demo,
      dayIndex: target.at.getDay(),
      dayStamp: target.at.toDateString(),
      now: now.toISOString()
    }
    this.emit('state', this.state)
  }
}

module.exports = { Engine, phaseFor }
