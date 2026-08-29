// GUI verification v2: DOM assertions + console error capture.
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
  if (msg.type() === 'error' || msg.type() === 'warning') consoleErrors.push(`[${msg.type()}] ${msg.text().slice(0, 300)}`)
})
page.on('pageerror', (err) => consoleErrors.push(`[pageerror] ${String(err).slice(0, 300)}`))

const BASE = process.env.DSH_GUI_BASE || 'http://127.0.0.1:3080'

try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(8000)
  await page.screenshot({ path: join(shots, 'v2-01-main.png') })

  // Sidebar entry
  const entryCount = await page.locator('button.owk-entry').count()
  check('sidebar openwiki entry present', entryCount > 0)
  const entryText = entryCount > 0 ? await page.locator('button.owk-entry').first().innerText() : ''
  console.log(`  entry text: "${entryText}"`)

  // Click entry and inspect overlay state
  await page.locator('button.owk-entry').first().click()
  await page.waitForTimeout(3000)
  const overlayCount = await page.locator('.owk-overlay').count()
  check('overlay element in DOM', overlayCount > 0)
  if (overlayCount > 0) {
    const visible = await page.locator('.owk-overlay').first().isVisible().catch(() => false)
    check('overlay visible', visible)
    const headerText = await page.locator('.owk-overlay-header').first().innerText().catch(() => '')
    console.log(`  overlay header: "${headerText.slice(0, 120)}"`)
  }
  await page.screenshot({ path: join(shots, 'v2-02-overlay.png') })

  // Workspace select
  const wsOptions = await page.locator('.owk-kb-left select option').allTextContents()
  check(`workspace select options (${wsOptions.length})`, wsOptions.length > 0)
  console.log(`  options: ${wsOptions.join(', ')}`)
  await page.waitForTimeout(5000)
  const treeCount = await page.locator('.owk-tree-item').count()
  check(`tree items (${treeCount})`, treeCount > 5)
  await page.screenshot({ path: join(shots, 'v2-03-tree.png') })

  // Open 系统总览 doc
  const docBtn = page.locator('.owk-tree-item', { hasText: '系统总览' }).first()
  if (await docBtn.count()) {
    await docBtn.click()
    await page.waitForTimeout(3000)
    const docText = await page.locator('.owk-doc').innerText().catch(() => '')
    check(`doc preview text length (${docText.length})`, docText.length > 200)
    // Chapter sources live in the view-switch toolbar above .owk-doc.
    const rightText = await page.locator('.owk-kb-right').innerText().catch(() => '')
    check('chapter sources shown', rightText.includes('章节来源'))
    await page.screenshot({ path: join(shots, 'v2-04-doc.png') })
    // view switch buttons
    for (const v of ['代码', '目录', '预览']) {
      const btn = page.locator('.owk-kb-right button', { hasText: v }).first()
      if (await btn.count()) {
        await btn.click()
        await page.waitForTimeout(600)
        console.log(`  switched to ${v} view`)
      }
    }
    await page.screenshot({ path: join(shots, 'v2-05-views.png') })
  } else {
    check('doc open', false)
  }

  // Cards
  const cardsBtn = page.locator('.owk-kb-left button', { hasText: '知识卡片' }).first()
  if (await cardsBtn.count()) {
    await cardsBtn.click()
    await page.waitForTimeout(3000)
    const claims = await page.locator('.owk-claim').count()
    check(`knowledge cards (${claims})`, claims > 5)
    await page.screenshot({ path: join(shots, 'v2-06-cards.png') })
    const wikiBtn = page.locator('.owk-kb-left button', { hasText: 'Repo Wiki' }).first()
    if (await wikiBtn.count()) await wikiBtn.click()
  } else {
    check('knowledge cards tab', false)
  }

  // Ignore editor
  const ignBtn = page.locator('.owk-kb-left button', { hasText: '忽略文件' }).first()
  if (await ignBtn.count()) {
    await ignBtn.click()
    await page.waitForTimeout(1500)
    const ta = page.locator('.owk-kb-left textarea')
    check('ignore editor textarea', await ta.count() > 0)
    await page.screenshot({ path: join(shots, 'v2-07-ignore.png') })
  } else {
    check('ignore editor', false)
  }

  // Close overlay
  const closeBtn = page.locator('.owk-overlay-header button', { hasText: '关闭' }).first()
  if (await closeBtn.count()) {
    await closeBtn.click()
    await page.waitForTimeout(1000)
    check('overlay closed', (await page.locator('.owk-overlay').count()) === 0)
  } else {
    check('overlay close button', false)
  }

  // Settings section
  const settingsTriggers = page.locator('button', { hasText: '设置' })
  console.log(`  settings triggers: ${await settingsTriggers.count()}`)
  const settBtn = settingsTriggers.first()
  if (await settBtn.count()) {
    await settBtn.click()
    await page.waitForTimeout(2000)
    await page.screenshot({ path: join(shots, 'v2-08-settings-open.png') })
    const nav = page.locator('div', { hasText: 'openwiki' }).first()
    console.log(`  settings nav candidates: ${await page.locator('text=openwiki').count()}`)
    const owNav = page.locator('text=openwiki').first()
    if (await owNav.count()) {
      await owNav.click()
      await page.waitForTimeout(2500)
      const body = await page.locator('body').innerText()
      check('settings runtime card', body.includes('运行时') && body.includes('已安装'))
      check('settings model card', body.includes('模型（DSH 复用'))
      // refresh to load runtime/model data
      const refresh = page.locator('button', { hasText: '刷新' }).first()
      if (await refresh.count()) { await refresh.click(); await page.waitForTimeout(2500) }
      await page.screenshot({ path: join(shots, 'v2-09-settings-openwiki.png') })
      const body2 = await page.locator('body').innerText()
      check('runtime status loaded', /0\.4\.3|deepseek|openai-compatible/.test(body2))
    } else {
      check('settings openwiki nav', false)
    }
  } else {
    check('settings trigger', false)
  }

  // Conversation view tab
  const tabs = await page.locator('[role="tablist"] button').allTextContents()
  check(`view tabs (${tabs.join('|')})`, tabs.some((t) => t.includes('openwiki')))
} catch (err) {
  results.push(`ERROR  ${String(err && err.message ? err.message : err)}`)
  console.log('ERROR', String(err && err.message ? err.message : err))
  await page.screenshot({ path: join(shots, 'v2-99-error.png') }).catch(() => {})
}

console.log('\n=== console errors/warnings ===')
if (consoleErrors.length === 0) console.log('(none)')
for (const e of consoleErrors.slice(0, 15)) console.log(e)

await browser.close()
const fails = results.filter((r) => r.startsWith('FAIL') || r.startsWith('ERROR')).length
console.log(fails === 0 ? '\nALL CHECKS PASSED' : `\n${fails} failures`)
process.exit(fails === 0 ? 0 : 1)
