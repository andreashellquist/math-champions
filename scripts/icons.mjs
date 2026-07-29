/**
 * Generate the PWA icon set from public/icon.svg.
 *
 *   npm run icons
 *
 * Committed output lives in public/, so a normal build needs no image
 * tooling — only re-run this when the source SVG changes.
 */
import sharp from 'sharp'
import { readFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const src = readFileSync(resolve(root, 'public/icon.svg'))
const PITCH = { r: 15, g: 74, b: 38 }

/** `pad` insets the artwork so a maskable icon survives Android's circle crop */
const TARGETS = [
  { file: 'icon-192.png', size: 192, pad: 0 },
  { file: 'icon-512.png', size: 512, pad: 0 },
  { file: 'icon-maskable-512.png', size: 512, pad: 0.1 },
  { file: 'apple-touch-icon.png', size: 180, pad: 0.06 },
  { file: 'favicon-32.png', size: 32, pad: 0 },
]

mkdirSync(resolve(root, 'public'), { recursive: true })

for (const { file, size, pad } of TARGETS) {
  const inner = Math.round(size * (1 - pad * 2))
  const offset = Math.round((size - inner) / 2)

  const art = await sharp(src, { density: 384 })
    .resize(inner, inner, { fit: 'contain', background: { ...PITCH, alpha: 1 } })
    .png()
    .toBuffer()

  await sharp({
    create: { width: size, height: size, channels: 4, background: { ...PITCH, alpha: 1 } },
  })
    .composite([{ input: art, top: offset, left: offset }])
    .png({ compressionLevel: 9, palette: true })
    .toFile(resolve(root, 'public', file))

  console.log(`✓ ${file} (${size}×${size})`)
}
