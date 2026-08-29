// better-sidebar registration focus check: settings -> openwiki -> click register,
// assert the sidebar service registers an openwiki tab (visible in side card).
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
const errs = []
page.on('pageerror', (e) => errs.push(String(e)))
try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(8000)
  // Open settings
  const settBtn = page.locator('button', { hasText: '设置' }).first()
  if (await settBtn.count()) { await settBtn.click(); await page.waitForTimeout(2000) }
  const owNav = page.getByRole('button', { name: 'openwiki', exact: true })
  check('openwiki nav in settings', await owNav.count() > 0)
  await owNav.click()
  await page.waitForTimeout(2500)
  // Registration state
  const body = await page.locator('body').innerText()
  const connected = body.includes('已连接 dsh-better-sidebar')
  check('better-sidebar detected', connected)
  const regBtn = page.locator('button', { hasText: '注册侧边页面到 dsh-better-sidebar' })
  const already = await page.locator('button', { hasText: '已注册侧边页' }).count()
  check('register button present or already registered', (await regBtn.count()) > 0 || already > 0)
  if (await regBtn.count()) { await regBtn.click(); await page.waitForTimeout(1200) }
  // The button should now read "已注册侧边页" (or a check error surfaced)
  const body2 = await page.locator('body').innerText()
  const regWording = body2.includes('已注册侧边页')
  check('register succeeded (已注册侧边页)', regWording)
  await page.screenshot({ path: join(shots, 'r-07-settings-reg.png') })
} catch (err) {
  results.push(`ERROR ${String(err && err.message ? err.message : err)}`); console.log('ERROR', String(err && err.message ? err.message : err))
}
console.log('pageerrors:', errs.length ? errs.join(' | ') : '(none)')
await browser.close()
const fails = results.filter((r) => r.startsWith('FAIL') || r.startsWith('ERROR')).length
console.log(fails === 0 ? '\nALL CHECKS PASSED' : `\n${fails} failures`)
process.exit(fails === 0 ? 0 : 1)
