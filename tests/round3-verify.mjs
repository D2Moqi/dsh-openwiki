// Round-3 verify: toc popover, two-row buttons, probe feedback, trae gen error.
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
  await page.locator('button.owk-entry').first().click()
  await page.waitForTimeout(2500)
  await page.locator('.owk-wsitem', { hasText: 'dsh-openwiki' }).first().click()
  await page.waitForTimeout(4000)

  // (3) buttons in two rows: modeTabs row, then 忽略文件+刷新 row
  const tabsRow = page.locator('.owk-kb-left .owk-row').nth(1)
  const tabsTxt = await page.locator('.owk-kb-left .owk-tab').allInnerTexts()
  check(`mode tabs row (${tabsTxt.join(',')})`, tabsTxt.join(',') === 'Open Wiki,知识卡片')
  // The second row contains 忽略文件 and 刷新
  const rows = await page.locator('.owk-kb-left .owk-row').allInnerTexts()
  const actionRow = rows.find((t) => t.includes('忽略文件') && t.includes('刷新'))
  check('ignore+refresh share a row', !!actionRow)
  await page.screenshot({ path: join(shots, 'r4-01-buttons.png') })

  // (1) TOC popover: open a doc, click 目录, popover appears, click entry scrolls
  const docBtn = page.locator('.owk-tree-item', { hasText: '系统总览' }).first()
  if (await docBtn.count()) { await docBtn.click(); await page.waitForTimeout(2500) }
  const tocBtn = page.locator('.owk-kb-right button', { hasText: /^目录$/ }).first()
  check('目录 button present', await tocBtn.count() > 0)
  if (await tocBtn.count()) {
    // Split pane (not popover): hidden by default, shown on click
    check('toc pane hidden by default', (await page.locator('.owk-toc-pane').count()) === 0)
    await tocBtn.click(); await page.waitForTimeout(500)
    const pane = page.locator('.owk-toc-pane')
    check('toc pane opens', await pane.count() > 0)
    if (await pane.count()) {
      const itemCount = await pane.locator('.owk-tree-item').count()
      check(`toc entries (${itemCount})`, itemCount > 0)
      // own vertical scrollbar + sticky
      const css = await pane.evaluate((el) => {
        const cs = getComputedStyle(el)
        return { overflowY: cs.overflowY, position: cs.position, maxHeight: cs.maxHeight }
      })
      check(`toc pane own scrollbar (${css.overflowY}, ${css.maxHeight})`, css.overflowY === 'auto' && css.position === 'sticky')
      await page.screenshot({ path: join(shots, 'r4-02-toc.png') })
      // Click first entry: pane stays open, preview active
      await pane.locator('.owk-tree-item').first().click()
      await page.waitForTimeout(800)
      check('toc pane stays open after entry click', (await page.locator('.owk-toc-pane').count()) > 0)
      check('preview view active', await page.locator('.owk-kb-right button.owk-btn-primary', { hasText: /^预览$/ }).count() > 0)
      await page.screenshot({ path: join(shots, 'r4-03-toc-scroll.png') })
      // Toggle off hides it
      await tocBtn.click(); await page.waitForTimeout(400)
      check('toc pane hides on toggle', (await page.locator('.owk-toc-pane').count()) === 0)
    }
  }

  // (2) trae workspace gen error message
  await page.locator('.owk-wsitem', { hasText: 'trae' }).first().click()
  await page.waitForTimeout(3000)
  const genBtn = page.locator('.owk-kb-right button', { hasText: '生成' }).first()
  if (await genBtn.count()) {
    await genBtn.click()
    await page.waitForTimeout(2500)
    const body = await page.locator('.owk-kb-right').innerText()
    const hasError = body.includes('不是 git 仓库') || body.includes('生成失败') || body.includes('git 仓库')
    check('trae gen shows clear error', hasError)
    console.log('  trae error snippet:', body.replace(/\n/g,' | ').slice(0, 200))
    await page.screenshot({ path: join(shots, 'r4-04-trae-error.png') })
  } else {
    check('trae generate button', false)
  }
} catch (err) {
  results.push(`ERROR ${String(err && err.message ? err.message : err)}`); console.log('ERROR', String(err && err.message ? err.message : err))
  await page.screenshot({ path: join(shots, 'r4-99-error.png') }).catch(() => {})
}
console.log('pageerrors:', errs.length ? errs.join(' | ') : '(none)')
await browser.close()
const fails = results.filter((r) => r.startsWith('FAIL') || r.startsWith('ERROR')).length
console.log(fails === 0 ? '\nALL CHECKS PASSED' : `\n${fails} failures`)
process.exit(fails === 0 ? 0 : 1)
