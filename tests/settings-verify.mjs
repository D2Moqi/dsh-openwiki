// Settings-section verification: open settings, click the openwiki nav item,
// assert runtime + model cards.
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

const results = []
const check = (label, cond) => { results.push(`${cond ? 'PASS' : 'FAIL'}  ${label}`); console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`) }

const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(6000)
  // Open settings (footer trigger shows "设置").
  const sett = page.locator('button', { hasText: '设置' }).first()
  if (await sett.count()) { await sett.click(); await page.waitForTimeout(2000) }
  check('settings panel opened', await page.locator('text=设置').count() > 0)

  // Click the "openwiki" nav item inside the settings modal (role=button,
  // exact — excludes the explorer file "openwiki" and "dsh-openwiki").
  const owNav = page.getByRole('button', { name: 'openwiki', exact: true })
  check('openwiki nav present', await owNav.count() > 0)
  await owNav.click()
  await page.waitForTimeout(3000)
  await page.screenshot({ path: join(shots, 'v3-settings-openwiki.png') })

  const body = await page.locator('body').innerText()
  check('runtime card (运行时)', body.includes('运行时'))
  check('runtime version loaded', /v0\.4\.3|已安装/.test(body))
  check('model card (模型（DSH 复用', body.includes('模型（DSH 复用'))
  check('model mapped (openai-compatible)', body.includes('openai-compatible'))
  check('model selection (deepseek-v4-flash)', body.includes('deepseek-v4-flash'))
  check('key configured', body.includes('已解析'))
  check('.env present', body.includes('.openwiki'))

  // Click 刷新 to refresh runtime/model data
  const refresh = page.locator('button', { hasText: '刷新' }).first()
  if (await refresh.count()) { await refresh.click(); await page.waitForTimeout(2500) }
  await page.screenshot({ path: join(shots, 'v3-settings-openwiki-refresh.png') })
} catch (err) {
  results.push(`ERROR  ${String(err && err.message ? err.message : err)}`)
  console.log('ERROR', String(err && err.message ? err.message : err))
  await page.screenshot({ path: join(shots, 'v3-error.png') }).catch(() => {})
}
await browser.close()
const fails = results.filter((r) => r.startsWith('FAIL') || r.startsWith('ERROR')).length
console.log(fails === 0 ? '\nALL CHECKS PASSED' : `\n${fails} failures`)
process.exit(fails === 0 ? 0 : 1)
