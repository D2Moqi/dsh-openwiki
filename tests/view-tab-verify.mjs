// Conversation view-tab verification: create/open a session, then check the
// session header view tabs include the openwiki view.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire('C:/nvm4w/nodejs/package.json')
const { chromium } = require('playwright-core')
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const shots = join(root, 'tests', 'screenshots')
mkdirSync(shots, { recursive: true })
const BASE = process.env.DSH_GUI_BASE || 'http://127.0.0.1:3081'

const results = []
const check = (label, cond) => { results.push(`${cond ? 'PASS' : 'FAIL'}  ${label}`); console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`) }

const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(6000)

  // Create/open a session by typing in the composer + sending (opens session).
  const composer = page.locator('textarea, [contenteditable="true"]').first()
  if (await composer.count() > 0) {
    await composer.click()
    await composer.pressSequentially('hi')
    await page.waitForTimeout(500)
    // press Enter to send (creates an active session)
    await composer.press('Enter')
    await page.waitForTimeout(3000)
    console.log('session opened (message sent)')
  } else {
    console.log('composer not found; trying session list')
    const sessionBtn = page.locator('text=新会话').first()
    if (await sessionBtn.count()) await sessionBtn.click()
    await page.waitForTimeout(3000)
  }

  // Check the session header view tabs.
  const tabs = await page.locator('[role="tablist"] button').allTextContents()
  check(`view tabs (${tabs.join('|')})`, tabs.length > 0)
  check('openwiki view tab present', tabs.some((t) => t.includes('openwiki')))
  await page.screenshot({ path: join(shots, 'v4-view-tabs.png') })

  // Click the openwiki view tab (if present) and assert the view renders.
  if (tabs.some((t) => t.includes('openwiki'))) {
    await page.locator('[role="tablist"] button', { hasText: 'openwiki' }).click()
    await page.waitForTimeout(3000)
    const kbBody = await page.locator('.owk-kb').count()
    check('openwiki view body renders', kbBody > 0)
    await page.screenshot({ path: join(shots, 'v4-view-openwiki.png') })
  }
} catch (err) {
  results.push(`ERROR  ${String(err && err.message ? err.message : err)}`)
  console.log('ERROR', String(err && err.message ? err.message : err))
  await page.screenshot({ path: join(shots, 'v4-error.png') }).catch(() => {})
}
await browser.close()
const fails = results.filter((r) => r.startsWith('FAIL') || r.startsWith('ERROR')).length
console.log(fails === 0 ? '\nALL CHECKS PASSED' : `\n${fails} failures`)
process.exit(fails === 0 ? 0 : 1)
