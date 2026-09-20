const el = (id) => document.getElementById(id)
const { render, pick: pickChar, CAST } = window.GEEP_CAST
const { LINES, BED_LABELS, pick } = window.GEEP_COPY

let last = { phase: null, beat: -1, blocking: false }
let roamAt = 0
let driftAt = 0
let shakeAt = 0

function moodFor (state) {
  if (state.phase === 'goodnight') return 'sleepy'
  if (state.phase === 'peak') return state.minutesLeft < 0 ? 'feral' : 'stern'
  return state.progress > 0.55 ? 'stern' : 'sweet'
}

function fmt (secs) {
  const over = secs < 0
  const s = Math.abs(Math.round(secs))
  const mm = String(Math.floor(s / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${over ? '+' : ''}${mm}:${ss}`
}

// nag card hops somewhere new -- never the same corner twice in a row
function moveRoamer (progress) {
  const r = el('roamer')
  const w = 260 + Math.round(120 * progress)
  r.style.width = `${w}px`
  const h = r.offsetHeight || 260
  r.style.left = `${Math.round(Math.random() * Math.max(20, innerWidth - w - 40)) + 20}px`
  r.style.top = `${Math.round(Math.random() * Math.max(20, innerHeight - h - 40)) + 20}px`
}

function spawnDrifter (state) {
  const host = el('drifters')
  const node = document.createElement('div')
  node.className = 'drifter'
  const char = CAST[Math.floor(Math.random() * CAST.length)]
  node.innerHTML = render(char, Math.random() < 0.4 ? 'sleepy' : 'sweet')
  const fromLeft = Math.random() < 0.5
  const dur = 7 + Math.random() * 7
  const size = 60 + Math.random() * 70
  node.style.width = node.style.height = `${size}px`
  node.style.setProperty('--x0', `${fromLeft ? -size : innerWidth}px`)
  node.style.setProperty('--x1', `${fromLeft ? innerWidth : -size}px`)
  const y = Math.random() * (innerHeight - size)
  node.style.setProperty('--y0', `${y}px`)
  node.style.setProperty('--y1', `${y + (Math.random() * 200 - 100)}px`)
  node.style.setProperty('--spin', `${Math.random() * 60 - 30}deg`)
  node.style.animationDuration = `${dur}s`
  node.style.left = node.style.top = '0'
  host.appendChild(node)
  setTimeout(() => node.remove(), dur * 1000 + 200)
}

function apply (state) {
  const body = document.body
  const phase = state.phase
  body.className = `overlay phase-${phase}${state.blocking ? ' blocking' : ''}`

  const heat = phase === 'peak' ? 1 : (state.progress || 0)
  el('vignette').style.setProperty('--heat', heat.toFixed(2))
  el('vignette').style.setProperty('--vis', phase === 'disrupt' ? (0.25 + 0.75 * heat).toFixed(2) : '0')
  el('backdrop').style.opacity = phase === 'peak' || phase === 'goodnight'
    ? '1'
    : (phase === 'disrupt' ? (0.10 * heat).toFixed(2) : '0')

  const beat = Math.floor(state.secondsLeft / (phase === 'peak' ? 6 : 9))
  const fresh = beat !== last.beat || phase !== last.phase
  const char = pickChar(state.dayStamp)

  if (fresh) {
    last = { phase, beat, blocking: state.blocking }
    const line = pick(LINES[phase] || LINES.disrupt, beat + state.dayIndex)
    el('roamLine').textContent = line
    el('peakLine').textContent = line
    el('roamChar').innerHTML = render(char, moodFor(state))
    el('peakChar').innerHTML = render(char, moodFor(state))
    el('shieldChar').innerHTML = render(char, 'feral')
    el('shieldLine').textContent = pick([
      'clicks are temporarily unavailable 🙃',
      'nope. bedtime.',
      'the mouse is asleep. be like the mouse.',
      'i am holding the cursor hostage',
      'try again tomorrow ✨'
    ], beat)
    el('bedBtn').textContent = pick(BED_LABELS, beat)
    el('nightLine').textContent = pick(LINES.goodnight, beat)
  }

  const now = Date.now()
  if (phase === 'disrupt') {
    const hopEvery = 7000 - 4500 * heat
    if (now - roamAt > hopEvery) { roamAt = now; moveRoamer(heat) }
    const driftEvery = 4200 - 3200 * heat
    if (now - driftAt > driftEvery) { driftAt = now; spawnDrifter(state) }
  }
  if (phase === 'peak') {
    if (now - driftAt > 900) { driftAt = now; spawnDrifter(state) }
    if (now - shakeAt > 6000 && Math.random() < 0.35) {
      shakeAt = now
      body.classList.add('shake')
      setTimeout(() => body.classList.remove('shake'), 500)
    }
    el('clock').textContent = fmt(state.secondsLeft)
    el('sub').textContent = state.secondsLeft > 0
      ? `until ${state.targetLabel}. the computer is closing.`
      : `past ${state.targetLabel}. you are officially late.`
  }
}

// hold-to-quit: quitting is the only real escape, so make it deliberate
let holdTimer = null
function startHold (btn) {
  const started = Date.now()
  const need = 1500
  btn.style.setProperty('--hold', '0%')
  holdTimer = setInterval(() => {
    const p = Math.min(1, (Date.now() - started) / need)
    btn.style.setProperty('--hold', `${Math.round(p * 100)}%`)
    if (p >= 1) { stopHold(btn); window.geep.action(btn.dataset.hold) }
  }, 50)
}
function stopHold (btn) {
  clearInterval(holdTimer); holdTimer = null
  btn.style.setProperty('--hold', '0%')
}

document.addEventListener('mousedown', (e) => {
  const hold = e.target.closest('button[data-hold]')
  if (hold) startHold(hold)
})
document.addEventListener('mouseup', () => {
  document.querySelectorAll('button[data-hold]').forEach(stopHold)
})
document.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-act]')
  if (btn) window.geep.action(btn.dataset.act)
})

window.geep.onState((state) => { if (state && state.phase) apply(state) })
