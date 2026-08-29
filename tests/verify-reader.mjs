// Offline verification of M3 WikiReader parsing against the real generated wiki.
import { readFileSync } from 'node:fs'

const W = 'D:/dsh-openwiki/plugins/dsh-hello-world/openwiki'
const sep = '/'

const parseFrontmatterTitle = (head) => {
  if (!head.startsWith('---')) return null
  const end = head.indexOf('\n---', 3)
  if (end < 0) return null
  const block = head.slice(3, end)
  const m = block.match(/^title:\s*(.+)$/mu)
  if (m) return m[1].trim().replace(/^['"]|['"]$/gu, '')
  return null
}

// 1) manifest → pages
const manifest = JSON.parse(readFileSync(`${W}/.page-manifest.json`, 'utf8'))
const pages = []
for (const [rel, meta] of Object.entries(manifest.pages ?? {})) {
  const path = String(rel).replace(/^\/openwiki\//u, '').replace(/^\//u, '')
  const head = readFileSync(`${W}/${path}`, 'utf8').slice(0, 8192)
  const title = parseFrontmatterTitle(head)
  pages.push({ path, title: title ?? path.split(/[\\/]/u).pop().replace(/\.md$/u, ''), completedBy: meta.completedBy })
}
console.log('PAGES:', pages.length)
for (const p of pages) console.log(`  ${p.path} | ${p.title} | ${p.completedBy}`)

// 2) claims derivation
let claimCount = 0
for (const p of pages) {
  const claimRel = p.path.replace(/\.md$/u, '.json')
  const raw = readFileSync(`${W}/.claims/${claimRel}`, 'utf8')
  const sidecar = JSON.parse(raw)
  claimCount += (sidecar.claims ?? []).length
}
console.log('CLAIMS total:', claimCount)

// 3) overview data
const last = JSON.parse(readFileSync(`${W}/.last-update.json`, 'utf8'))
console.log('LAST-UPDATE:', JSON.stringify(last))
console.log('run.json exists:', (() => { try { readFileSync(`${W}/.run.json`); return true } catch { return false } })())

// 4) page body/frontmatter split
const content = readFileSync(`${W}/quickstart.md`, 'utf8')
let body = content
if (content.startsWith('---')) {
  const end = content.indexOf('\n---', 3)
  body = content.slice(end + 5)
}
console.log('BODY first line:', body.trim().split('\n')[0])
console.log('VERIFY OK')
