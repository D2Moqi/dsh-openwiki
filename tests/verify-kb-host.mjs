// Offline functional test of the built package host entry for the
// personal-mode 知识库 (kb) RPC family:
//   kb/config · kb/import (path traversal guard) · kb/files · kb/delete ·
//   kb/tree · kb/page · job/start kind=personal (git check skipped, env
//   injection, argv shape). 来源管理 RPC 已移除（仅保留本地文件上传）。
//
// Uses a real temp directory backed by a pass-through fake fs service, so
// node-subprocess writes and fs-service reads agree.
import { apply } from '../lib/index.js'
import { mkdtemp, readFile, readdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'

let failures = 0
const check = (label, cond) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`)
  if (!cond) failures += 1
}

// ---- real temp workspace ----
const root = await mkdtemp(join(tmpdir(), 'owk-kb-test-'))
const wsPath = join(root, 'workspace')
const fakeHome = join(root, 'fakehome')
const { mkdir } = await import('node:fs/promises')
await mkdir(wsPath, { recursive: true })

// ---- fake services ----
const routes = []
const fakeWebServer = { register(route) { routes.push(route); return () => {} } }

const fakeFs = {
  async resolve(p) { return { targetKey: p, displayPath: p } },
  async readText(t) { return readFile(t.targetKey, 'utf8') },
  async writeText(t, content) {
    await mkdir(dirname(t.targetKey), { recursive: true })
    await writeFile(t.targetKey, content)
  },
  async listDir(t) {
    const entries = await readdir(t.targetKey, { withFileTypes: true })
    return entries.map((e) => ({ name: e.name, type: e.isDirectory() ? 'directory' : 'file' }))
  },
}

// subprocess: node children run for real (HOME redirected to fakeHome so the
// plugin's home probe + .env writes stay inside the sandbox); the openwiki CLI
// stub is recorded but never executed.
import { execFileSync } from 'node:child_process'
const spawned = []
let doneCode = 0
const fakeSubprocess = {
  async resolveExecutable(name) {
    if (name === 'openwiki') return join(root, 'openwiki-bin')
    if (name === 'node' || name === 'npm') return process.execPath
    if (name === 'git') return '/usr/bin/git'
    return null
  },
  spawn(spec) {
    spawned.push(spec)
    const isNode = spec.argv[0] === process.execPath
    let stdoutText = ''
    let stderrText = ''
    let code = 0
    if (isNode) {
      const childEnv = { ...process.env, HOME: fakeHome, USERPROFILE: fakeHome }
      try {
        stdoutText = execFileSync(spec.argv[0], spec.argv.slice(1), { env: childEnv, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
      } catch (err) {
        code = 1
        stderrText = String(err && err.stderr || err && err.message || '')
      }
    }
    return {
      done: Promise.resolve({ exitCode: code }),
      collected: {
        stdout: { readFrom: () => ({ text: stdoutText }) },
        stderr: { readFrom: () => ({ text: stderrText }) },
      },
      terminate() {},
    }
  },
}

const fakeTimer = {
  interval() { return () => {} },
  timeout() { return () => {} },
}

const fakeCtx = {
  get(key) {
    if (key === 'webServer') return fakeWebServer
    if (key === 'workspaceRegistry') {
      return {
        list: () => [{ id: 'ws1', path: wsPath, title: 'T' }, { id: 'ws2', path: join(root, 'ws2'), title: 'T2' }],
        get: (id) => {
          if (id === 'ws1') return { id: 'ws1', path: wsPath, title: 'T' }
          if (id === 'ws2') return { id: 'ws2', path: join(root, 'ws2'), title: 'T2' }
          return undefined
        },
      }
    }
    if (key === 'fs') return fakeFs
    if (key === 'subprocess') return fakeSubprocess
    if (key === 'timer') return fakeTimer
    if (key === 'agentDefaultModel') return { currentSelection: () => ({ provider: 'deepseek-official', model: 'deepseek-v4-flash' }) }
    if (key === 'settings') return { get: () => null }
    if (key === 'credentials') return { resolve: async () => ({ value: 'test-key-123', source: 'test' }) }
    if (key === 'web') return { fetch: async () => ({ statusCode: 200, body: { kind: 'text', content: '{"version":"0.4.3"}' } }) }
    return undefined
  },
  effect: () => () => {},
}

await apply(fakeCtx)

const call = async (method, args) => {
  const route = routes.find((r) => r.path === '/dsh-openwiki/rpc')
  const res = { state: { status: 0, body: '' }, writeHead(s) { this.state.status = s }, end(b) { this.state.body = b } }
  const req = { headers: { 'x-dsh-openwiki': '1' } }
  req[Symbol.asyncIterator] = async function* () { yield JSON.stringify({ method, args }) }
  await route.handler(req, res)
  if (res.state.status !== 200) return { ok: false, error: `HTTP ${res.state.status}` }
  return JSON.parse(res.state.body)
}

const b64 = (s) => Buffer.from(s, 'utf8').toString('base64')

// ---- kb/config: directory conventions ----
{
  const res = await call('openwiki/kb/config', { workspaceId: 'ws1' })
  check('kb/config returns conventions', res.ok && res.wikiDir === join(wsPath, 'openwiki-kb', 'wiki') && res.sourceDir === join(wsPath, 'openwiki-kb', 'source', 'files'))
  check('kb/config default prompt mentions source/files', typeof res.prompt === 'string' && res.prompt.includes('source/files'))
}

// ---- kb/import: text file lands on disk ----
{
  const res = await call('openwiki/kb/import', { workspaceId: 'ws1', files: [{ name: 'notes/meeting.md', data: b64('# 会议纪要\n内容') }] })
  check('kb/import writes nested text file', res.ok && res.written.length === 1)
  const disk = await readFile(join(wsPath, 'openwiki-kb', 'source', 'files', 'notes', 'meeting.md'), 'utf8')
  check('kb/import content round-trips', disk.includes('会议纪要'))
}

// ---- kb/import: binary file survives (node decode path) ----
{
  const payload = Buffer.from([0, 1, 2, 253, 254, 255, 128, 64])
  const res = await call('openwiki/kb/import', { workspaceId: 'ws1', files: [{ name: 'blob.bin', data: payload.toString('base64') }] })
  check('kb/import writes binary file', res.ok && res.written.length === 1)
  const disk = await readFile(join(wsPath, 'openwiki-kb', 'source', 'files', 'blob.bin'))
  check('kb/import binary round-trips', Buffer.compare(disk, payload) === 0)
}

// ---- kb/import: path traversal rejected ----
{
  const res = await call('openwiki/kb/import', { workspaceId: 'ws1', files: [{ name: '../evil.md', data: b64('x') }, { name: '/abs.md', data: b64('x') }, { name: 'a/../../up.md', data: b64('x') }] })
  check('kb/import rejects traversal names', res.failed.length === 3 && res.written.length === 0)
}

// ---- kb/files ----
{
  const res = await call('openwiki/kb/files', { workspaceId: 'ws1' })
  const names = (res.files || []).map((f) => f.path).sort()
  check('kb/files lists imported files', res.ok && names.join(',') === 'blob.bin,notes/meeting.md')
}

// ---- kb/delete ----
{
  const res = await call('openwiki/kb/delete', { workspaceId: 'ws1', path: 'blob.bin' })
  const after = await call('openwiki/kb/files', { workspaceId: 'ws1' })
  check('kb/delete removes file', res.ok && after.files.length === 1)
  const bad = await call('openwiki/kb/delete', { workspaceId: 'ws1', path: '../x' })
  check('kb/delete rejects traversal', bad.ok === false)
}

// ---- 来源管理 RPC 已移除（仅保留本地文件上传） ----
{
  const src = await call('openwiki/kb/source/add', { workspaceId: 'ws1', connectorId: 'hackernews' })
  check('kb/source/add removed (404)', src.ok === false && /404|不存在/.test(src.error))
  const setEnv = await call('openwiki/kb/env/set', { workspaceId: 'ws1', key: 'TAVILY_API_KEY', value: 'x' })
  check('kb/env/set removed (404)', setEnv.ok === false && /404|不存在/.test(setEnv.error))
}

// ---- kb/tree + kb/page on empty wiki ----
{
  const tree = await call('openwiki/kb/tree', { workspaceId: 'ws1' })
  check('kb/tree empty wiki', tree.ok && Array.isArray(tree.pages) && tree.pages.length === 0)
  const page = await call('openwiki/kb/page', { workspaceId: 'ws1', path: 'missing.md' })
  check('kb/page missing page', page.ok === false)
}

// ---- 默认开启自动更新（per-workspace：所有工作区默认开，独立开关互不影响） ----
{
  await call('openwiki/workspaces', {})
  const s1 = await call('openwiki/autoupdate/status', { workspaceId: 'ws1' })
  const s2 = await call('openwiki/autoupdate/status', { workspaceId: 'ws2' })
  check('auto-update defaults ON for both workspaces', s1.enabled === true && s2.enabled === true)
  await call('openwiki/autoupdate/set', { workspaceId: 'ws1', enabled: false })
  const off1 = await call('openwiki/autoupdate/status', { workspaceId: 'ws1' })
  const on2 = await call('openwiki/autoupdate/status', { workspaceId: 'ws2' })
  check('per-workspace: disabling ws1 keeps ws2 on', off1.enabled === false && on2.enabled === true)
  await call('openwiki/workspaces', {})
  const again1 = await call('openwiki/autoupdate/status', { workspaceId: 'ws1' })
  check('manual disable not overridden by default', again1.enabled === false)
  const all = await call('openwiki/autoupdate/status', {})
  check('status without id reports all', all.all && all.all.ws2.enabled === true && all.all.ws1.enabled === false)
}

// ---- job/start kind=personal: git check skipped, env injected, argv shape ----
{
  const res = await call('openwiki/job/start', { workspaceId: 'ws1', kind: 'personal', mode: 'update', language: 'zh' })
  check('personal job starts (no git required)', res.ok === true && typeof res.jobId === 'string')
  const spec = spawned[spawned.length - 1]
  const argv = spec.argv.map(String)
  const joined = argv.join(' ')
  check('personal argv has mode word + update', joined.includes('personal') && joined.includes('--update') && joined.includes('-p') && joined.includes('-l') && joined.includes('zh'))
  check('personal argv carries default message', joined.includes('source/files'))
  check('env injects OPENWIKI_CONFIG_DIR', spec.env && spec.env.OPENWIKI_CONFIG_DIR === join(wsPath, 'openwiki-kb'))
  check('env injects model key (scrub-surviving explicit env)', spec.env && spec.env.OPENAI_COMPATIBLE_API_KEY === 'test-key-123')
  check('env injects provider/model', spec.env && spec.env.OPENWIKI_PROVIDER === 'openai-compatible' && spec.env.OPENWIKI_MODEL_ID === 'deepseek-v4-flash')
  const cwd = spec.cwd
  check('personal spawn cwd = workspace', cwd === wsPath)
  // job 完成回调里 readLastUpdate 是异步 IO；轮询等待 job 收敛。
  let kbJob = null
  for (let i = 0; i < 40; i += 1) {
    const st = await call('openwiki/job/status', {})
    kbJob = (st.jobs || []).find((j) => j.kind === 'personal')
    if (kbJob && kbJob.status !== 'running') break
    await new Promise((r) => setTimeout(r, 50))
  }
  check('job/status reports kind=personal + done', kbJob !== undefined && kbJob.status === 'done' && kbJob.phase === 'completed')
}

// ---- job/start kind=code without git still fails fast with git error ----
{
  spawned.length = 0
  const res = await call('openwiki/job/start', { workspaceId: 'ws1', kind: 'code', mode: 'init', language: 'zh' })
  check('code job on non-git workspace refused', res.ok === false && /git 仓库/.test(res.error || ''))
  check('code refusal does not spawn openwiki CLI', !spawned.some((s) => String(s.argv[0]).includes('openwiki-bin')))
}

// cleanup
await rm(root, { recursive: true, force: true })

console.log(failures === 0 ? '\nVERIFY KB HOST OK' : `\n${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
