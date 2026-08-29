// Verify better-sidebar auto-register persists across a page refresh: after
// reload, the openwiki sidebar page is registered (settings shows 已注册侧边页)
// WITHOUT clicking the register button.
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
try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(9000)
  // Navigate to settings -> openwiki and check the register button state.
  const sett = page.locator('button', { hasText: '设置' }).first()
  if (await sett.count()) { await sett.click(); await page.waitForTimeout(2000) }
  await page.getByRole('button', { name: 'openwiki', exact: true }).click()
  await page.waitForTimeout(3000)
  const body = await page.locator('body').innerText()
  check('better-sidebar connected', body.includes('已连接 dsh-better-sidebar'))
  const fresh = body.includes('已注册侧边页')
  check('auto-registered on first load (已注册侧边页)', fresh)

  // RELOAD the page; auto-register must re-register without any click.
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(10000)
  const sett2 = page.locator('button', { hasText: '设置' }).first()
  if (await sett2.count()) { await sett2.click(); await page.waitForTimeout(2000) }
  await page.getByRole('button', { name: 'openwiki', exact: true }).click()
  await page.waitForTimeout(3000)
  const body2 = await page.locator('body').innerText()
  const fresh2 = body2.includes('已注册侧边页')
  check('still registered after refresh (已注册侧边页)', fresh2)
  await page.screenshot({ path: join(shots, 'r2-06-autoreg.png') })
} catch (err) {
  results.push(`ERROR ${String(err && err.message ? err.message : err)}`); console.log('ERROR', String(err && err.message ? err.message : err))
}
console.log('pageerrors:', errs.length ? errs.join(' | ') : '(none)')
await browser.close()
const fails = results.filter((r) => r.startsWith('FAIL') || r.startsWith('ERROR')).length
console.log(fails === 0 ? '\nALL CHECKS PASSED' : `\n${fails} failures`)
process.exit(fails === 0 ? 0 : 1)
