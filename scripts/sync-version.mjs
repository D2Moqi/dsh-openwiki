/**
 * Keep dsh.plugin.json's `version` in lockstep with package.json (the single
 * source of truth), so a release never ships two different versions.
 *
 * Usage:
 *   node scripts/sync-version.mjs          # write dsh.plugin.json if drifted
 *   node scripts/sync-version.mjs --check  # exit 1 on drift (guard mode)
 *
 * Wiring (see package.json scripts):
 *   - "version" lifecycle script: `npm version <x.y.z>` bumps package.json and
 *     then runs this, so dsh.plugin.json lands in the same release commit.
 *   - "prepack" guard: publishing/packing fails loudly if the two ever drift
 *     (e.g. the version was hand-edited without running the sync).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const checkOnly = process.argv.includes('--check')

const pkgPath = join(root, 'package.json')
const manifestPath = join(root, 'dsh.plugin.json')

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))

const from = manifest.version ?? '(missing)'
const to = pkg.version

if (from === to) {
  console.log(`sync-version: ok (dsh.plugin.json.version = ${to})`)
  process.exit(0)
}

if (checkOnly) {
  console.error(
    `sync-version: FAIL dsh.plugin.json.version (${from}) != package.json.version (${to}). ` +
      `Run "npm run sync:version" (or bump with "npm version", which does it ` +
      `automatically) and commit both files.`,
  )
  process.exit(1)
}

manifest.version = to
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
console.log(`sync-version: dsh.plugin.json.version ${from} -> ${to}`)
