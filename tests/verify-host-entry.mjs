// Offline functional test of the built package host entry:
// loads lib/index.js, applies it with a fake ctx + fake webServer,
// and drives the /dsh-openwiki/rpc route end-to-end.
import { apply, name, inject } from '../lib/index.js'

let failures = 0
const check = (label, cond) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`)
  if (!cond) failures += 1
}

// ---- fake runtime ----
const routes = []
const fakeWebServer = {
  register(route) {
    routes.push(route)
    return () => {}
  },
}
const fakeCtx = {
  get: (key) => (key === 'webServer' ? fakeWebServer : undefined),
  effect: () => () => {},
}

const fakeRes = () => {
  const state = { status: 0, body: '' }
  return {
    state,
    writeHead(status) { state.status = status },
    end(body) { state.body = body },
  }
}
const fakeReq = (headers, payload) => {
  const iter = payload === null ? [] : [JSON.stringify(payload)]
  const req = { headers }
  req[Symbol.asyncIterator] = async function* () {
    for (const chunk of iter) yield chunk
  }
  return req
}

// ---- drive ----
await apply(fakeCtx)

check('name export', name === 'dsh-openwiki')
check('inject export is array', Array.isArray(inject))
check('rpc route registered', routes.some((r) => r.path === '/dsh-openwiki/rpc' && r.kind === 'exact'))

const route = routes.find((r) => r.path === '/dsh-openwiki/rpc')

// 1) CSRF guard: missing header -> 403
{
  const res = fakeRes()
  await route.handler(fakeReq({}, null), res)
  check('missing header rejected (403)', res.state.status === 403)
}

// 2) unknown method -> 404
{
  const res = fakeRes()
  await route.handler(fakeReq({ 'x-dsh-openwiki': '1' }, { method: 'nope/missing' }), res)
  check('unknown method rejected (404)', res.state.status === 404)
}

// 3) job/status -> {"jobs":[]}
{
  const res = fakeRes()
  await route.handler(fakeReq({ 'x-dsh-openwiki': '1' }, { method: 'openwiki/job/status', args: {} }), res)
  check('job/status dispatched', res.state.status === 200 && res.state.body === '{"jobs":[]}')
}

// 4) runtime/status -> installed:false (no subprocess in test env), graceful error
{
  const res = fakeRes()
  await route.handler(fakeReq({ 'x-dsh-openwiki': '1' }, { method: 'openwiki/runtime/status', args: {} }), res)
  const parsed = JSON.parse(res.state.body)
  check('runtime/status dispatched', res.state.status === 200 && typeof parsed.installed === 'boolean')
}

// 5) model/status -> selection null without agentDefaultModel, graceful
{
  const res = fakeRes()
  await route.handler(fakeReq({ 'x-dsh-openwiki': '1' }, { method: 'openwiki/model/status', args: {} }), res)
  const parsed = JSON.parse(res.state.body)
  check('model/status dispatched', res.state.status === 200 && parsed.selection === null)
}

// 6) bad json -> 400
{
  const res = fakeRes()
  const req = { headers: { 'x-dsh-openwiki': '1' } }
  req[Symbol.asyncIterator] = async function* () { yield '{bad' }
  await route.handler(req, res)
  check('bad json rejected (400)', res.state.status === 400)
}

console.log(failures === 0 ? '\nVERIFY OK' : `\n${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
