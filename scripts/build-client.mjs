/**
 * Build the client bundle: client/client.js in the web ModuleLoader shape
 * (`window.__ModuleLoader__.load({ id, factory })`), wrapping the
 * authoritative dynamic-plugin body in src/client/index.js.
 *
 * Adaptations from the dynamic form:
 *   - free `React` -> `require('react')` (module table baseline)
 *   - free `host.call` -> `rpc.call` over the same-origin JSON-RPC bridge
 *     (POST /dsh-openwiki/rpc with the `x-dsh-openwiki: 1` header; the host
 *     half of this package registers the route)
 *   - free `styles.insert` -> local <style> injection helper
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = readFileSync(join(root, 'src', 'client', 'index.js'), 'utf8')

const body = src
  .replace(/^\/\*\*[\s\S]*?\*\/\s*/u, '')
  .replace(/^return\s*\{/u, '{')
  .replace(/\}\s*$/u, '}')
  .replace(/\bhost\.call\(/gu, 'rpc.call(')

const out = `window.__ModuleLoader__.load({ id: "dsh-openwiki", factory: (require) => {
  var module = { exports: {} };
  var exports = module.exports;
  Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
  let React = require("react");
  let plugin = ${body}
  let styles = {
    insert(css) {
      const el = document.createElement('style');
      el.textContent = css;
      document.head.appendChild(el);
      return () => { el.remove(); };
    },
  };
  let rpc = {
    call(method, args) {
      return fetch('/dsh-openwiki/rpc', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-dsh-openwiki': '1' },
        body: JSON.stringify({ method, args: args ?? {} }),
      })
        .then((res) => res.json())
        .catch((err) => ({ ok: false, error: String(err && err.message ? err.message : err) }));
    },
  };
  function apply(ctx) {
    return plugin.apply(ctx);
  }
  exports.name = 'dsh-openwiki';
  exports.inject = plugin.inject ?? [];
  exports.apply = apply;
  return module.exports;
}});
`
mkdirSync(join(root, 'client'), { recursive: true })
writeFileSync(join(root, 'client', 'client.js'), out, 'utf8')
console.log('built client/client.js')
