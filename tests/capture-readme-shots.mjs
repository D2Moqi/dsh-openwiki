// Capture README screenshots: element-only shots (no browser chrome) of the
// kb window, toc split pane, mode tabs, cards view, folder browse, settings.
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
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForTimeout(9000)
await page.locator('button.owk-entry').first().click()
await page.waitForTimeout(2500)

const snap = (sel, file) => page.locator(sel).first().screenshot({ path: join(shots, file), timeout: 10000 }).then(() => console.log('saved', file)).catch((e) => console.log('FAIL', sel, String(e).slice(0, 120)))

// kb window (workspace list + tree + status card)
await snap('.owk-win', 'readme-1-window.png')
// open a doc: 系统总览
const docBtn = page.locator('.owk-tree-item', { hasText: '系统总览' }).first()
if (await docBtn.count()) {
  await docBtn.click()
  await page.waitForTimeout(2500)
  await snap('.owk-win', 'readme-2-doc.png')
  // toc split pane
  await page.locator('.owk-kb-right button', { hasText: /^目录$/ }).first().click()
  await page.waitForTimeout(500)
  await snap('.owk-win', 'readme-3-toc.png')
  await page.locator('.owk-kb-right button', { hasText: /^目录$/ }).first().click()
  await page.waitForTimeout(300)
}
// mode tabs row (left column top)
await snap('.owk-kb-left', 'readme-4-left.png')
// cards view
const cardsTab = page.locator('.owk-tab', { hasText: '知识卡片' }).first()
if (await cardsTab.count()) {
  await cardsTab.click()
  await page.waitForTimeout(2500)
  await snap('.owk-win', 'readme-5-cards.png')
}
// folder browse: open index.md, click a folder link
const idxBtn = page.locator('.owk-tree-item', { hasText: /index/ }).first()
if (await idxBtn.count()) {
  await idxBtn.click()
  await page.waitForTimeout(2000)
  const folder = page.locator('.owk-wiki-link', { hasText: 'architecture' }).first()
  if (await folder.count()) {
    await folder.click()
    await page.waitForTimeout(1200)
    await snap('.owk-win', 'readme-6-folder.png')
  }
}
// settings page
const closeWin = page.locator('.owk-win-header button', { hasText: '关闭' }).first()
if (await closeWin.count()) { await closeWin.click(); await page.waitForTimeout(500) }
const sett = page.locator('button', { hasText: '设置' }).first()
if (await sett.count()) { await sett.click(); await page.waitForTimeout(2000) }
const owNav = page.getByRole('button', { name: 'openwiki', exact: true })
if (await owNav.count()) { await owNav.click(); await page.waitForTimeout(3000) }
await page.screenshot({ path: join(shots, 'readme-7-settings.png'), clip: { x: 270, y: 30, width: 900, height: 840 } }).then(() => console.log('saved readme-7-settings.png')).catch((e) => console.log('FAIL settings', String(e).slice(0, 120)))

await browser.close()
