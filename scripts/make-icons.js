'use strict'
// Tiny PNG writer so geep ships with a tray icon + app icon without any
// image dependencies. Draws a sleepy blob with a nightcap.
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

function crc32 (buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1))
  }
  return ~c >>> 0
}

function chunk (type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function writePng (file, size, painter) {
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1)
    raw[row] = 0
    for (let x = 0; x < size; x++) {
      const px = painter(x / size, y / size) || [0, 0, 0, 0]
      const o = row + 1 + x * 4
      raw[o] = px[0]; raw[o + 1] = px[1]; raw[o + 2] = px[2]; raw[o + 3] = px[3]
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, png)
  return file
}

const dist = (x, y, cx, cy) => Math.hypot(x - cx, y - cy)
// soft edge so the little guy isn't a staircase
const cover = (d, r, feather = 0.012) => Math.min(1, Math.max(0, (r - d) / feather))

function blobAlpha (x, y) {
  // body
  let a = cover(dist(x, y, 0.5, 0.58), 0.33)
  // nightcap
  const capTop = 0.30 + Math.abs(x - 0.5) * 0.9
  if (y > capTop - 0.16 && y < 0.40 && Math.abs(x - 0.5) < 0.34) a = Math.max(a, 1)
  a = Math.max(a, cover(dist(x, y, 0.5, 0.13), 0.065)) // pompom
  return a
}

function eyesAlpha (x, y) {
  // closed, content little eyes  ^  ^
  const eye = (cx) => {
    const dx = Math.abs(x - cx)
    const curve = 0.60 - (0.06 - dx) * 0.55
    return dx < 0.065 && Math.abs(y - curve) < 0.018 ? 1 : 0
  }
  return Math.max(eye(0.39), eye(0.61))
}

// macOS template image: black + alpha only, the OS recolours it
const template = (x, y) => {
  const a = blobAlpha(x, y)
  if (!a) return [0, 0, 0, 0]
  const e = eyesAlpha(x, y)
  return [0, 0, 0, Math.round(255 * (e ? a * 0.25 : a))]
}

const colour = (x, y) => {
  const a = blobAlpha(x, y)
  if (!a) return [0, 0, 0, 0]
  if (eyesAlpha(x, y)) return [58, 32, 84, Math.round(255 * a)]
  const isCap = y < 0.40 && Math.abs(x - 0.5) < 0.34
  const pom = dist(x, y, 0.5, 0.13) < 0.07
  if (pom) return [255, 240, 246, Math.round(255 * a)]
  if (isCap) return [255, 137, 176, Math.round(255 * a)]
  const t = (y - 0.25) / 0.7
  return [
    Math.round(190 + 45 * (1 - t)),
    Math.round(178 + 30 * (1 - t)),
    Math.round(255 - 10 * t),
    Math.round(255 * a)
  ]
}

const root = path.join(__dirname, '..')
const withBg = (x, y) => {
  const c = colour(x, y)
  const bg = [46, 30, 74, 255]
  const a = c[3] / 255
  return [
    Math.round(c[0] * a + bg[0] * (1 - a)),
    Math.round(c[1] * a + bg[1] * (1 - a)),
    Math.round(c[2] * a + bg[2] * (1 - a)),
    255
  ]
}

writePng(path.join(root, 'assets', 'trayTemplate.png'), 22, template)
writePng(path.join(root, 'assets', 'trayTemplate@2x.png'), 44, template)
writePng(path.join(root, 'assets', 'geep.png'), 256, colour)
writePng(path.join(root, 'build', 'icon.png'), 1024, withBg)
console.log('icons written')
