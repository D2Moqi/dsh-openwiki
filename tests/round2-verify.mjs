// Round-2 redesign verification: button rename/order, right status overview,
// index/quickstart first, folder browse, auto-register, auto-update card.
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
page.on('console', (msg) => { if (msg.type() === 'error') errs.push(`console: ${msg.text().slice(0,200)}`) })
try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(9000)
  // Open the kb window
  const entry = page.locator('button.owk-entry').first()
  if (await entry.count()) await entry.click()
  await page.waitForTimeout(2500)

  // Select dsh-openwiki workspace
  const tgt = page.locator('.owk-wsitem', { hasText: 'dsh-openwiki' }).first()
  if (await tgt.count()) { await tgt.click(); await page.waitForTimeout(4000) }

  // ---- Button rename + order + no icon ----
  const tabs = await page.locator('.owk-tab').allInnerTexts()
  check(`mode tabs renamed (${tabs.join('|')})`, tabs.join(',') === 'Open Wiki,知识卡片')
  const orderInner = await page.locator('.owk-kb-left .owk-row').first().innerText()
  const hasNoEmoji = !/[📄🗂️]/.test(orderInner)
  check('mode buttons have no emoji icon', hasNoEmoji)
  const refreshPos = orderInner.indexOf('刷新')
  const ignorePos = orderInner.indexOf('忽略文件')
  const wikiPos = orderInner.indexOf('Open Wiki')
  check(`button order Open Wiki(${wikiPos}) < 忽略文件(${ignorePos}) < 刷新(${refreshPos})`, wikiPos >= 0 && ignorePos > wikiPos && refreshPos > ignorePos)
  await page.screenshot({ path: join(shots, 'r2-01-tabs.png') })

  // ---- index/quickstart first ----
  // Root-level index/quickstart render above the directory nodes. quickstart.md
  // carries a Chinese title (快速开始), so match that too.
  const rootTreeIdx = await page.locator('.owk-kb-left').innerText()
  const idxPos = rootTreeIdx.indexOf('index')
  const quickPos = rootTreeIdx.indexOf('快速开始')
  const dirPos = rootTreeIdx.indexOf('architecture')
  check('index/quickstart present in tree', idxPos >= 0 && quickPos >= 0)
  check('index/quickstart appear before dirs', (idxPos >= 0 && dirPos >= 0 && idxPos < dirPos))
  await page.screenshot({ path: join(shots, 'r2-02-tree.png') })

  // ---- Right status overview card ----
  const rightText = await page.locator('.owk-kb-right').innerText()
  check('right shows file count', rightText.includes('文件数'))
  check('right shows success', rightText.includes('成功'))
  check('right shows failure', rightText.includes('失败'))
  check('right shows update time', rightText.includes('更新时间') || rightText.includes('更新于'))
  check('right shows doc location', rightText.includes('文档位置'))
  check('right shows regenerate button', await page.locator('.owk-kb-right button', { hasText: '重新生成' }).count() > 0)
  await page.screenshot({ path: join(shots, 'r2-03-status.png') })

  // ---- Left ws info no longer shows 生成中/更新于 ----
  const leftWs = await page.locator('.owk-wsinfo').innerText().catch(() => '')
  check('left wsinfo does NOT show 生成中/更新于', !/生成中|更新于/.test(leftWs))

  // ---- Folder browse: open root index.md, click a folder link (architecture/) ----
  // Root index.md renders above the dirs, so the FIRST tree item is it (or the
  // first dir). Click the first .owk-tree-item that is a page (not a dir).
  const firstItems = page.locator('.owk-tree-item')
  const rootIndex = page.locator('.owk-tree-item:not(.owk-tree-dir)', { hasText: /index/ }).first()
  if (await rootIndex.count()) { await rootIndex.click(); await page.waitForTimeout(2000) }
  const anyFolder = page.locator('.owk-wiki-link', { hasText: /architecture/ }).first()
  if (await anyFolder.count()) {
    await anyFolder.click()
    await page.waitForTimeout(1500)
    const afterText = await page.locator('.owk-kb-right').innerText()
    const isBrowsing = afterText.includes('目录：') || await page.locator('.owk-kb-right button', { hasText: '返回' }).count() > 0
    check('clicking folder link shows folder browse', isBrowsing)
    await page.screenshot({ path: join(shots, 'r2-04-folder.png') })
  } else {
    check('folder browse triggered', false)
  }

  // ---- Settings: auto-update card ----
  // Close kb window first
  const closeWin = page.locator('.owk-win-header button', { hasText: '关闭' }).first()
  if (await closeWin.count()) { await closeWin.click(); await page.waitForTimeout(600) }
  const settBtn = page.locator('button', { hasText: '设置' }).first()
  if (await settBtn.count()) { await settBtn.click(); await page.waitForTimeout(2000) }
  const owNav = page.getByRole('button', { name: 'openwiki', exact: true })
  if (await owNav.count()) {
    await owNav.click(); await page.waitForTimeout(2500)
    const body = await page.locator('body').innerText()
    check('settings has auto-update card', body.includes('自动更新'))
    check('settings auto-update note', body.includes('轮询 git HEAD') || body.includes('git 提交'))
    // better-sidebar: connected + registered status
    check('better-sidebar connected', body.includes('已连接 dsh-better-sidebar'))
    await page.screenshot({ path: join(shots, 'r2-05-settings.png') })
  }
} catch (err) {
  results.push(`ERROR ${String(err && err.message ? err.message : err)}`); console.log('ERROR', String(err && err.message ? err.message : err))
  await page.screenshot({ path: join(shots, 'r2-99-error.png') }).catch(() => {})
}
console.log('errors:', errs.length ? errs.join(' | ') : '(none)')
await browser.close()
const fails = results.filter((r) => r.startsWith('FAIL') || r.startsWith('ERROR')).length
console.log(fails === 0 ? '\nALL CHECKS PASSED' : `\n${fails} failures`)
process.exit(fails === 0 ? 0 : 1)
