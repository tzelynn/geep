'use strict'
const { DAYS } = require('./config')

const MIN = 60 * 1000

function pad (n) { return String(n).padStart(2, '0') }

function dateKey (d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function parseTime (t) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '').trim())
  if (!m) return null
  const h = Number(m[1]); const mi = Number(m[2])
  if (h > 23 || mi > 59) return null
  return { h, m: mi }
}

// A bedtime set for "Friday" that reads 00:30 means Saturday 00:30 --
// anything before 04:00 belongs to the night of the previous day.
function bedtimeFor (dayDate, time) {
  const t = parseTime(time)
  if (!t) return null
  const d = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), t.h, t.m, 0, 0)
  if (t.h < 4) d.setDate(d.getDate() + 1)
  return d
}

// Resolves the bedtime "owned" by a given calendar day, honouring exceptions.
function planForDay (config, dayDate) {
  const key = dateKey(dayDate)
  const exception = (config.exceptions || []).find((e) => e.date === key)
  if (exception) {
    if (exception.enabled === false) return null
    const at = bedtimeFor(dayDate, exception.time)
    if (!at) return null
    return { at, source: 'exception', label: exception.note || 'exception', dayKey: DAYS[dayDate.getDay()] }
  }
  const weekly = (config.weekly || {})[DAYS[dayDate.getDay()]]
  if (!weekly || weekly.enabled === false) return null
  const at = bedtimeFor(dayDate, weekly.time)
  if (!at) return null
  return { at, source: 'weekly', label: 'weekly', dayKey: DAYS[dayDate.getDay()] }
}

// The bedtime geep currently cares about: the soonest one that hasn't been
// abandoned yet. Looks a day back so a 01:00 bedtime is still "live" at 00:59.
function nextTarget (config, now = new Date()) {
  const giveUp = (config.options.giveUpAfter || 120) * MIN
  let best = null
  for (let offset = -2; offset <= 8; offset++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)
    const plan = planForDay(config, day)
    if (!plan) continue
    if (plan.at.getTime() + giveUp < now.getTime()) continue
    if (!best || plan.at < best.at) best = plan
  }
  return best
}

function minutesUntil (target, now = new Date()) {
  return (target.getTime() - now.getTime()) / MIN
}

module.exports = { nextTarget, planForDay, bedtimeFor, parseTime, dateKey, minutesUntil, DAYS }
