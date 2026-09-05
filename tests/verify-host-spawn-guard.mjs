// Offline regression for issue #2 (失效工作区崩溃 + Windows shim/home-probe):
//
// A) Async spawn failure. An invalid cwd (renamed/deleted workspace), a
//    missing binary, or an EINVAL shim launch rejects `handle.done` instead
//    of throwing synchronously — DSH subprocess contract: "Runtime exits
//    resolve `done`; only spawn failures reject." Guards under test in
//    src/host/index.js (runProcess + auto-update tick):
//      1. runProcess catches the `done` rejection and returns { ok:false };
//      2. runProcess pre-checks the cwd via the fs service so a dead workspace
//         never even reaches spawn;
//      3. the auto-update tick contains its own catch-all, so no
//         fire-and-forget poll can ever become an unhandled rejection.
//
// B) Windows shim unwrap. nvm/fnm/Volta/scoop may resolve `git`/`node` to a
//    `.cmd`/`.ps1` shim that raw spawn cannot execute (EINVAL). resolveGit/
//    resolveNode must re-resolve the real `<name>.exe` and spawn that.
//
// C) resolveHome reads USERPROFILE/HOME from the ambient process env instead
//    of spawning a node probe (which failed with EINVAL on Windows and
//    silently broke the ~/.openwiki/.env model bridge).
import { apply } from '../lib/index.js'

let failures = 0
const check = (label, cond) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`)
  if (!cond) failures += 1
}

// ---- unhandled-rejection trap (old code crashed the process here) ----
let unhandled = []
process.on('unhandledRejection', (reason) => {
  unhandled.push(String(reason && reason.message ? reason.message : reason))
})

// ---- fake runtime ----
const routes = []
const fakeWebServer = {
  register(route) {
    routes.push(route)
    return () => {}
  },
}

const spawnCalls = []
const intervals = []
// Windows-style PATH: `git`/`node` resolve to .cmd shims, the real binaries
// live one lookup away; `openwiki` resolves to a real POSIX-style path.
const EXE = {
  git: 'C:\\Program Files\\Git\\cmd\\git.cmd',
  'git.exe': 'C:\\Program Files\\Git\\cmd\\git.exe',
  node: 'C:\\nvm4w\\node.cmd',
  'node.exe': 'C:\\Program Files\\nodejs\\node.exe',
  openwiki: '/usr/bin/openwiki',
}
const fakeSubprocess = {
  async resolveExecutable(name) {
    return EXE[name] ?? null
  },
  spawn(spec) {
    spawnCalls.push(spec)
    // Simulate a spawn-level failure: `done` rejects (never resolves with an
    // exit code). POSIX Node with a missing cwd behaves identically.
    const err = new Error(`spawn ${spec.argv[0]} ENOENT`)
    return {
      done: Promise.reject(err),
      collected: { stdout: undefined, stderr: undefined },
    }
  },
}

// fs service view: /gone was a workspace dir that was renamed/deleted;
// /okdir exists. resolve() throws for absent paths (dsh-fs contract).
const EXISTING = new Set(['/usr/bin/openwiki', '/okdir'])
const fakeFs = {
  async resolve(p) {
    if (!EXISTING.has(p)) throw new Error('FS_NOT_FOUND: no such file or directory')
    return { targetKey: p, displayPath: p }
  },
  async stat() {
    return { version: 'v1', type: 'directory' }
  },
}
const fakeTimer = {
  interval(fn) {
    intervals.push(fn)
    return () => {}
  },
  timeout() { return () => {} },
}
const ws1 = { id: 'ws-gone', path: '/gone', title: 'deleted workspace' }
const ws2 = { id: 'ws-okdir', path: '/okdir', title: 'healthy workspace' }
const fakeRegistry = {
  list: () => [ws1, ws2],
  get: (id) => (id === ws1.id ? ws1 : id === ws2.id ? ws2 : undefined),
}

const fakeCtx = {
  get: (key) => {
    switch (key) {
      case 'webServer': return fakeWebServer
      case 'subprocess': return fakeSubprocess
      case 'fs': return fakeFs
      case 'timer': return fakeTimer
      case 'workspaceRegistry': return fakeRegistry
      default: return undefined
    }
  },
  effect: () => () => {},
}

// ---- drive ----
await apply(fakeCtx)
check('rpc route registered', routes.some((r) => r.path === '/dsh-openwiki/rpc' && r.kind === 'exact'))
const route = routes.find((r) => r.path === '/dsh-openwiki/rpc')

const fakeRes = () => {
  const state = { status: 0, body: '' }
  return {
    state,
    writeHead(status) { state.status = status },
    end(body) { state.body = body },
  }
}
const rpc = async (method, args) => {
  const res = fakeRes()
  const payload = JSON.stringify({ method, args })
  const req = { headers: { 'x-dsh-openwiki': '1' } }
  req[Symbol.asyncIterator] = async function* () { yield payload }
  await route.handler(req, res)
  return { status: res.state.status, body: JSON.parse(res.state.body || 'null') }
}
const flush = () => new Promise((resolve) => setImmediate(() => setImmediate(resolve)))

// 1) probe with an EXISTING cwd but a spawn failure: runProcess must catch the
//    `done` rejection (old code: unhandled rejection, crashed the process).
{
  const { status, body } = await rpc('openwiki/runtime/probe', {})
  check('spawn `done` rejection caught (probe -> ok:false)', status === 200 && body.ok === false)
  check('spawn failure surfaced as message', String(body.error).includes('spawn 失败') && String(body.error).includes('ENOENT'))
}

// 2) auto-update on a workspace whose directory is gone: dirExists guard must
//    short-circuit BEFORE spawn; the fire-and-forget tick stays quiet.
{
  const before = spawnCalls.length
  const { status, body } = await rpc('openwiki/autoupdate/set', { workspaceId: ws1.id, enabled: true })
  await flush()
  check('auto-update enabled for dead workspace (ok:true)', status === 200 && body.ok === true)
  check('dead workspace never reached spawn', spawnCalls.length === before)
}

// 3) auto-update on a healthy workspace: git must be unwrapped from the
//    .cmd shim to the real git.exe, and the tick-level catch-all contains the
//    async spawn failure.
{
  const before = spawnCalls.length
  const { body } = await rpc('openwiki/autoupdate/set', { workspaceId: ws2.id, enabled: true })
  await flush()
  check('auto-update enabled for healthy workspace (ok:true)', body.ok === true)
  check('healthy workspace reached spawn exactly once', spawnCalls.length === before + 1)
  const last = spawnCalls[spawnCalls.length - 1]
  check('git shim unwrapped to real git.exe', String(last.argv[0]).endsWith('git.exe') && !/\.cmd$/iu.test(String(last.argv[0])))
  // Fire the 15s poll tick: still no unhandled rejection, no extra spawn noise.
  const fn = intervals[intervals.length - 1]
  const before2 = spawnCalls.length
  fn()
  await flush()
  check('repeated tick stays contained (spawn once per tick)', spawnCalls.length === before2 + 1)
}

// 4) job/start on the dead workspace (code mode) fails fast and graceful.
{
  const { status, body } = await rpc('openwiki/job/start', { workspaceId: ws1.id, kind: 'code', mode: 'update' })
  check('job/start on dead workspace graceful error', status === 200 && body.ok === false)
  check('git-repo error surfaced (not a crash)', String(body.error).includes('git 仓库'))
}

// 5) model/env: home comes from the ambient env (no node probe spawn at all),
//    so the ~/.openwiki/.env bridge works even where spawning node fails.
{
  const before = spawnCalls.length
  const { status, body } = await rpc('openwiki/model/env', {})
  check('model/env dispatched', status === 200)
  check('home resolved from ambient env (env path present)', String(body.path).includes('.openwiki') && String(body.path).endsWith('.env'))
  check('resolveHome did NOT spawn a node probe', spawnCalls.length === before)
}

check('no unhandled rejections observed', unhandled.length === 0)
if (unhandled.length > 0) console.log('  unhandled:', unhandled.join(' | '))

console.log(failures === 0 ? '\nVERIFY OK' : `\n${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
