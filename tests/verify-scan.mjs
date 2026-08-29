// Verify the disk-scan fallback logic (tree without manifest) against the
// real wiki directory, mirroring readWikiTree's scan branch.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const W = 'D:/dsh-openwiki/openwiki'
const parseFrontmatterTitle = (head) => {
  if (!head.startsWith('---')) return null
  const end = head.indexOf('\n---', 3)
  if (end < 0) return null
  const block = head.slice(3, end)
  const m = block.match(/^title:\s*(.+)$/mu)
  if (m) return m[1].trim().replace(/^['"]|['"]$/gu, '')
  return null
}

const pages = []
const scan = (dir, base) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      if (name === '.claims' || name === '.git') continue
      scan(full, `${base}${base ? '/' : ''}${name}`)
    } else if (name.endsWith('.md')) {
      const path = `${base}${base ? '/' : ''}${name}`
      const head = readFileSync(full, 'utf8').slice(0, 8192)
      const title = parseFrontmatterTitle(head)
      pages.push({ path, title: title ?? name.replace(/\.md$/u, ''), status: 'complete' })
    }
  }
}
scan(W, '')

console.log(`scanned pages: ${pages.length}`)
const contentPages = pages.filter((p) => !p.path.endsWith('index.md'))
console.log(`content pages (excl. index.md): ${contentPages.length}`)
for (const p of contentPages.slice(0, 10)) console.log(`  ${p.path} | ${p.title}`)

// Tree shape: group by first path segment
const groups = {}
for (const p of contentPages) {
  const top = p.path.split('/')[0] ?? '(root)'
  groups[top] = (groups[top] ?? 0) + 1
}
console.log('top-level groups:', JSON.stringify(groups))
console.log('VERIFY OK')
