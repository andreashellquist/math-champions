import { readFile, access } from 'node:fs/promises'
import { resolve } from 'node:path'

const dist = resolve('dist')
const read = file => readFile(resolve(dist, file), 'utf8')

const [html, manifestText, worker] = await Promise.all([
  read('index.html'),
  read('manifest.webmanifest'),
  read('sw.js'),
])

const manifest = JSON.parse(manifestText)
if (manifest.display !== 'standalone' || manifest.start_url !== '/') {
  throw new Error('PWA manifest no longer launches as a standalone app from /')
}

for (const icon of manifest.icons ?? []) await access(resolve(dist, icon.src))

const shellAssets = [...html.matchAll(/(?:src|href)="\/?([^"?#]+\.(?:js|css))"/g)].map(match => match[1])
if (!shellAssets.length) throw new Error('No built JavaScript or CSS assets found in index.html')

for (const asset of ['index.html', 'manifest.webmanifest', ...shellAssets]) {
  await access(resolve(dist, asset))
  if (!worker.includes(asset)) throw new Error(`${asset} is missing from the service-worker precache`)
}

console.log(`PWA shell verified: ${shellAssets.length} built assets and ${manifest.icons.length} icons`)
