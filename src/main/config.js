'use strict'
const fs = require('fs')
const path = require('path')
const { app } = require('electron')
const { EventEmitter } = require('events')

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

const DEFAULTS = {
  weekly: {
    sun: { enabled: true, time: '23:00' },
    mon: { enabled: true, time: '23:00' },
    tue: { enabled: true, time: '23:00' },
    wed: { enabled: true, time: '23:00' },
    thu: { enabled: true, time: '23:00' },
    fri: { enabled: true, time: '00:30' },
    sat: { enabled: true, time: '00:30' }
  },
  // [{ date: 'YYYY-MM-DD', enabled: true, time: '01:30', note: 'concert' }]
  exceptions: [],
  options: {
    prepLead: 45,       // gentle nudges start
    persistLead: 30,    // sticky panel starts
    disruptLead: 20,    // screen disruption starts
    peakLead: 10,       // unusable
    snoozeMinutes: 5,
    giveUpAfter: 120,   // minutes past bedtime before geep gives up on tonight
    muteAudio: true,
    launchAtLogin: false
  }
}

function deepMerge (base, override) {
  if (!override || typeof override !== 'object') return base
  const out = Array.isArray(base) ? base.slice() : { ...base }
  for (const [k, v] of Object.entries(override)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && base && typeof base[k] === 'object' && !Array.isArray(base[k])) {
      out[k] = deepMerge(base[k], v)
    } else if (v !== undefined) {
      out[k] = v
    }
  }
  return out
}

class Config extends EventEmitter {
  constructor () {
    super()
    this.file = path.join(app.getPath('userData'), 'config.json')
    this.data = this.load()
  }

  load () {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'))
      return deepMerge(DEFAULTS, raw)
    } catch (err) {
      return JSON.parse(JSON.stringify(DEFAULTS))
    }
  }

  get () {
    return this.data
  }

  save (patch) {
    this.data = deepMerge(this.data, patch)
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true })
      fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2))
    } catch (err) {
      console.error('[geep] could not save config', err)
    }
    this.emit('change', this.data)
    return this.data
  }

  // exceptions are replaced wholesale (deepMerge would union arrays awkwardly)
  setExceptions (list) {
    this.data.exceptions = list
    return this.save({})
  }
}

module.exports = { Config, DAYS, DEFAULTS }
