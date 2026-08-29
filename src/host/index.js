/**
 * dsh-openwiki — Host half (M1: RuntimeManager).
 *
 * Manages the openwiki runtime: detect / version / install / update /
 * check-latest / self-probe. Windows-safe: npm & openwiki ship .cmd/.ps1
 * shims that Node spawn cannot execute directly, so every launch resolves
 * the real node script inside the shim and spawns `node <script>`.
 *
 * Plain JavaScript for the dynamic Cordis plugin (no imports; string-only
 * path handling). Mirrors the delivered package at code/plugin/dsh-openwiki.
 */
return {
  inject: [],
  apply(ctx) {
    const subprocess = ctx.get('subprocess')
    const fs = ctx.get('fs')
    const web = ctx.get('web')

    // ------------------------------------------------------------------
    // Internals
    // ------------------------------------------------------------------
    let ensurePromise = null

    const readText = async (p) => {
      if (fs === undefined) return null
      try {
        const target = await fs.resolve(p)
        return await fs.readText(target)
      } catch (err) {
        // Optional state files (.page-manifest.json / .run.json / .last-update.json)
        // are expected to be absent (the disk-scan fallback covers those cases);
        // do not spam stderr for a normal ENOENT — only report real read errors.
        const msg = String(err && err.message ? err.message : err)
        if (/not found|ENOENT|no such file/i.test(msg)) return null
        console.error(`openwiki: read failed ${p}: ${msg}`)
        return null
      }
    }

    /**
     * Resolve how to launch the openwiki CLI on this machine.
     * Returns { program, args, packageDir } or { error }.
     * - win32 npm shim (openwiki.cmd): parse `node "%~dp0\...\cli.js"` inside
     *   the shim and spawn node directly (spawning .cmd EPERMs).
     * - POSIX / real executable: spawn it directly.
     */
    const resolveCli = async () => {
      if (subprocess === undefined) return { error: 'subprocess service unavailable' }
      let exe = null
      try {
        exe = await subprocess.resolveExecutable('openwiki')
      } catch (err) {
        return { error: `openwiki 未安装（resolveExecutable: ${String(err && err.message ? err.message : err)}）` }
      }
      if (!exe) return { error: 'openwiki 未安装（PATH 中不存在）' }

      const lower = exe.toLowerCase()
      if (lower.endsWith('.cmd') || lower.endsWith('.bat')) {
        // npm shims embed the real script path as `%dp0%`/`%~dp0%` +
        // `node_modules\openwiki\dist\cli\cli.js`; parse it and spawn node
        // directly (spawning the .cmd itself EPERMs under Node spawn).
        const shim = await readText(exe)
        if (shim !== null) {
          const m = shim.match(/(?:%|%~)dp0%?\\(node_modules\\openwiki\\dist\\cli\\cli\.js)/i)
          if (m) {
            const shimDir = exe.slice(0, exe.lastIndexOf('\\'))
            const scriptPath = `${shimDir}\\${m[1]}`
            const nodeExe = await resolveNode()
            if (nodeExe) {
              return {
                program: nodeExe,
                args: [scriptPath],
                packageDir: scriptPath.slice(0, scriptPath.length - '\\dist\\cli\\cli.js'.length),
              }
            }
          }
        }
        // Fallback: standard npm global layout beside the shim.
        const shimDir = exe.slice(0, exe.lastIndexOf('\\'))
        const candidate = `${shimDir}\\node_modules\\openwiki\\dist\\cli\\cli.js`
        const nodeExe = await resolveNode()
        if (nodeExe) {
          return {
            program: nodeExe,
            args: [candidate],
            packageDir: `${shimDir}\\node_modules\\openwiki`,
          }
        }
        return { error: '无法解析 openwiki shim（未找到 node 可执行文件）' }
      }
      // POSIX shebang script or real binary: spawn directly. npm global
      // installs symlink bin/openwiki -> ../lib/node_modules/openwiki/dist/cli/
      // cli.js; fs.resolve realpaths the target, so the package dir (needed by
      // readVersion on every platform) can be derived here instead of staying
      // null — that was leaving the version display as "—" / "v?" on POSIX.
      let packageDir = null
      if (fs !== undefined) {
        try {
          const t = await fs.resolve(exe)
          const realPath = String((t && (t.targetKey || t.displayPath)) || '')
          if (realPath) {
            // npm-global layout: <prefix>/lib/node_modules/openwiki/dist/cli/cli.js
            const idx = realPath.search(/[\\/]dist[\\/]cli[\\/]cli\.js$/iu)
            if (idx >= 0) {
              packageDir = realPath.slice(0, idx)
            } else if (/[\\/]cli\.js$/iu.test(realPath)) {
              // Generic layout: walk up at most 3 segments for the package.json
              // that owns the script (checking name === "openwiki").
              const sep = realPath.includes('\\') ? '\\' : '/'
              let dir = realPath.slice(0, realPath.lastIndexOf(sep))
              for (let i = 0; i < 3 && dir.length > 0; i += 1) {
                const pkg = await readText(`${dir}${sep}package.json`)
                if (pkg !== null) {
                  try {
                    if ((JSON.parse(pkg).name ?? '') === 'openwiki') { packageDir = dir; break }
                  } catch { /* not JSON — keep walking */ }
                }
                const next = dir.lastIndexOf(sep)
                dir = next > 0 ? dir.slice(0, next) : ''
              }
            }
          }
        } catch (err) {
          console.error(`openwiki: resolve package dir failed: ${String(err && err.message ? err.message : err)}`)
        }
      }
      return { program: exe, args: [], packageDir }
    }

    const resolveNode = async () => {
      if (subprocess === undefined) return null
      try {
        return await subprocess.resolveExecutable('node')
      } catch {
        return null
      }
    }

    /** Resolve the npm CLI script path (Windows shim parse, else `npm`). */
    const resolveNpm = async () => {
      if (subprocess === undefined) return { error: 'subprocess service unavailable' }
      let npmExe = null
      try {
        npmExe = await subprocess.resolveExecutable('npm')
      } catch {
        return { error: 'npm 未找到' }
      }
      if (!npmExe) return { error: 'npm 未找到' }
      const lower = npmExe.toLowerCase()
      if (lower.endsWith('.cmd') || lower.endsWith('.bat')) {
        const shim = await readText(npmExe)
        if (shim !== null) {
          const m = shim.match(/(?:%|%~)dp0%?\\(node_modules\\npm\\bin\\npm-cli\.js)/i)
          if (m) {
            const shimDir = npmExe.slice(0, npmExe.lastIndexOf('\\'))
            const scriptPath = `${shimDir}\\${m[1]}`
            const nodeExe = await resolveNode()
            if (nodeExe) return { program: nodeExe, args: [scriptPath] }
          }
        }
        const shimDir = npmExe.slice(0, npmExe.lastIndexOf('\\'))
        const nodeExe = await resolveNode()
        if (nodeExe) {
          return { program: nodeExe, args: [`${shimDir}\\node_modules\\npm\\bin\\npm-cli.js`] }
        }
        return { error: 'npm shim 解析失败' }
      }
      return { program: npmExe, args: [] }
    }

    /** Read the installed openwiki version from its package.json. */
    const readVersion = async () => {
      const cli = await resolveCli()
      if (cli.error || !cli.packageDir) return null
      // Separator-aware: packageDir comes from either the Windows shim parse
      // (backslashes) or the POSIX realpath (slashes).
      const sep = cli.packageDir.includes('\\') ? '\\' : '/'
      const pkg = await readText(`${cli.packageDir}${sep}package.json`)
      if (pkg === null) return null
      try {
        const parsed = JSON.parse(pkg)
        return typeof parsed.version === 'string' ? parsed.version : null
      } catch {
        return null
      }
    }

    /** Query the npm registry for the latest published openwiki version. */
    let latestWarned = false
    const readLatest = async () => {
      if (web === undefined) return null
      try {
        const res = await web.fetch({ url: 'https://registry.npmjs.org/openwiki/latest' })
        if (res.statusCode !== 200 || res.body.kind !== 'text') return null
        const parsed = JSON.parse(res.body.content)
        return typeof parsed.version === 'string' ? parsed.version : null
      } catch (err) {
        // No web provider registered (headless/temp instance) is a benign
        // "latest version unavailable" case, not an error worth spamming on
        // every status poll — only log it once.
        if (!latestWarned) {
          latestWarned = true
          console.error(`openwiki: registry query failed: ${String(err && err.message ? err.message : err)}`)
        }
        return null
      }
    }

    /**
     * Run one bounded CLI process with collected output.
     * @param {object} program - { program, args } from resolveCli/resolveNpm.
     * @param {string[]} extra - extra argv.
     * @param {string} cwd - working directory.
     */
    const runProcess = async (program, extra, cwd) => {
      if (subprocess === undefined) return { ok: false, error: 'subprocess service unavailable', output: '' }
      const argv = [...program.args, ...extra]
      let handle
      try {
        handle = subprocess.spawn({
          argv: [program.program, ...argv],
          cwd,
          stdio: {
            stdin: 'ignore',
            stdout: { maxBytes: 256 * 1024 },
            stderr: { maxBytes: 256 * 1024 },
          },
          graceMs: 5000,
        })
      } catch (err) {
        return { ok: false, error: `spawn 失败: ${String(err && err.message ? err.message : err)}`, output: '' }
      }
      const outcome = await handle.done
      const out = handle.collected.stdout ? handle.collected.stdout.readFrom(0).text : ''
      const errOut = handle.collected.stderr ? handle.collected.stderr.readFrom(0).text : ''
      const output = `${out}${errOut ? `\n[stderr]\n${errOut}` : ''}`.slice(-8000)
      if (outcome.exitCode !== 0) {
        return { ok: false, error: `进程退出码 ${outcome.exitCode}`, output }
      }
      return { ok: true, output }
    }

    const compareVersions = (a, b) => {
      const pa = String(a ?? '').split('.').map((n) => Number.parseInt(n, 10) || 0)
      const pb = String(b ?? '').split('.').map((n) => Number.parseInt(n, 10) || 0)
      for (let i = 0; i < 3; i += 1) {
        if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0)
      }
      return 0
    }

    // ------------------------------------------------------------------
    // Public operations
    // ------------------------------------------------------------------
    const runtimeStatus = async () => {
      const cli = await resolveCli()
      const installed = !cli.error
      const version = installed ? await readVersion() : null
      const latest = await readLatest()
      return {
        installed,
        exePath: cli.error ? null : cli.program,
        scriptPath: cli.error ? null : (cli.args[0] ?? null),
        version,
        latestVersion: latest,
        hasUpdate: Boolean(version && latest && compareVersions(latest, version) > 0),
        running: false,
        error: cli.error ?? null,
      }
    }

    const install = async () => {
      const npm = await resolveNpm()
      if (npm.error) return { ok: false, error: npm.error, version: null, output: '' }
      const res = await runProcess(npm, ['install', '-g', 'openwiki'], '.')
      if (!res.ok) return { ok: false, error: res.error, version: null, output: res.output }
      const version = await readVersion()
      return { ok: true, version, output: res.output }
    }

    const update = async () => {
      const before = await readVersion()
      const npm = await resolveNpm()
      if (npm.error) return { ok: false, error: npm.error, from: before, to: null, output: '' }
      const res = await runProcess(npm, ['install', '-g', 'openwiki@latest'], '.')
      if (!res.ok) return { ok: false, error: res.error, from: before, to: null, output: res.output }
      const after = await readVersion()
      return { ok: true, from: before, to: after, output: res.output }
    }

    const ensure = async () => {
      if (ensurePromise !== null) return ensurePromise
      ensurePromise = (async () => {
        const status = await runtimeStatus()
        if (status.installed) return { ready: true, version: status.version, installedThisCall: false, error: null }
        const res = await install()
        if (!res.ok) return { ready: false, version: null, installedThisCall: true, error: res.error }
        return { ready: true, version: res.version, installedThisCall: true, error: null }
      })().finally(() => { ensurePromise = null })
      return ensurePromise
    }

    const probe = async () => {
      const cli = await resolveCli()
      if (cli.error) return { ok: false, error: cli.error, output: '' }
      const res = await runProcess(cli, ['--help'], '.')
      return { ok: res.ok, error: res.error ?? null, output: res.output.slice(0, 600) }
    }

    // ------------------------------------------------------------------
    // ModelBridge (M2): DSH model selection → ~/.openwiki/.env
    // ------------------------------------------------------------------
    let homeCache = null

    /** Resolve the user home directory once via a tiny node probe. */
    const resolveHome = async () => {
      if (homeCache !== null) return homeCache
      const nodeExe = await resolveNode()
      if (subprocess === undefined || nodeExe === null) return null
      try {
        const handle = subprocess.spawn({
          argv: [nodeExe, '-e', 'console.log(process.env.USERPROFILE || process.env.HOME || "")'],
          cwd: '.',
          stdio: { stdin: 'ignore', stdout: { maxBytes: 4096 }, stderr: { maxBytes: 4096 } },
          graceMs: 5000,
        })
        const outcome = await handle.done
        const out = handle.collected.stdout ? handle.collected.stdout.readFrom(0).text.trim() : ''
        if (outcome.exitCode === 0 && out.length > 0) homeCache = out
      } catch (err) {
        console.error(`openwiki: home probe failed: ${String(err && err.message ? err.message : err)}`)
      }
      return homeCache
    }

    const openWikiEnvPath = async () => {
      const home = await resolveHome()
      if (home === null) return null
      const sep = home.includes('\\') ? '\\' : '/'
      return `${home.replace(/[\\/]+$/, '')}${sep}.openwiki${sep}.env`
    }

    /** Keys this bridge manages in ~/.openwiki/.env (others are preserved). */
    const MANAGED_ENV_KEYS = [
      'OPENWIKI_PROVIDER',
      'OPENWIKI_MODEL_ID',
      'OPENWIKI_TELEMETRY_DISABLED',
      'OPENAI_COMPATIBLE_BASE_URL',
      'OPENAI_COMPATIBLE_API_KEY',
      'ANTHROPIC_BASE_URL',
      'ANTHROPIC_API_KEY',
      'GEMINI_API_KEY',
      'OPENROUTER_API_KEY',
      'OPENWIKI_MAX_OUTPUT_TOKENS',
      'OPENWIKI_PROVIDER_RETRY_ATTEMPTS',
      'OPENWIKI_OPENROUTER_MAX_TOKENS',
      'OPENWIKI_OPENAI_COMPATIBLE_STREAMING',
    ]

    const formatEnvValue = (value) => {
      const escaped = String(value).replace(/\\/gu, '\\\\').replace(/"/gu, '\\"').replace(/\n/gu, '\\n')
      return `"${escaped}"`
    }

    /**
     * Map the DSH default-model selection to openwiki env updates.
     * Returns { ok, selection, owProvider, apiKeyEnv, baseURL, keySource, updates, error? }.
     */
    const buildOpenWikiEnv = async () => {
      const adm = ctx.get('agentDefaultModel')
      const settings = ctx.get('settings')
      if (adm === undefined) return { ok: false, error: 'agentDefaultModel 服务不可用' }
      let selection
      try {
        selection = adm.currentSelection()
      } catch (err) {
        return { ok: false, error: `读取 DSH 默认模型失败: ${String(err && err.message ? err.message : err)}` }
      }
      const provider = selection.provider
      const model = selection.model

      let dsNs = null
      let piNs = null
      if (settings !== undefined) {
        try { dsNs = settings.get('llm-deepseek') } catch { dsNs = null }
        try { piNs = settings.get('llm-pi-ai') } catch { piNs = null }
      }

      let owProvider = null
      let apiKeyEnv = null
      let baseURL = null

      if (provider === 'deepseek-official' || provider === 'deepseek') {
        // Native DeepSeek route (llm-deepseek namespace).
        owProvider = 'openai-compatible'
        apiKeyEnv = (dsNs && dsNs.apiKeyEnv) || 'DEEPSEEK_API_KEY'
        baseURL = (dsNs && dsNs.baseURL) || 'https://api.deepseek.com'
      } else if (piNs && piNs.providers && piNs.providers[provider]) {
        // pi-ai route: map by wire protocol.
        const profile = piNs.providers[provider]
        apiKeyEnv = profile.apiKeyEnv || null
        baseURL = profile.baseURL || null
        const api = String(profile.api || '').toLowerCase()
        if (api.includes('anthropic')) owProvider = 'anthropic'
        else if (api.includes('gemini')) owProvider = 'gemini'
        else if (api.includes('openrouter')) owProvider = 'openrouter'
        else if (api.includes('openai') || api.includes('responses') || api.includes('chat')) owProvider = 'openai-compatible'
        else if (api === '') owProvider = 'openai-compatible' // catalog route defaults to OpenAI wire
      }

      if (owProvider === null) {
        return {
          ok: false,
          error: `DSH provider 路由 "${provider}" 无法自动映射（未在 llm-deepseek / llm-pi-ai 中找到），请在设置页手动配置`,
          selection: { provider, model },
        }
      }

      const creds = ctx.get('credentials')
      let key = null
      let keySource = null
      if (apiKeyEnv !== null && creds !== undefined) {
        try {
          const resolved = await creds.resolve(apiKeyEnv)
          if (resolved !== undefined && resolved.value !== undefined && resolved.value.length > 0) {
            key = resolved.value
            keySource = resolved.source ?? 'unknown'
          }
        } catch (err) {
          console.error(`openwiki: credentials.resolve(${apiKeyEnv}) failed: ${String(err && err.message ? err.message : err)}`)
        }
      }
      if (key === null) {
        return {
          ok: false,
          error: `API Key 未解析（凭证引用 ${apiKeyEnv ?? '—'}），请先在 DSH 配置模型或在设置页手动填写`,
          selection: { provider, model },
          owProvider,
          apiKeyEnv,
        }
      }

      const updates = {
        OPENWIKI_PROVIDER: owProvider,
        OPENWIKI_MODEL_ID: model,
        OPENWIKI_TELEMETRY_DISABLED: '1',
      }
      if (owProvider === 'openai-compatible') {
        if (baseURL) updates.OPENAI_COMPATIBLE_BASE_URL = baseURL
        updates.OPENAI_COMPATIBLE_API_KEY = key
        // openwiki 默认为非流式：长文档生成会等待整段输出返回（易超时/慢）。
        // 显式开启流式以更快见到首块输出并降低超时风险。
        updates.OPENWIKI_OPENAI_COMPATIBLE_STREAMING = 'true'
      } else if (owProvider === 'anthropic') {
        if (baseURL) updates.ANTHROPIC_BASE_URL = baseURL
        updates.ANTHROPIC_API_KEY = key
      } else if (owProvider === 'gemini') {
        updates.GEMINI_API_KEY = key
      } else if (owProvider === 'openrouter') {
        updates.OPENROUTER_API_KEY = key
      }

      return { ok: true, selection: { provider, model }, owProvider, apiKeyEnv, baseURL, keySource, updates }
    }

    /**
     * Merge env updates into ~/.openwiki/.env, preserving unknown keys.
     *
     * The fs service sandbox can deny writes outside the workspace
     * (workspace-write mode) and ~/.openwiki lives in the user's home, so a
     * purely sandboxed write fails there. Fallback ladder:
     *   1. sandboxed fs.writeText (keeps DSH atomic-write integration);
     *   2. node subprocess create-dir + write (the plugin already spawns
     *      node/npm/git freely; runs with the user's real permissions);
     *   3. a copy-paste shell command for the user to run themselves.
     */
    const applyEnvUpdates = async (updates) => {
      const envPath = await openWikiEnvPath()
      if (envPath === null) return { ok: false, error: '无法解析用户主目录' }
      if (fs === undefined) return { ok: false, error: 'fs 服务不可用' }
      const sep = envPath.includes('\\') ? '\\' : '/'
      const envDir = envPath.slice(0, envPath.lastIndexOf(sep))
      const existing = await readText(envPath) // null when missing
      const kept = []
      if (existing !== null) {
        for (const line of existing.split(/\r?\n/u)) {
          const m = line.match(/^([A-Z_][A-Z0-9_]*)=/u)
          if (m && MANAGED_ENV_KEYS.includes(m[1])) continue
          kept.push(line)
        }
      }
      for (const [key, value] of Object.entries(updates)) {
        kept.push(`${key}=${formatEnvValue(value)}`)
      }
      const content = `${kept.join('\n')}\n`

      // (1) Sandboxed fs write.
      let fsError = null
      if (fs !== undefined) {
        try {
          const target = await fs.resolve(envPath)
          await fs.writeText(target, content)
          return { ok: true, path: envPath, via: 'fs' }
        } catch (err) {
          fsError = String(err && err.message ? err.message : err)
        }
      }

      // (2) node subprocess: create the dir if missing + write (user's real
      //     permissions; the fs sandbox cannot see this).
      const node = await resolveNode()
      if (node !== null) {
        const code = `const fs=require('fs');fs.mkdirSync(${JSON.stringify(envDir)},{recursive:true});fs.writeFileSync(${JSON.stringify(envPath)},${JSON.stringify(content)})`
        const res = await runProcess({ program: node, args: [] }, ['-e', code], '.')
        if (res.ok) return { ok: true, path: envPath, via: 'node' }
      }

      // (3) Manual command for the user.
      return {
        ok: false,
        error: (fsError ?? '文件系统写入被拒绝'),
        command: manualEnvCommand(envDir, envPath, content),
      }
    }

    /** Build a copy-paste shell command that creates `<envDir>` and the .env. */
    const manualEnvCommand = (envDir, envPath, content) => {
      const body = String(content).replace(/\n+$/u, '')
      if (typeof process !== 'undefined' && process.platform === 'win32') {
        const ps = (s) => `'${String(s).replace(/'/gu, "''")}'`
        return [
          `$dir = ${ps(envDir)}`,
          'New-Item -ItemType Directory -Force -Path $dir | Out-Null',
          "@'",
          body,
          `'@ | Set-Content -Encoding UTF8 -Path ${ps(envPath)}`,
        ].join('\n')
      }
      const q = (s) => `'${String(s).replace(/'/gu, `'\\''`)}'`
      return `mkdir -p ${q(envDir)} && cat > ${q(envPath)} <<'OWK_EOF'\n${body}\nOWK_EOF`
    }

    /** Read current managed .env values (values masked for secrets). */
    const readOpenWikiEnvStatus = async () => {
      const envPath = await openWikiEnvPath()
      if (envPath === null) return { exists: false, path: null, values: {} }
      const existing = await readText(envPath)
      if (existing === null) return { exists: false, path: envPath, values: {} }
      const values = {}
      for (const line of existing.split(/\r?\n/u)) {
        const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/u)
        if (m && MANAGED_ENV_KEYS.includes(m[1])) values[m[1]] = m[2]
      }
      return { exists: true, path: envPath, values }
    }

    // ------------------------------------------------------------------
    // JobDriver (M3): spawn openwiki init/update, poll progress, kill
    // ------------------------------------------------------------------
    const jobs = new Map() // workspaceId -> job record

    // ------------------------------------------------------------------
    // Auto-update (M4): poll the workspace's current git HEAD; when it changes
    // and auto-update is enabled, run openwiki --update so the wiki tracks new
    // commits. openwiki has no native git-commit trigger (only a daily CI cron),
    // so the plugin owns the trigger via a HEAD poll.
    // ------------------------------------------------------------------
    const autoUpdate = { enabled: false, timer: null, lastHead: null, workspaceId: null }

    const resolveGit = async () => {
      if (subprocess === undefined) return null
      try { return await subprocess.resolveExecutable('git') } catch { return null }
    }

    const readGitHead = async (wsPath) => {
      const git = await resolveGit()
      if (git === null) return null
      const res = await runProcess({ program: git, args: [] }, ['rev-parse', '--verify', 'HEAD'], wsPath)
      if (!res.ok) return null
      return (res.output.trim().split(/\s+/)[0] || null)
    }

    const stopAutoUpdate = () => {
      if (autoUpdate.timer !== null) {
        try { autoUpdate.timer() } catch { /* noop */ }
        autoUpdate.timer = null
      }
      autoUpdate.enabled = false
    }

    const startAutoUpdate = (workspaceId) => {
      stopAutoUpdate()
      const ws = workspaceOf(workspaceId)
      if (ws === undefined) { autoUpdate.workspaceId = null; return { ok: false, error: 'workspace 不存在或不可用' } }
      autoUpdate.workspaceId = workspaceId
      autoUpdate.enabled = true
      autoUpdate.lastHead = null
      const tick = async () => {
        if (!autoUpdate.enabled) return
        const head = await readGitHead(ws.path)
        if (head === null) return
        if (autoUpdate.lastHead === null) { autoUpdate.lastHead = head; return }
        if (head !== autoUpdate.lastHead) {
          autoUpdate.lastHead = head
          // Reuse the incremental update job (only changed pages regenerate).
          // Keep the language of the previous run so regenerated docs stay in
          // the user's configured language.
          const lastUpdate = await readLastUpdate(ws.path)
          await startJob({ workspaceId, mode: 'update', language: (lastUpdate && lastUpdate.language) || 'zh' })
        }
      }
      void tick()
      const tmr = ctx.get('timer')
      if (tmr !== undefined) autoUpdate.timer = tmr.interval(() => { void tick() }, 15000)
      return { ok: true }
    }


    const workspaceOf = (workspaceId) => {
      const registry = ctx.get('workspaceRegistry')
      if (registry === undefined) return undefined
      try {
        return registry.get(String(workspaceId))
      } catch {
        return undefined
      }
    }

    const readRunState = async (wsPath) => {
      const sep = wsPath.includes('\\') ? '\\' : '/'
      const run = await readText(`${wsPath}${sep}openwiki${sep}.run.json`)
      if (run === null) return null
      try {
        const parsed = JSON.parse(run)
        const pages = (parsed.plan && Array.isArray(parsed.plan.pages)) ? parsed.plan.pages : []
        let done = 0
        let pending = 0
        let skipped = 0
        let failed = 0
        for (const p of pages) {
          if (p.status === 'complete') done += 1
          else if (p.status === 'skipped') skipped += 1
          else if (p.status === 'failed') failed += 1
          else pending += 1
        }
        return {
          phase: parsed.phase ?? 'generating',
          total: pages.length,
          done,
          pending,
          skipped,
          failed,
          // Resume ownership facts (openwiki requires the SAME mode + language
          // when reconstructing an interrupted run from .run.json).
          mode: parsed.mode ?? null,
          language: parsed.language ?? null,
        }
      } catch {
        return null
      }
    }

    const readLastUpdate = async (wsPath) => {
      const sep = wsPath.includes('\\') ? '\\' : '/'
      const raw = await readText(`${wsPath}${sep}openwiki${sep}.last-update.json`)
      if (raw === null) return null
      try {
        return JSON.parse(raw)
      } catch {
        return null
      }
    }

    /**
     * Spawn the openwiki CLI for one job and attach the poll + completion
     * lifecycle. Shared by startJob (fresh) and resumeJob (pause → continue).
     * openwiki's beginRepositoryRun reconstructs an interrupted run from the
     * durable openwiki/.run.json, so re-running the SAME mode + language
     * continues from the checkpoint instead of starting over (mode/language/
     * producer mismatches are refused by openwiki itself).
     */
    const launchJob = async (job, ws) => {
      // 模型桥接：任务前确保 ~/.openwiki/.env 与 DSH 模型同步（跟随模式）。
      // 自定义生成模型（job.model，--modelId 优先于 env）同步写入 env，
      // 让 env 状态卡与本次运行保持一致。
      const built = await buildOpenWikiEnv()
      if (!built.ok) return { ok: false, error: `模型未就绪：${built.error}` }
      const updates = job.model ? { ...built.updates, OPENWIKI_MODEL_ID: job.model } : built.updates
      const applied = await applyEnvUpdates(updates)
      if (!applied.ok) return { ok: false, error: `写入 .env 失败：${applied.error}` }

      const cli = await resolveCli()
      if (cli.error) return { ok: false, error: cli.error }
      if (subprocess === undefined) return { ok: false, error: 'subprocess 服务不可用' }

      const argv = [...cli.args, job.mode === 'update' ? '--update' : '--init', '-p', '-l', job.language]
      if (job.model) argv.push('--modelId', job.model)
      let handle
      try {
        handle = subprocess.spawn({
          argv: [cli.program, ...argv],
          cwd: ws.path,
          stdio: {
            stdin: 'ignore',
            stdout: { maxBytes: 4 * 1024 * 1024 },
            stderr: { maxBytes: 1024 * 1024 },
          },
          graceMs: 10000,
        })
      } catch (err) {
        return { ok: false, error: `spawn 失败: ${String(err && err.message ? err.message : err)}` }
      }
      job.handle = handle
      job.status = 'running'
      job.phase = 'waiting'
      job.message = '等待开始分析'
      job.cancelled = false
      job.paused = false
      job.resumedAt = new Date().toISOString()
      console.log(`openwiki: job launch workspace=${job.workspaceId} mode=${job.mode} language=${job.language} argv=${[cli.program, ...argv].join(' ')}`)

      const timer = ctx.get('timer')
      let pollTimer = null
      const poll = async () => {
        const run = await readRunState(ws.path)
        if (run !== null) {
          // Pass through the real openwiki phase (planning/generating).
          job.phase = run.phase === 'planning' ? 'planning' : 'generating'
          job.total = run.total
          job.done = run.done
          job.pending = run.pending
          job.skipped = run.skipped
          job.failed = run.failed
          const pct = run.total > 0 ? Math.round((run.done / run.total) * 1000) / 10 : 0
          job.message = `正在生成中，已完成 ${run.done}/${run.total} (${pct}%)，处理中: ${run.pending}，失败: ${run.failed}`
        } else if (job.phase === 'waiting') {
          job.phase = 'initializing'
          job.message = '正在初始化分析'
        }
      }
      if (timer !== undefined) {
        pollTimer = timer.interval(() => { void poll() }, 2000)
      }
      void poll()

      void handle.done.then(async (outcome) => {
        if (pollTimer !== null) pollTimer()
        if (job.cancelled) {
          job.status = 'cancelled'
          job.phase = 'cancelled'
          job.message = '已取消'
        } else if (job.paused) {
          // Paused via 「暂停」: keep the record. openwiki persists
          // openwiki/.run.json until a run completes, so a later resume
          // continues from the checkpoint (its own lifecycle, verified in
          // openwiki 0.4.3 generation/repository-run.js).
          job.status = 'paused'
          job.phase = 'paused'
          job.message = '已暂停，点击「继续」从断点恢复'
        } else {
          const last = await readLastUpdate(ws.path)
          const exited = outcome.exitCode
          // An interrupted run leaves .last-update.json at status="interrupted"
          // with a durable .run.json — the NEXT start resumes it. Surface that
          // plainly instead of a cryptic "任务结束(status=interrupted)".
          if (exited !== 0 && last && last.status === 'interrupted') {
            job.status = 'error'
            job.phase = 'interrupted'
            job.message = '任务被中断（openwiki 已保存断点，点击「重新生成」将从断点继续）'
          } else {
            job.status = exited === 0 ? 'done' : 'error'
            job.phase = exited === 0 ? 'completed' : 'failed'
            job.message = last
              ? `任务结束（openwiki status=${last.status}，exit ${exited}）`
              : `任务结束（exit ${exited}）`
          }
        }
        // A paused job stays in the map until resumed or cancelled; every
        // other terminal state is garbage-collected after a grace window.
        if (timer !== undefined && job.status !== 'paused') {
          timer.timeout(() => { jobs.delete(workspaceId) }, 120000)
        }
      }).catch((err) => {
        if (pollTimer !== null) pollTimer()
        if (job.paused || job.cancelled) return // pause/cancel outcome already handled
        job.status = 'error'
        job.phase = 'failed'
        job.message = `任务异常: ${String(err && err.message ? err.message : err)}`
      })

      return { ok: true, jobId: job.jobId, phase: job.phase }
    }

    const startJob = async (args) => {
      const workspaceId = String((args && args.workspaceId) ?? '')
      let mode = (args && args.mode === 'update') ? 'update' : 'init'
      let language = (args && args.language) || 'zh'
      const model = String((args && args.model) || '').trim() || null
      const ws = workspaceOf(workspaceId)
      if (ws === undefined) return { ok: false, error: 'workspace 不存在或不可用' }
      if (jobs.has(workspaceId)) return { ok: false, error: '该 workspace 已有任务（可先「暂停/继续/取消」）' }

      // openwiki's repo-wiki mode is git-backed (it diffs HEAD/lastUpdate to
      // decide what regenerates). A workspace that is not a git repo cannot be
      // generated in code mode — fail fast with a clear message instead of a
      // silent spawn that exits immediately.
      const gitHead = await readGitHead(ws.path)
      if (gitHead === null) {
        return { ok: false, error: '该工作目录不是 git 仓库，openwiki 的仓库 Wiki 生成需要 git 历史；请选择已纳入 git 的仓库，或将个人知识改为 personal 模式（本期暂不支持）。' }
      }

      // A durable openwiki/.run.json means this start will RESUME the
      // interrupted run (openwiki's own lifecycle) — and openwiki refuses to
      // resume it under a DIFFERENT mode or language ("Resume that run before
      // starting X"), which is exactly why a cancelled init followed by
      // "重新生成" (update) used to fail with exit 1. Follow the persisted
      // ownership facts so the resume actually continues the run.
      const existingRun = await readRunState(ws.path)
      const resumed = existingRun !== null
      if (resumed && existingRun.mode) mode = existingRun.mode
      if (resumed && existingRun.language) language = existingRun.language

      const job = {
        jobId: `${Date.now()}-${workspaceId}`,
        workspaceId,
        mode,
        language,
        model,
        handle: null,
        startedAt: new Date().toISOString(),
        status: 'running', // running | paused | done | error | cancelled
        phase: 'waiting',
        total: existingRun ? existingRun.total : 0,
        done: existingRun ? existingRun.done : 0,
        pending: 0,
        skipped: 0,
        failed: 0,
        message: resumed ? '检测到已中断任务，正在从断点继续…' : '等待开始分析',
        cancelled: false,
        paused: false,
      }
      jobs.set(workspaceId, job)
      const launched = await launchJob(job, ws)
      if (!launched.ok) {
        jobs.delete(workspaceId)
        return launched
      }
      return { ...launched, resumed, resumedMode: job.mode, resumedLanguage: job.language }
    }

    /** Pause a running job: terminate the CLI process; the durable
     *  openwiki/.run.json makes the interrupted run resumable. */
    const pauseJob = async (args) => {
      const workspaceId = String((args && args.workspaceId) ?? '')
      const job = jobs.get(workspaceId)
      if (job === undefined || job.status !== 'running') return { ok: false, error: '没有运行中的任务可暂停' }
      if (job.handle === null) return { ok: false, error: '任务正在启动，请稍后再试' }
      job.paused = true
      job.phase = 'pausing'
      job.message = '正在暂停（等待 openwiki 进程退出）…'
      try {
        job.handle.terminate()
      } catch (err) {
        job.paused = false
        job.phase = 'running'
        job.message = '等待开始分析'
        return { ok: false, error: `暂停失败: ${String(err && err.message ? err.message : err)}` }
      }
      return { ok: true }
    }

    /** Resume a paused job: re-spawn the same mode + language; openwiki
     *  reconstructs the run from openwiki/.run.json and continues. */
    const resumeJob = async (args) => {
      const workspaceId = String((args && args.workspaceId) ?? '')
      const job = jobs.get(workspaceId)
      if (job === undefined || job.status !== 'paused') return { ok: false, error: '没有已暂停的任务可继续' }
      const ws = workspaceOf(workspaceId)
      if (ws === undefined) return { ok: false, error: 'workspace 不存在或不可用' }
      job.paused = false
      const launched = await launchJob(job, ws)
      if (!launched.ok) {
        // Keep the pause visible so the user can retry; the error surfaces.
        job.paused = true
        job.status = 'paused'
        job.phase = 'paused'
        job.message = `继续失败：${launched.error ?? '未知错误'}`
        return launched
      }
      // launchJob set a running message; keep the resume note visible briefly
      // is unnecessary — the poll loop updates phase/message within seconds.
      return launched
    }

    const killJob = async (args) => {
      const workspaceId = String((args && args.workspaceId) ?? '')
      const job = jobs.get(workspaceId)
      if (job === undefined) return { ok: false, error: '没有运行中的任务' }
      if (job.status === 'paused') {
        // Nothing to stop: drop the record only. openwiki's durable
        // openwiki/.run.json is its own lifecycle (the next --init/--update
        // for this workspace resumes from it), so the plugin never deletes it.
        jobs.delete(workspaceId)
        return { ok: true, abandoned: true }
      }
      if (job.cancelled) return { ok: true }
      job.cancelled = true
      try {
        job.handle.terminate()
      } catch (err) {
        job.cancelled = false
        return { ok: false, error: `终止失败: ${String(err && err.message ? err.message : err)}` }
      }
      // Wait for the process to be fully gone, THEN drop the record so a
      // follow-up 「重新生成」 never collides with the dying process and never
      // gets the stale "已有任务" refusal (the record is no longer kept for
      // the 120s grace window).
      try {
        await job.handle.done
      } catch { /* done rejects only on spawn-level failure; keep going */ }
      if (jobs.get(workspaceId) === job) jobs.delete(workspaceId)
      return { ok: true }
    }

    const jobStatus = async () => {
      const list = []
      for (const job of jobs.values()) {
        list.push({
          jobId: job.jobId,
          workspaceId: job.workspaceId,
          mode: job.mode,
          language: job.language,
          status: job.status,
          phase: job.phase,
          total: job.total,
          done: job.done,
          pending: job.pending,
          skipped: job.skipped,
          failed: job.failed,
          message: job.message,
          startedAt: job.startedAt,
        })
      }
      return { jobs: list }
    }

    // ------------------------------------------------------------------
    // WikiReader (M3): tree / page / overview / claims
    // ------------------------------------------------------------------
    const wikiDir = (wsPath) => {
      const sep = wsPath.includes('\\') ? '\\' : '/'
      return `${wsPath}${sep}openwiki`
    }

    const parseFrontmatterTitle = (head) => {
      if (!head.startsWith('---')) return null
      const end = head.indexOf('\n---', 3)
      if (end < 0) return null
      const block = head.slice(3, end)
      const m = block.match(/^title:\s*(.+)$/mu)
      if (m) return m[1].trim().replace(/^['"]|['"]$/gu, '')
      return null
    }

    const readPageHead = async (targetPath) => {
      if (fs === undefined) return null
      try {
        // readBytes rejects files larger than maxBytes instead of returning a
        // truncated head; readText has no such limit, so read the full page
        // and slice the frontmatter window.
        const target = await fs.resolve(targetPath)
        const text = await fs.readText(target)
        return text.slice(0, 8192)
      } catch {
        return null
      }
    }

    const readWikiTree = async (args) => {
      const workspaceId = String((args && args.workspaceId) ?? '')
      const ws = workspaceOf(workspaceId)
      if (ws === undefined) return { ok: false, error: 'workspace 不存在或不可用' }
      const wiki = wikiDir(ws.path)
      const sep = wiki.includes('\\') ? '\\' : '/'

      // 已完成页面：.page-manifest.json（权威清单）。
      const pages = []
      const manifest = await readText(`${wiki}${sep}.page-manifest.json`)
      if (manifest !== null) {
        try {
          const parsed = JSON.parse(manifest)
          for (const [rel, meta] of Object.entries(parsed.pages ?? {})) {
            const path = String(rel).replace(/^\/openwiki\//u, '').replace(/^\//u, '')
            let title = null
            const head = await readPageHead(`${wiki}${wiki.includes('\\') ? '\\' : '/'}${path.replace(/\//gu, wiki.includes('\\') ? '\\' : '/')}`)
            if (head !== null) title = parseFrontmatterTitle(head)
            pages.push({
              path,
              title: title ?? path.split(/[\\/]/u).pop().replace(/\.md$/u, ''),
              status: 'complete',
              completedBy: meta.completedBy ?? null,
            })
          }
        } catch (err) {
          console.error(`openwiki: manifest parse failed: ${String(err && err.message ? err.message : err)}`)
        }
      }

      // Manifest missing (edge-case init finalize): fall back to a recursive
      // on-disk scan so the tree still shows every durable page.
      let scanError = null
      if (pages.length === 0 && fs !== undefined) {
        try {
          const scan = async (dir, base) => {
            const entries = await fs.listDir(await fs.resolve(dir))
            for (const e of entries) {
              if (e.type === 'directory') {
                if (e.name === '.claims' || e.name === '.git') continue
                await scan(`${dir}${sep}${e.name}`, `${base}${base ? '/' : ''}${e.name}`)
              } else if (e.name.endsWith('.md')) {
                const path = `${base}${base ? '/' : ''}${e.name}`
                const head = await readPageHead(`${dir}${sep}${e.name}`)
                const title = head !== null ? parseFrontmatterTitle(head) : null
                pages.push({
                  path,
                  title: title ?? e.name.replace(/\.md$/u, ''),
                  status: 'complete',
                  completedBy: null,
                })
              }
            }
          }
          await scan(wiki, '')
        } catch (err) {
          scanError = String(err && err.message ? err.message : err)
          // A missing openwiki dir (workspace never generated) is normal — do
          // not spam stderr, it's not a real error.
          if (!/not found|ENOENT|no such file/i.test(scanError)) {
            console.error(`openwiki: tree scan failed: ${scanError}`)
          }
        }
      }

      // 生成中页面：.run.json plan.pages（有标题无路径，状态驱动展示）。
      const inProgress = []
      const run = await readRunState(ws.path)
      if (run !== null) {
        const raw = await readText(`${wiki}${wiki.includes('\\') ? '\\' : '/'}.run.json`)
        if (raw !== null) {
          try {
            const parsed = JSON.parse(raw)
            for (const p of (parsed.plan && Array.isArray(parsed.plan.pages) ? parsed.plan.pages : [])) {
              if (p.status !== 'complete') inProgress.push({ title: p.title ?? '未命名页面', status: p.status ?? 'pending' })
            }
          } catch { /* ignore */ }
        }
      }

      return {
        ok: true,
        workspaceId,
        workspaceTitle: ws.title,
        pages,
        inProgress,
        hasRun: run !== null,
        runPhase: run ? run.phase : null,
        scanError,
      }
    }

    /**
     * Minimal structured YAML-frontmatter parser (scalars + list items).
     * - `- key: value` items keep the value (id:/resource:/by:/at: uniform)
     * - inline `[a, b]` arrays split into arrays
     * Unknown/nested shapes degrade gracefully.
     */
    const parseFrontmatter = (content) => {
      if (!content.startsWith('---')) return null
      const end = content.indexOf('\n---', 3)
      if (end < 0) return null
      const block = content.slice(3, end)
      const fm = {}
      let currentKey = null
      for (const rawLine of block.split(/\r?\n/u)) {
        const line = rawLine.trim()
        if (line.length === 0 || line.startsWith('#')) continue
        const listMatch = line.match(/^-\s+(.*)$/u)
        if (listMatch && currentKey !== null) {
          if (currentKey === 'sources') continue // ids are not needed; resources collected below
          let val = listMatch[1]
          const kvItem = val.match(/^[A-Za-z_-]+:\s*(.+)$/u)
          if (kvItem) val = kvItem[1]
          val = val.replace(/^['"]|['"]$/gu, '').trim()
          if (!Array.isArray(fm[currentKey])) fm[currentKey] = []
          fm[currentKey].push(val)
          continue
        }
        const kv = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/u)
        if (kv) {
          if (currentKey === 'sources' && kv[1] === 'resource') {
            const res = kv[2].trim().replace(/^['"]|['"]$/gu, '')
            if (!Array.isArray(fm.sources)) fm.sources = []
            fm.sources.push(res)
            continue
          }
          currentKey = kv[1]
          const rawVal = kv[2].trim()
          if (rawVal.length === 0) {
            fm[currentKey] = []
          } else {
            const inline = rawVal.match(/^\[(.*)\]$/u)
            if (inline) {
              fm[currentKey] = inline[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/gu, '')).filter((s) => s.length > 0)
            } else {
              const unquoted = rawVal.replace(/^['"]|['"]$/gu, '')
              if (unquoted === 'true') fm[currentKey] = true
              else if (unquoted === 'false') fm[currentKey] = false
              else if (/^\d+$/u.test(unquoted)) fm[currentKey] = Number(unquoted)
              else fm[currentKey] = unquoted
            }
          }
        }
      }
      return Object.keys(fm).length > 0 ? fm : null
    }

    const readWikiPage = async (args) => {
      const workspaceId = String((args && args.workspaceId) ?? '')
      const relPath = String((args && args.path) ?? '')
      const ws = workspaceOf(workspaceId)
      if (ws === undefined) return { ok: false, error: 'workspace 不存在或不可用' }
      const sep = ws.path.includes('\\') ? '\\' : '/'
      const safeRel = relPath.replace(/^\/+/u, '').replace(/\.\./gu, '')
      const candidate = (rel) => `${wikiDir(ws.path)}${sep}${rel.replace(/\//gu, sep)}`
      // Accept both "architecture/overview" and "architecture/overview.md": a
      // path without the extension falls back to the .md form.
      let full = candidate(safeRel)
      let content = await readText(full)
      if (content === null && !safeRel.endsWith('.md')) {
        content = await readText(candidate(`${safeRel}.md`))
        if (content !== null) full = candidate(`${safeRel}.md`)
      }
      if (content === null) return { ok: false, error: '页面不存在' }
      let frontmatter = null
      let body = content
      if (content.startsWith('---')) {
        const end = content.indexOf('\n---', 3)
        if (end >= 0) {
          frontmatter = parseFrontmatter(content)
          body = content.slice(end + 5)
        }
      }
      return { ok: true, path: safeRel, content: body, frontmatter }
    }

    const readWikiOverview = async (args) => {
      const workspaceId = String((args && args.workspaceId) ?? '')
      const ws = workspaceOf(workspaceId)
      if (ws === undefined) return { ok: false, error: 'workspace 不存在或不可用' }
      const last = await readLastUpdate(ws.path)
      const run = await readRunState(ws.path)
      const wiki = wikiDir(ws.path)
      const sep = wiki.includes('\\') ? '\\' : '/'
      const manifest = await readText(`${wiki}${sep}.page-manifest.json`)
      let pageCount = 0
      let successCount = 0
      let failedCount = 0
      let scanError = null
      if (manifest !== null) {
        try { pageCount = Object.keys(JSON.parse(manifest).pages ?? {}).length } catch { pageCount = 0 }
        successCount = pageCount
      }
      // wikiExists: manifest, active run, or generated page files on disk.
      // (The manifest can be absent after an edge-case init finalize even
      // though every page + claims sidecar is durable; openwiki --update
      // reconciles it.)
      const indexMd = await readText(`${wiki}${sep}index.md`)
      const quickstartMd = await readText(`${wiki}${sep}quickstart.md`)
      const hasPages = indexMd !== null || quickstartMd !== null
      if (manifest === null && fs !== undefined) {
        // Manifest missing: count durable .md pages by recursive scan (matches
        // the tree fallback), so the overview shows the real page count and a
        // reliable success count. Failed pages leave no on-disk .md, so the
        // failure count is 0 outside a live run (a live run reports its own
        // failed count via runProgress).
        try {
          const scan = async (dir, base) => {
            const entries = await fs.listDir(await fs.resolve(dir))
            for (const e of entries) {
              if (e.type === 'directory') {
                if (e.name === '.claims' || e.name === '.git') continue
                await scan(`${dir}${sep}${e.name}`, `${base}${base ? '/' : ''}${e.name}`)
              } else if (e.name.endsWith('.md')) {
                pageCount += 1
              }
            }
          }
          await scan(wiki, '')
          successCount = pageCount
        } catch (err) {
          scanError = String(err && err.message ? err.message : err)
          // A missing openwiki dir (workspace never generated) is normal — do
          // not spam stderr, it's not a real error.
          if (!/not found|ENOENT|no such file/i.test(scanError)) {
            console.error(`openwiki: overview scan failed: ${scanError}`)
          }
          pageCount = 0
        }
      }
      // A failed run may leave failures in the last record; report them.
      if (run !== null) failedCount = run.failed
      // "Running" is a LIVE host job, not a stale on-disk .run.json (that file
      // lingers after a completed/interrupted run and must not read as 生成中).
      const liveJob = jobs.get(workspaceId)
      const runActive = liveJob !== undefined && liveJob.status === 'running'
      return {
        ok: true,
        workspaceId,
        workspaceTitle: ws.title,
        workspacePath: ws.path,
        wikiExists: manifest !== null || run !== null || hasPages || pageCount > 0,
        pageCount,
        successCount,
        failedCount,
        wikiDirRelative: `openwiki${sep ? '/' : '/'}`,
        scanError,
        runActive,
        runPhase: runActive && liveJob ? liveJob.phase : (run ? run.phase : null),
        runProgress: runActive && liveJob
          ? { total: liveJob.total, done: liveJob.done, pending: liveJob.pending, skipped: liveJob.skipped, failed: liveJob.failed }
          : (run ? { total: run.total, done: run.done, pending: run.pending, skipped: run.skipped, failed: run.failed } : null),
        lastUpdate: last,
      }
    }

    const readWikiClaims = async (args) => {
      const workspaceId = String((args && args.workspaceId) ?? '')
      const ws = workspaceOf(workspaceId)
      if (ws === undefined) return { ok: false, error: 'workspace 不存在或不可用' }
      const sep = ws.path.includes('\\') ? '\\' : '/'
      const claimsDir = `${wikiDir(ws.path)}${sep}.claims`
      const manifest = await readText(`${wikiDir(ws.path)}${sep}.page-manifest.json`)
      const claims = []

      // Manifest-driven page list when present; disk scan of .claims otherwise.
      const pages = []
      if (manifest !== null) {
        try {
          pages.push(...Object.keys(JSON.parse(manifest).pages ?? {}).map((rel) => String(rel).replace(/^\/openwiki\//u, '')))
        } catch { /* fall through to scan */ }
      }
      if (pages.length === 0 && fs !== undefined) {
        try {
          const scan = async (dir, base) => {
            const entries = await fs.listDir(await fs.resolve(dir))
            for (const e of entries) {
              if (e.type === 'directory') {
                await scan(`${dir}${sep}${e.name}`, `${base}${base ? '/' : ''}${e.name}`)
              } else if (e.name.endsWith('.json')) {
                pages.push(`${base}${base ? '/' : ''}${e.name}`.replace(/\.json$/u, '.md'))
              }
            }
          }
          await scan(claimsDir, '')
        } catch { /* keep whatever the manifest gave */ }
      }

      for (const pagePath of pages) {
        const claimRel = pagePath.replace(/\.md$/u, '.json')
        const raw = await readText(`${claimsDir}${sep}${claimRel.replace(/\//gu, sep)}`)
        if (raw === null) continue
        try {
          const sidecar = JSON.parse(raw)
          for (const c of sidecar.claims ?? []) {
            claims.push({
              id: c.id,
              statement: c.statement,
              evidenceCount: Array.isArray(c.evidence) ? c.evidence.length : 0,
              firstEvidence: Array.isArray(c.evidence) && c.evidence.length > 0 ? c.evidence[0].resource : null,
              page: pagePath,
            })
          }
        } catch { /* skip unreadable sidecar */ }
      }
      return { ok: true, claims }
    }

    // ------------------------------------------------------------------
    // Ignore file (.openwikiignore)
    // ------------------------------------------------------------------
    const readIgnore = async (args) => {
      const workspaceId = String((args && args.workspaceId) ?? '')
      const ws = workspaceOf(workspaceId)
      if (ws === undefined) return { ok: false, error: 'workspace 不存在或不可用' }
      const sep = ws.path.includes('\\') ? '\\' : '/'
      const content = await readText(`${ws.path}${sep}.openwikiignore`)
      return { ok: true, content: content ?? '', exists: content !== null }
    }

    const saveIgnore = async (args) => {
      const workspaceId = String((args && args.workspaceId) ?? '')
      const content = String((args && args.content) ?? '')
      const ws = workspaceOf(workspaceId)
      if (ws === undefined) return { ok: false, error: 'workspace 不存在或不可用' }
      if (fs === undefined) return { ok: false, error: 'fs 服务不可用' }
      const sep = ws.path.includes('\\') ? '\\' : '/'
      try {
        const target = await fs.resolve(`${ws.path}${sep}.openwikiignore`)
        await fs.writeText(target, content)
        return { ok: true }
      } catch (err) {
        return { ok: false, error: `写入失败: ${String(err && err.message ? err.message : err)}` }
      }
    }

    // ------------------------------------------------------------------
    // RPC handlers
    // ------------------------------------------------------------------
    harness.handle('openwiki/runtime/status', async () => runtimeStatus())
    harness.handle('openwiki/runtime/install', async () => install())
    harness.handle('openwiki/runtime/update', async () => update())
    harness.handle('openwiki/runtime/ensure', async () => ensure())
    harness.handle('openwiki/runtime/checkUpdate', async () => {
      const version = await readVersion()
      const latest = await readLatest()
      return { current: version, latest, hasUpdate: Boolean(version && latest && compareVersions(latest, version) > 0) }
    })
    harness.handle('openwiki/runtime/probe', async () => probe())

    // Model bridge (M2): status + sync to ~/.openwiki/.env.
    harness.handle('openwiki/model/status', async () => {
      const built = await buildOpenWikiEnv()
      const envStatus = await readOpenWikiEnvStatus()
      return {
        selection: built.selection ?? null,
        owProvider: built.owProvider ?? null,
        apiKeyEnv: built.apiKeyEnv ?? null,
        keyConfigured: built.ok,
        keySource: built.keySource ?? null,
        warnings: built.ok ? [] : [built.error ?? '模型映射未完成'],
        envExists: envStatus.exists,
        envPath: envStatus.path,
        envProvider: envStatus.values.OPENWIKI_PROVIDER ?? null,
        envModel: envStatus.values.OPENWIKI_MODEL_ID ?? null,
      }
    })
    harness.handle('openwiki/model/sync', async () => {
      const built = await buildOpenWikiEnv()
      if (!built.ok) return { ok: false, error: built.error, selection: built.selection ?? null }
      const applied = await applyEnvUpdates(built.updates)
      if (!applied.ok) return {
        ok: false,
        error: `写入 .env 失败: ${applied.error}`,
        selection: built.selection,
        command: applied.command ?? null,
      }
      return {
        ok: true,
        selection: built.selection,
        owProvider: built.owProvider,
        envPath: applied.path,
        via: applied.via ?? null,
        applied: Object.keys(built.updates),
      }
    })
    harness.handle('openwiki/model/env', async () => readOpenWikiEnvStatus())

    // Workspace list (authoritative DSH workspaceRegistry), used by the
    // knowledge-base project picker instead of the client useWorkspaces hook.
    harness.handle('openwiki/workspaces', async () => {
      const registry = ctx.get('workspaceRegistry')
      if (registry === undefined) return { ok: false, error: 'workspaceRegistry 服务不可用' }
      try {
        const list = registry.list().map((w) => ({ id: String(w.id), path: w.path, title: w.title }))
        return { ok: true, workspaces: list }
      } catch (err) {
        return { ok: false, error: String(err && err.message ? err.message : err) }
      }
    })

    harness.handle('openwiki/job/start', async (args) => startJob(args))
    harness.handle('openwiki/job/pause', async (args) => pauseJob(args))
    harness.handle('openwiki/job/resume', async (args) => resumeJob(args))
    harness.handle('openwiki/job/kill', async (args) => killJob(args))
    harness.handle('openwiki/job/status', async () => jobStatus())

    // Auto-update: enable/disable the git-HEAD polling watcher + report state.
    harness.handle('openwiki/autoupdate/set', async (args) => {
      const workspaceId = String((args && args.workspaceId) ?? '')
      const enabled = Boolean(args && args.enabled)
      if (!enabled) { stopAutoUpdate(); return { ok: true, enabled: false } }
      return startAutoUpdate(workspaceId)
    })
    harness.handle('openwiki/autoupdate/status', async () => ({
      enabled: autoUpdate.enabled,
      workspaceId: autoUpdate.workspaceId ?? null,
    }))

    harness.handle('openwiki/wiki/tree', async (args) => readWikiTree(args))
    harness.handle('openwiki/wiki/page', async (args) => readWikiPage(args))
    harness.handle('openwiki/wiki/overview', async (args) => readWikiOverview(args))
    harness.handle('openwiki/wiki/claims', async (args) => readWikiClaims(args))

    harness.handle('openwiki/ignore/get', async (args) => readIgnore(args))
    harness.handle('openwiki/ignore/save', async (args) => saveIgnore(args))

    harness.handle('openwiki/logs/tail', async () => ({ entries: [] }))

    // Auto-start: detect on load (idempotent, non-blocking; install only on demand).
    void ensure().then((res) => {
      console.log(`dsh-openwiki host: runtime ready=${res.ready} version=${res.version ?? '—'} error=${res.error ?? '—'}`)
    }).catch((err) => {
      console.error(`dsh-openwiki host: auto-start check failed: ${String(err && err.message ? err.message : err)}`)
    })

    console.log('dsh-openwiki host: M1 loaded')
  },
}
