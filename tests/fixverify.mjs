// Fix verification: no "生成中" mislabel, left panel no path, page loads.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const require = createRequire('C:/nvm4w/nodejs/package.json')
const { chromium } = require('playwright-core')
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const shots = join(root, 'tests', 'screenshots')
mkdirSync(shots, { recursive: true })
const BASE = process.env.DSH_GUI_BASE || 'http://127.0.0.1:3080'
const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const results = []
const check = (l, c) => { results.push(`${c ? 'PASS' : 'FAIL'} ${l}`); console.log(`${c ? 'PASS' : 'FAIL'} ${l}`) }
const errs = []
page.on('pageerror', (e) => errs.push(String(e)))
const cErrs = []
page.on('console', (m) => { if (m.type() === 'error') cErrs.push(m.text().slice(0, 200)) })
try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(9000)
  await page.locator('button.owk-entry').first().click()
  await page.waitForTimeout(2500)
  const tgt = page.locator('.owk-wsitem', { hasText: 'dsh-openwiki' }).first()
  if (await tgt.count()) { await tgt.click(); await page.waitForTimeout(4000) }

  // (2) Status card shows 已生成, not 生成中
  const right = await page.locator('.owk-kb-right').innerText()
  check('status card not 生成中', !right.includes('生成中'))
  check('status card 已生成', right.includes('已生成'))

  // (3) Left panel does NOT show workspace path
  const left = await page.locator('.owk-kb-left').innerText()
  check('left does NOT show workspace path', !left.includes('D:\\dsh-openwiki'))
  check('left has no .owk-wsinfo', await page.locator('.owk-wsinfo').count() === 0)

  // (1) Page renders (not stuck/blank)
  const statusOk = right.includes('文件数')
  check('status card renders', statusOk)
  await page.screenshot({ path: join(shots, 'r3-01-fix.png') })

  // Open the index doc to confirm docs are readable (no freeze)
  const idx = page.locator('.owk-tree-item:not(.owk-tree-dir)', { hasText: /^index$/ }).first()
  if (await idx.count()) { await idx.click(); await page.waitForTimeout(2500) }
  const docText = await page.locator('.owk-doc').innerText().catch(() => '')
  check('index doc opens', docText.length > 0)
  await page.screenshot({ path: join(shots, 'r3-02-index.png') })
} catch (err) {
  results.push(`ERROR ${String(err && err.message ? err.message : err)}`); console.log('ERROR', String(err && err.message ? err.message : err))
  await page.screenshot({ path: join(shots, 'r3-99-error.png') }).catch(() => {})
}
console.log('pageerrors:', errs.length ? errs.join(' | ') : '(none)')
console.log('consoleErrors:', cErrs.length ? cErrs.slice(0, 8).join(' | ') : '(none)')
await browser.close()
const fails = results.filter((r) => r.startsWith('FAIL') || r.startsWith('ERROR')).length
console.log(fails === 0 ? '\nALL CHECKS PASSED' : `\n${fails} failures`)
process.exit(fails === 0 ? 0 : 1)
