// Redesign verification: 7 requested changes, DOM assertions + screenshots.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire('C:/nvm4w/nodejs/package.json')
const { chromium } = require('playwright-core')

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const shots = join(root, 'tests', 'screenshots')
mkdirSync(shots, { recursive: true })

const results = []
const check = (label, cond) => {
  results.push(`${cond ? 'PASS' : 'FAIL'}  ${label}`)
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`)
}

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

const consoleErrors = []
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(`[error] ${msg.text().slice(0, 200)}`)
})
page.on('pageerror', (err) => consoleErrors.push(`[pageerror] ${String(err).slice(0, 200)}`))

const BASE = process.env.DSH_GUI_BASE || 'http://127.0.0.1:3080'

try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(8000)
  await page.screenshot({ path: join(shots, 'r-01-main.png') })

  // ---- #5: entry visibility switch (default ON) ----
  const entryCount = await page.locator('button.owk-entry').count()
  check('sidebar openwiki entry present (default ON)', entryCount > 0)

  // Open knowledge base window
  if (entryCount > 0) await page.locator('button.owk-entry').first().click()
  await page.waitForTimeout(2500)

  // ---- #1: floating window (draggable/resizable), not fullscreen overlay ----
  const winCount = await page.locator('.owk-win').count()
  check('floating .owk-win present', winCount > 0)
  if (winCount > 0) {
    const box = await page.locator('.owk-win').first().boundingBox()
    check(`floating window NOT fullscreen (w=${box && box.width}, h=${box && box.height})`, box && box.width < 1440 && box.height < 900)
    // Header drag handle exists
    const header = await page.locator('.owk-win-header').count()
    check('window drag header present', header > 0)
    // Resize handle exists
    const resize = await page.locator('.owk-win-resize').count()
    check('window resize handle present', resize > 0)
    // Maximize toggle button
    const maxBtn = page.locator('.owk-win-header button', { hasText: '□' }).first()
    check('window maximize button present', await maxBtn.count() > 0)
  }
  const oldOverlay = await page.locator('.owk-overlay').count()
  check('no full-screen .owk-overlay used', oldOverlay === 0)
  await page.screenshot({ path: join(shots, 'r-02-window.png') })

  // ---- #7: workspace list in left panel (replaces select dropdown) ----
  const wsList = await page.locator('.owk-wsitem').count()
  check(`workspace list items (${wsList})`, wsList > 0)
  const selects = await page.locator('.owk-kb-left select').count()
  check('no select dropdown for workspace', selects === 0)
  // Select the dsh-openwiki workspace (the one with generated docs).
  const targetWs = page.locator('.owk-wsitem', { hasText: 'dsh-openwiki' }).first()
  if (await targetWs.count()) {
    await targetWs.click()
    await page.waitForTimeout(2500)
  }
  const wsInfo = await page.locator('.owk-wsinfo').innerText().catch(() => '')
  console.log(`  ws info: "${wsInfo.slice(0, 80)}"`)
  check('workspace info shown after select', wsInfo.length > 0)

  await page.waitForTimeout(5000)

  // ---- #3: collapsible tree ----
  const treeItems = await page.locator('.owk-tree-item').count()
  check(`tree items present (${treeItems})`, treeItems > 0)
  const dirItems = await page.locator('.owk-tree-item.owk-tree-dir').count()
  check(`collapsible dir nodes (${dirItems})`, dirItems > 0)
  // Collapse first dir, verify its children hide
  const firstDir = page.locator('.owk-tree-item.owk-tree-dir').first()
  if (await firstDir.count()) {
    const beforeCount = await page.locator('.owk-tree-item').count()
    await firstDir.click()
    await page.waitForTimeout(400)
    const afterCount = await page.locator('.owk-tree-item').count()
    check(`collapse dir reduces items (${beforeCount} -> ${afterCount})`, afterCount < beforeCount)
    await firstDir.click()
    await page.waitForTimeout(400)
  }
  await page.screenshot({ path: join(shots, 'r-03-tree.png') })

  // ---- #2: two persistent mode tabs with selected state ----
  const tabCount = await page.locator('.owk-tab').count()
  check(`two mode tabs (${tabCount})`, tabCount === 2)
  const wikiTabSel = await page.locator('.owk-tab.sel', { hasText: 'Repo Wiki' }).count()
  check('Repo Wiki tab selected by default', wikiTabSel > 0)
  await page.screenshot({ path: join(shots, 'r-04-tabs.png') })

  // ---- #6: no "更新" regenerate button, but "生成" when no wiki ----
  // (Workspace has wiki content; the update button should be gone.)
  const kbbody = await page.locator('.owk-kb-right').innerText().catch(() => '')
  const hasUpdateBtn = await page.locator('.owk-kb-right button', { hasText: /^更新$/ }).count()
  check('no "更新" regenerate button', hasUpdateBtn === 0)
  console.log(`  right panel snippet: "${kbbody.slice(0, 120)}"`)

  // Open a doc and verify links navigate in-app (#4)
  const docBtn = page.locator('.owk-tree-item', { hasText: '系统总览' }).first()
  if (await docBtn.count()) {
    await docBtn.click()
    await page.waitForTimeout(2500)
    await page.screenshot({ path: join(shots, 'r-05-doc.png') })
    // Look for an internal wiki link (should render as .owk-wiki-link)
    const wl = await page.locator('.owk-wiki-link').count()
    check(`in-doc links present (${wl})`, wl > 0)
    if (wl > 0) {
      const firstLinkText = await page.locator('.owk-wiki-link').first().innerText().catch(() => '')
      console.log(`  first link text: "${firstLinkText}"`)
      // Clicking an internal link should open a page in-app (not navigate away)
      const urlBefore = page.url()
      await page.locator('.owk-wiki-link').first().click()
      await page.waitForTimeout(1500)
      const urlAfter = page.url()
      check('clicking in-doc link keeps page in-app', urlAfter === urlBefore)
      const activeTabs = await page.locator('.owk-kb-right').innerText()
      console.log(`  after link click, tabs area: "${activeTabs.slice(0, 80)}"`)
    }
  }

  // ---- #5: settings page better-sidebar registration + entry switch ----
  // Close the floating window first so it cannot overlay/steal settings clicks.
  const closeWin = page.locator('.owk-win-header button', { hasText: '关闭' }).first()
  if (await closeWin.count()) { await closeWin.click(); await page.waitForTimeout(600) }
  const settBtn = page.locator('button', { hasText: '设置' }).first()
  if (await settBtn.count()) {
    await settBtn.click()
    await page.waitForTimeout(2000)
    const owNav = page.getByRole('button', { name: 'openwiki', exact: true })
    if (await owNav.count()) {
      await owNav.click()
      await page.waitForTimeout(2500)
      const body = await page.locator('body').innerText()
      check('settings has better-sidebar card', body.includes('侧边栏页面插件（dsh-better-sidebar）'))
      check('settings has entry-show card', body.includes('入口显示'))
      // better-sidebar detection status text
      const hasDetect = body.includes('已连接 dsh-better-sidebar') || body.includes('未检测到 dsh-better-sidebar')
      check('better-sidebar detection status shown', hasDetect)
      await page.screenshot({ path: join(shots, 'r-06-settings.png') })

      // ---- #5: entry switch toggles label ----
      const entrySwitch = page.locator('button', { hasText: /展示知识库入口|隐藏知识库入口/ }).first()
      check('entry visibility switch button present', await entrySwitch.count() > 0)
      if (await entrySwitch.count()) {
        const labelBefore = await entrySwitch.innerText()
        await entrySwitch.click()
        await page.waitForTimeout(400)
        const labelAfter = await page.locator('button', { hasText: /展示知识库入口|隐藏知识库入口/ }).first().innerText()
        check(`entry switch toggles (${labelBefore} -> ${labelAfter})`, labelBefore !== labelAfter)
        const current = await page.locator('button', { hasText: /展示知识库入口|隐藏知识库入口/ }).first().innerText()
        if (current.includes('隐藏')) await page.locator('button', { hasText: /展示知识库入口|隐藏知识库入口/ }).first().click()
        await page.waitForTimeout(300)
      }
    }
  }
} catch (err) {
  results.push(`ERROR  ${String(err && err.message ? err.message : err)}`)
  console.log('ERROR', String(err && err.message ? err.message : err))
  await page.screenshot({ path: join(shots, 'r-99-error.png') }).catch(() => {})
}

console.log('\n=== console errors ===')
if (consoleErrors.length === 0) console.log('(none)')
for (const e of consoleErrors.slice(0, 15)) console.log(e)

await browser.close()
const fails = results.filter((r) => r.startsWith('FAIL') || r.startsWith('ERROR')).length
console.log(fails === 0 ? '\nALL CHECKS PASSED' : `\n${fails} failures`)
process.exit(fails === 0 ? 0 : 1)
