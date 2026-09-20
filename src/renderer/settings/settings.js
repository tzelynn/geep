const el = (id) => document.getElementById(id)
const { render, pick: pickChar } = window.GEEP_CAST

const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const DAY_NAME = { mon: 'monday', tue: 'tuesday', wed: 'wednesday', thu: 'thursday', fri: 'friday', sat: 'saturday', sun: 'sunday' }
const OPTIONS = [
  { key: 'prepLead', label: 'gentle nudges start', unit: 'min before' },
  { key: 'persistLead', label: 'sticky panel starts', unit: 'min before' },
  { key: 'disruptLead', label: 'screen disruption', unit: 'min before' },
  { key: 'peakLead', label: 'full takeover', unit: 'min before' },
  { key: 'snoozeMinutes', label: 'snooze length', unit: 'min' },
  { key: 'giveUpAfter', label: 'geep gives up after', unit: 'min late' }
]

let config = null
let savedTimer = null

function flashSaved () {
  el('saved').classList.add('on')
  clearTimeout(savedTimer)
  savedTimer = setTimeout(() => el('saved').classList.remove('on'), 1200)
}

async function save (patch) {
  config = await window.geep.saveConfig(patch)
  flashSaved()
}

function switchEl (checked, onChange) {
  const wrap = document.createElement('label')
  wrap.className = 'switch'
  wrap.innerHTML = '<input type="checkbox"><span></span>'
  const input = wrap.querySelector('input')
  input.checked = checked
  input.addEventListener('change', () => onChange(input.checked))
  return wrap
}

function renderWeekly () {
  const host = el('weekly')
  host.innerHTML = ''
  for (const day of DAY_ORDER) {
    const conf = config.weekly[day]
    const row = document.createElement('div')
    row.className = `row${conf.enabled ? '' : ' off'}`
    const name = document.createElement('div')
    name.className = 'name'
    name.textContent = DAY_NAME[day]
    const time = document.createElement('input')
    time.type = 'time'
    time.value = conf.time
    time.addEventListener('change', () => save({ weekly: { [day]: { time: time.value } } }))
    const spacer = document.createElement('div')
    spacer.className = 'spacer'
    row.append(name, time, spacer, switchEl(conf.enabled, (v) => {
      row.classList.toggle('off', !v)
      save({ weekly: { [day]: { enabled: v } } })
    }))
    host.appendChild(row)
  }
}

function renderExceptions () {
  const host = el('exceptions')
  host.innerHTML = ''
  const list = config.exceptions || []
  if (!list.length) {
    host.innerHTML = '<p class="empty">no exceptions — every night follows the weekly plan.</p>'
    return
  }
  const commit = () => window.geep.setExceptions(config.exceptions).then((c) => { config = c; flashSaved() })
  list.forEach((ex, i) => {
    const row = document.createElement('div')
    row.className = `row${ex.enabled === false ? ' off' : ''}`

    const date = document.createElement('input')
    date.type = 'date'
    date.value = ex.date || ''
    date.addEventListener('change', () => { config.exceptions[i].date = date.value; commit() })

    const time = document.createElement('input')
    time.type = 'time'
    time.value = ex.time || '23:00'
    time.disabled = ex.enabled === false
    time.addEventListener('change', () => { config.exceptions[i].time = time.value; commit() })

    const note = document.createElement('input')
    note.type = 'text'
    note.className = 'note'
    note.placeholder = 'why? (gig, flight, deadline…)'
    note.value = ex.note || ''
    note.addEventListener('change', () => { config.exceptions[i].note = note.value; commit() })

    const kill = document.createElement('button')
    kill.className = 'kill'
    kill.textContent = '✕'
    kill.title = 'remove'
    kill.addEventListener('click', () => { config.exceptions.splice(i, 1); commit().then(renderExceptions) })

    row.append(date, time, note, switchEl(ex.enabled !== false, (v) => {
      config.exceptions[i].enabled = v
      row.classList.toggle('off', !v)
      time.disabled = !v
      commit()
    }), kill)
    host.appendChild(row)
  })
}

function renderOptions () {
  const host = el('options')
  host.innerHTML = ''
  for (const opt of OPTIONS) {
    const field = document.createElement('div')
    field.className = 'field'
    field.innerHTML = `<label>${opt.label}</label>`
    const with_ = document.createElement('div')
    with_.className = 'with'
    const input = document.createElement('input')
    input.type = 'number'
    input.min = '0'
    input.max = '600'
    input.value = config.options[opt.key]
    input.addEventListener('change', () => save({ options: { [opt.key]: Number(input.value) } }))
    const unit = document.createElement('span')
    unit.className = 'unit'
    unit.textContent = opt.unit
    with_.append(input, unit)
    field.appendChild(with_)
    host.appendChild(field)
  }
  for (const [key, label] of [['muteAudio', 'mute audio when disrupting'], ['launchAtLogin', 'launch geep at login']]) {
    const field = document.createElement('div')
    field.className = 'field'
    field.innerHTML = `<label>${label}</label>`
    const with_ = document.createElement('div')
    with_.className = 'with'
    with_.appendChild(switchEl(!!config.options[key], (v) => save({ options: { [key]: v } })))
    field.appendChild(with_)
    host.appendChild(field)
  }
}

function humanGap (mins) {
  if (mins == null) return ''
  const m = Math.max(0, Math.round(mins))
  const h = Math.floor(m / 60)
  return h ? `${h}h ${m % 60}m` : `${m}m`
}

const PHASE_WORD = {
  off: 'no bedtime scheduled',
  idle: 'waiting',
  quiet: 'snoozed',
  prep: 'nudging you to get ready',
  prepdone: 'prep done ✓',
  persist: 'being sticky about it',
  disrupt: 'disrupting',
  peak: 'full takeover',
  goodnight: 'goodnight 🌙'
}

function renderStatus (state) {
  if (!state || !state.phase) return
  el('heroChar').innerHTML = render(pickChar(state.dayStamp), state.phase === 'peak' ? 'stern' : 'sweet')
  if (state.phase === 'off') {
    el('status').textContent = state.calledOff ? 'called off for tonight' : 'no bedtime scheduled'
    el('tonight').textContent = state.calledOff
      ? 'geep will be back for the next bedtime.'
      : 'turn a day on below and geep will show up.'
    return
  }
  el('status').textContent = `next bedtime ${state.targetLabel} · ${humanGap(state.minutesLeft)} away`
  el('tonight').textContent = `${PHASE_WORD[state.phase] || state.phase}${state.demo ? ' · test drive running' : ''} · tonight\'s character: ${pickChar(state.dayStamp).name}`
}

el('addException').addEventListener('click', async () => {
  const d = new Date()
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  config.exceptions = [...(config.exceptions || []), { date: iso, enabled: true, time: '01:00', note: '' }]
  config = await window.geep.setExceptions(config.exceptions)
  renderExceptions()
  flashSaved()
})

document.addEventListener('click', (e) => {
  const demo = e.target.closest('button[data-demo]')
  if (demo) window.geep.action('demo', JSON.parse(demo.dataset.demo))
})

window.geep.onConfig((cfg) => {
  const first = !config
  config = cfg
  if (first) { renderWeekly(); renderExceptions(); renderOptions() }
})
window.geep.onState(renderStatus)

window.geep.getConfig().then((cfg) => {
  config = cfg
  renderWeekly(); renderExceptions(); renderOptions()
  window.geep.getState().then(renderStatus)
})
