const el = (id) => document.getElementById(id)
const { render, pick: pickChar } = window.GEEP_CAST
const { LINES, DONE_LABELS, SNOOZE_LABELS, pick } = window.GEEP_COPY

let lastBeat = -1
let lastPhase = null
let flip = false

function moodFor (state) {
  if (state.phase === 'prepdone') return 'sleepy'
  if (state.phase !== 'persist') return 'sweet'
  return state.progress > 0.6 ? 'feral' : 'stern'
}

function beatFor (state) {
  const period = state.phase === 'persist' ? 7 : 13
  return Math.floor(state.secondsLeft / period)
}

function renderActions (state, beat) {
  const actions = el('actions')
  const done = `<button class="btn-primary" data-act="done">${pick(DONE_LABELS, beat)}</button>`
  const snooze = `<button class="btn-ghost" data-act="snooze">${pick(SNOOZE_LABELS, beat + 1)}</button>`
  if (state.phase === 'prep') {
    // shuffle the order now and then so muscle memory never settles
    actions.innerHTML = flip ? snooze + done : done + snooze
  } else if (state.phase === 'persist') {
    actions.innerHTML = done
  } else {
    actions.innerHTML = ''
  }
}

function apply (state) {
  const card = el('card')
  const beat = beatFor(state)
  const fresh = beat !== lastBeat || state.phase !== lastPhase
  if (fresh) {
    flip = Math.random() < 0.35
    lastBeat = beat
    lastPhase = state.phase
    el('char').innerHTML = render(pickChar(state.dayStamp), moodFor(state))
    el('line').textContent = pick(LINES[state.phase] || LINES.prep, beat + state.dayIndex)
    renderActions(state, beat)
  }

  const mins = Math.max(0, Math.ceil(state.minutesLeft))
  card.className = 'card'
  if (state.phase === 'persist') {
    card.classList.add('persist')
    if (state.progress > 0.55) card.classList.add('hot')
    card.style.setProperty('--grow', state.progress.toFixed(2))
    card.style.setProperty('--jit', `${(1.9 - state.progress * 1.2).toFixed(2)}s`)
    el('meta').textContent = `bedtime ${state.targetLabel} · ${mins} min · i am not leaving`
  } else if (state.phase === 'prepdone') {
    card.classList.add('pill')
    el('meta').textContent = `bedtime ${state.targetLabel} · ${mins} min`
  } else {
    el('meta').textContent = `bedtime ${state.targetLabel} · ${mins} min to go`
  }

  const total = state.phase === 'persist' ? 10 : 15
  const used = state.phase === 'persist' ? state.progress : (state.progress || 0)
  el('bar').style.width = `${Math.round(used * 100)}%`
  el('bar').title = `${total}m window`
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-act]')
  if (!btn) return
  window.geep.action(btn.dataset.act)
})

window.geep.onState((state) => {
  if (!state || !state.phase) return
  apply(state)
})
