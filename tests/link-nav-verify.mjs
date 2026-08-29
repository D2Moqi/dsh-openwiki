// Link navigation focus check: open 系统总览, click an internal link, assert the
// target doc renders (not "页面不存在") and screenshot.
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
const check = (label, cond) => { results.push(`${cond ? 'PASS' : 'FAIL'} ${label}`); console.log(`${cond ? 'PASS' : 'FAIL'} ${label}`) }
try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(8000)
  await page.locator('button.owk-entry').first().click()
  await page.waitForTimeout(2000)
  const targetWs = page.locator('.owk-wsitem', { hasText: 'dsh-openwiki' }).first()
  await targetWs.click()
  await page.waitForTimeout(5000)
  const docBtn = page.locator('.owk-tree-item', { hasText: '系统总览' }).first()
  await docBtn.click()
  await page.waitForTimeout(2500)
  const wl = page.locator('.owk-wiki-link')
  check('in-doc links present', await wl.count() > 0)
  const before = page.url()
  await wl.first().click()
  await page.waitForTimeout(1500)
  check('page URL unchanged', page.url() === before)
  // The opened tab should now render content (a view-switch toolbar appears only
  // when the page loaded successfully).
  const hasViewSwitch = await page.locator('.owk-kb-right button', { hasText: '预览' }).count()
  check('target doc renders (view switch present)', hasViewSwitch > 0)
  const bodyHasMiss = (await page.locator('.owk-kb-right').innerText()).includes('页面不存在')
  check('target doc not "页面不存在"', !bodyHasMiss)
  await page.screenshot({ path: join(shots, 'r-05b-link.png') })
  // Capture which doc tab is active and its title area.
  const tabsText = await page.locator('.owk-kb-right').innerText()
  console.log('  right panel:', tabsText.replace(/\n/g, ' | ').slice(0, 120))
} catch (err) {
  results.push(`ERROR ${String(err && err.message ? err.message : err)}`); console.log('ERROR', String(err && err.message ? err.message : err))
}
await browser.close()
const fails = results.filter((r) => r.startsWith('FAIL') || r.startsWith('ERROR')).length
console.log(fails === 0 ? '\nALL CHECKS PASSED' : `\n${fails} failures`)
process.exit(fails === 0 ? 0 : 1)
