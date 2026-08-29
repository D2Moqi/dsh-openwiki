// Final verification of the package plugin after generation completes.
const BASE = 'http://127.0.0.1:3080'
const WS = '35da2742-c6dc-45a6-9495-5f6625d98461'

const call = async (method, args) => {
  const r = await fetch(`${BASE}/dsh-openwiki/rpc`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-dsh-openwiki': '1' },
    body: JSON.stringify({ method, args }),
  })
  return { status: r.status, body: await r.json() }
}

const job = await call('openwiki/job/status', {})
console.log('=== job/status ===')
console.log(JSON.stringify(job.body, null, 2))

const overview = await call('openwiki/wiki/overview', { workspaceId: WS })
console.log('=== wiki/overview ===')
console.log(JSON.stringify(overview.body, null, 2))

const tree = await call('openwiki/wiki/tree', { workspaceId: WS })
console.log('=== wiki/tree ===')
if (tree.body.ok) {
  console.log(`pages: ${tree.body.pages.length}`)
  for (const p of tree.body.pages.slice(0, 20)) console.log(`  ${p.path} | ${p.title} | ${p.status}`)
} else {
  console.log(JSON.stringify(tree.body))
}

const claims = await call('openwiki/wiki/claims', { workspaceId: WS })
console.log('=== wiki/claims ===')
if (claims.body.ok) {
  console.log(`claims: ${claims.body.claims.length}`)
  for (const c of claims.body.claims.slice(0, 3)) console.log(`  ${c.statement.slice(0, 60)}... (${c.evidenceCount} evidence)`)
} else {
  console.log(JSON.stringify(claims.body))
}

const page = await call('openwiki/wiki/page', { workspaceId: WS, path: 'architecture/overview.md' })
console.log('=== wiki/page (architecture/overview.md) ===')
console.log(`ok=${page.body.ok} contentLen=${page.body.content ? page.body.content.length : 'n/a'} title=${page.body.frontmatter && page.body.frontmatter.title}`)

console.log('VERIFY DONE')
