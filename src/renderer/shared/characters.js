/* geep placeholder cast. Hand-drawn SVGs will replace these later --
   keep the same shape: id, name, palette, and a render(mood) -> svg string. */
(function (root) {
  const CAST = [
    { id: 'mochi', name: 'Mochi', body: '#d9cdff', shade: '#bdaaf7', accent: '#ff89b0', form: 'round', ears: 'none', hat: 'cap' },
    { id: 'nubbin', name: 'Nubbin', body: '#b9f0d8', shade: '#8fdcbe', accent: '#ffd166', form: 'round', ears: 'bunny', hat: 'none' },
    { id: 'tofu', name: 'Tofu', body: '#fff0bd', shade: '#f3dc92', accent: '#ff9f68', form: 'square', ears: 'horns', hat: 'none' },
    { id: 'plum', name: 'Plum', body: '#c9b1ff', shade: '#a98cf2', accent: '#7ae7d4', form: 'round', ears: 'cat', hat: 'none' },
    { id: 'cloudy', name: 'Cloudy', body: '#c8e4ff', shade: '#a5cdf5', accent: '#ffb3c8', form: 'wide', ears: 'none', hat: 'star' },
    { id: 'jelly', name: 'Jelly', body: '#ffc7e0', shade: '#f5a7cb', accent: '#8ad6ff', form: 'tall', ears: 'antenna', hat: 'none' }
  ]

  const INK = '#3a2054'

  function bodyPath (form) {
    switch (form) {
      case 'square': return '<rect x="46" y="58" width="108" height="104" rx="34"/>'
      case 'wide': return '<ellipse cx="100" cy="116" rx="64" ry="48"/>'
      case 'tall': return '<ellipse cx="100" cy="112" rx="46" ry="58"/>'
      default: return '<circle cx="100" cy="114" r="54"/>'
    }
  }

  function ears (kind, c) {
    switch (kind) {
      case 'bunny':
        return `<g fill="${c.body}" stroke="${c.shade}" stroke-width="2">
          <ellipse cx="80" cy="46" rx="11" ry="26" transform="rotate(-10 80 46)"/>
          <ellipse cx="120" cy="46" rx="11" ry="26" transform="rotate(10 120 46)"/></g>`
      case 'cat':
        return `<g fill="${c.body}"><path d="M60 78 L64 44 L92 62 Z"/><path d="M140 78 L136 44 L108 62 Z"/></g>
          <g fill="${c.accent}" opacity=".8"><path d="M67 72 L69 54 L84 64 Z"/><path d="M133 72 L131 54 L116 64 Z"/></g>`
      case 'horns':
        return `<g fill="${c.accent}"><path d="M62 60 q-6 -22 8 -26 q-2 16 6 24 Z"/><path d="M138 60 q6 -22 -8 -26 q2 16 -6 24 Z"/></g>`
      case 'antenna':
        return `<g><path d="M100 56 L100 34" stroke="${c.shade}" stroke-width="4" stroke-linecap="round"/>
          <path d="M100 18 l6 12 13 2 -9 9 2 13 -12-6 -12 6 2-13 -9-9 13-2z" fill="${c.accent}"/></g>`
      default: return ''
    }
  }

  function hat (kind, c) {
    if (kind === 'cap') {
      return `<g><path d="M62 74 Q100 20 140 72 Z" fill="${c.accent}"/>
        <circle cx="101" cy="28" r="11" fill="#fff4f9" stroke="${c.accent}" stroke-width="2.5"/>
        <rect x="60" y="68" width="82" height="12" rx="6" fill="#fff4f9" stroke="${c.accent}" stroke-width="1.5"/></g>`
    }
    if (kind === 'star') {
      return `<path d="M148 48 l5 11 12 2 -8.5 8.5 2 12 -10.5-5.5 -10.5 5.5 2-12 -8.5-8.5 12-2z" fill="${c.accent}"/>`
    }
    return ''
  }

  function eyes (mood, c) {
    const L = 78; const R = 122; const y = 112
    switch (mood) {
      case 'sleepy':
        return `<g stroke="${INK}" stroke-width="5" stroke-linecap="round" fill="none">
          <path d="M${L - 11} ${y} q11 -11 22 0"/><path d="M${R - 11} ${y} q11 -11 22 0"/></g>`
      case 'stern':
        return `<g><circle cx="${L}" cy="${y + 2}" r="8" fill="${INK}"/><circle cx="${R}" cy="${y + 2}" r="8" fill="${INK}"/>
          <g stroke="${INK}" stroke-width="5" stroke-linecap="round">
            <path d="M${L - 13} ${y - 15} L${L + 11} ${y - 8}"/><path d="M${R + 13} ${y - 15} L${R - 11} ${y - 8}"/></g></g>`
      case 'feral':
        return `<g stroke="${INK}" stroke-width="5" stroke-linecap="round">
          <path d="M${L - 9} ${y - 9} L${L + 9} ${y + 9}"/><path d="M${L + 9} ${y - 9} L${L - 9} ${y + 9}"/>
          <path d="M${R - 9} ${y - 9} L${R + 9} ${y + 9}"/><path d="M${R + 9} ${y - 9} L${R - 9} ${y + 9}"/></g>`
      case 'shock':
        return `<g><ellipse cx="${L}" cy="${y}" rx="10" ry="13" fill="#fff"/><ellipse cx="${R}" cy="${y}" rx="10" ry="13" fill="#fff"/>
          <circle cx="${L}" cy="${y + 2}" r="5" fill="${INK}"/><circle cx="${R}" cy="${y + 2}" r="5" fill="${INK}"/></g>`
      default:
        return `<g fill="${INK}"><circle cx="${L}" cy="${y}" r="7.5"/><circle cx="${R}" cy="${y}" r="7.5"/>
          <circle cx="${L + 3}" cy="${y - 3}" r="2.5" fill="#fff"/><circle cx="${R + 3}" cy="${y - 3}" r="2.5" fill="#fff"/></g>`
    }
  }

  function mouth (mood) {
    switch (mood) {
      case 'sleepy': return `<path d="M92 134 q8 9 16 0" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>`
      case 'stern': return `<path d="M88 136 L112 136" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`
      case 'feral': return `<path d="M84 128 q16 24 32 0 q-16 8 -32 0z" fill="${INK}"/>`
      case 'shock': return `<ellipse cx="100" cy="136" rx="9" ry="11" fill="${INK}"/>`
      default: return `<path d="M88 130 q12 14 24 0" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>`
    }
  }

  function extras (mood, c) {
    if (mood === 'sleepy') {
      return `<g fill="${INK}" opacity=".55" font-family="ui-rounded, system-ui" font-weight="700">
        <text x="150" y="70" font-size="20">z</text><text x="165" y="48" font-size="14">z</text></g>`
    }
    if (mood === 'stern' || mood === 'feral') {
      return `<path d="M150 86 q7 12 0 16 q-7 -4 0 -16z" fill="#8ad6ff" opacity=".9"/>`
    }
    return ''
  }

  function render (char, mood = 'sweet') {
    const c = char
    const blushY = c.form === 'square' ? 128 : 126
    return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" class="geep-char" aria-hidden="true">
      <ellipse cx="100" cy="176" rx="46" ry="8" fill="#000" opacity=".12"/>
      ${ears(c.ears, c)}
      <g fill="${c.body}" stroke="${c.shade}" stroke-width="3">${bodyPath(c.form)}</g>
      <g fill="${c.accent}" opacity=".45"><ellipse cx="72" cy="${blushY}" rx="11" ry="7"/><ellipse cx="128" cy="${blushY}" rx="11" ry="7"/></g>
      ${eyes(mood, c)}
      ${mouth(mood)}
      ${hat(c.hat, c)}
      ${extras(mood, c)}
    </svg>`
  }

  // one character per night, rotating -- so no two evenings feel the same
  function pick (stamp) {
    const key = String(stamp || new Date().toDateString())
    let h = 0
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
    return CAST[h % CAST.length]
  }

  root.GEEP_CAST = { CAST, render, pick, INK }
})(window)
