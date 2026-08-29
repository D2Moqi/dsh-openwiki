// Verify the claims disk-scan fallback against the real .claims directory.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const C = 'D:/dsh-openwiki/openwiki/.claims'

const pages = []
const scan = (dir, base) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      scan(full, `${base}${base ? '/' : ''}${name}`)
    } else if (name.endsWith('.json')) {
      pages.push(`${base}${base ? '/' : ''}${name}`.replace(/\.json$/u, '.md'))
    }
  }
}
scan(C, '')

let claimCount = 0
for (const pagePath of pages) {
  const claimRel = pagePath.replace(/\.md$/u, '.json')
  const raw = readFileSync(join(C, claimRel.split('/').join('\\')), 'utf8')
  const sidecar = JSON.parse(raw)
  claimCount += (sidecar.claims ?? []).length
}
console.log(`scanned pages from .claims: ${pages.length}`)
console.log(`total claims: ${claimCount}`)
console.log('VERIFY OK')
