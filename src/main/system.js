'use strict'
const { execFile } = require('child_process')

let weMuted = false

function osa (script) {
  return new Promise((resolve) => {
    execFile('osascript', ['-e', script], { timeout: 4000 }, (err, stdout) => {
      resolve(err ? null : String(stdout).trim())
    })
  })
}

async function isMuted () {
  const out = await osa('output muted of (get volume settings)')
  return out === 'true'
}

async function mute () {
  if (process.platform !== 'darwin') return
  if (await isMuted()) return
  weMuted = true
  await osa('set volume output muted true')
}

async function unmuteIfWeMuted () {
  if (process.platform !== 'darwin' || !weMuted) return
  weMuted = false
  await osa('set volume output muted false')
}

function sleepDisplay () {
  if (process.platform !== 'darwin') return
  execFile('pmset', ['displaysleepnow'], () => {})
}

module.exports = { mute, unmuteIfWeMuted, sleepDisplay, isMuted }
