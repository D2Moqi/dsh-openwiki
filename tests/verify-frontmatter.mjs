// Offline verification: structured frontmatter parser vs real page.
import { readFileSync } from 'node:fs'

const parseFrontmatter = (content) => {
  if (!content.startsWith('---')) return null
  const end = content.indexOf('\n---', 3)
  if (end < 0) return null
  const block = content.slice(3, end)
  const fm = {}
  let currentKey = null
  for (const rawLine of block.split(/\r?\n/u)) {
    const line = rawLine.trim()
    if (line.length === 0 || line.startsWith('#')) continue
    const listMatch = line.match(/^-\s+(.*)$/u)
    if (listMatch && currentKey !== null) {
      if (currentKey === 'sources') continue
      let val = listMatch[1]
      const kvItem = val.match(/^[A-Za-z_-]+:\s*(.+)$/u)
      if (kvItem) val = kvItem[1]
      val = val.replace(/^['"]|['"]$/gu, '').trim()
      if (!Array.isArray(fm[currentKey])) fm[currentKey] = []
      fm[currentKey].push(val)
      continue
    }
    const kv = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/u)
    if (kv) {
      if (currentKey === 'sources' && kv[1] === 'resource') {
        const res = kv[2].trim().replace(/^['"]|['"]$/gu, '')
        if (!Array.isArray(fm.sources)) fm.sources = []
        fm.sources.push(res)
        continue
      }
      currentKey = kv[1]
      const rawVal = kv[2].trim()
      if (rawVal.length === 0) {
        fm[currentKey] = []
      } else {
        const inline = rawVal.match(/^\[(.*)\]$/u)
        if (inline) {
          fm[currentKey] = inline[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/gu, '')).filter((s) => s.length > 0)
        } else {
          const unquoted = rawVal.replace(/^['"]|['"]$/gu, '')
          if (unquoted === 'true') fm[currentKey] = true
          else if (unquoted === 'false') fm[currentKey] = false
          else if (/^\d+$/u.test(unquoted)) fm[currentKey] = Number(unquoted)
          else fm[currentKey] = unquoted
        }
      }
    }
  }
  return Object.keys(fm).length > 0 ? fm : null
}

const content = readFileSync('D:/dsh-openwiki/plugins/dsh-hello-world/openwiki/quickstart.md', 'utf8')
const fm = parseFrontmatter(content)
console.log('title:', fm.title)
console.log('type:', fm.type)
console.log('tags:', JSON.stringify(fm.tags))
console.log('sources:', fm.sources.length, 'items, first:', fm.sources[0])
console.log('verified:', JSON.stringify(fm.verified).slice(0, 80))
console.log('generated:', String(fm.generated).slice(0, 60))
console.log('VERIFY OK')
