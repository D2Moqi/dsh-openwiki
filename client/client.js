window.__ModuleLoader__.load({ id: "dsh-openwiki", factory: (require) => {
  var module = { exports: {} };
  var exports = module.exports;
  Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
  let React = require("react");
  let plugin = {
  apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined) return
    const timer = ctx.get('timer')

    // ------------------------------------------------------------------
    // Closure store
    // ------------------------------------------------------------------
    const createKbStore = () => {
      const listeners = new Set()
      let state = {
        open: false,
        runtime: null,
        model: null,
        busy: false,
        action: null,
        lastOutput: '',
        // Model-bridge (M2) feedback: belongs to the MODEL settings card, not
        // the runtime card (lastOutput is runtime-only).
        modelOutput: '',
        modelCommand: null,
        workspaces: [],
        selected: null,
        overview: null,
        tree: null,
        page: null,
        claims: null,
        jobs: [],
        tab: 'wiki',           // 'wiki' | 'cards'
        search: '',
        tabs: [],              // open document tabs [{path,title}]
        activeTab: null,
        browseDir: null,       // folder currently browsed in the right panel
        docView: 'preview',    // 'preview' | 'code' | 'toc'
        tocOpen: false,        // toc popover open (docs view toolbar)
        showIgnore: false,
        ignoreContent: '',
        error: null,
        // Neutral (non-error) info line shown in the KB window, e.g. "检测到
        // 未完成的任务，将从断点继续"。
        notice: null,
        // Optional openwiki generation model override (--modelId); empty =
        // follow the DSH default model. NOTE: named genModel because the store
        // key `model` is owned by the DSH model-status payload (refreshModel).
        genModel: '',
        // Floating window geometry (fixed overlay window, draggable/resizable).
        win: { x: 120, y: 80, w: 860, h: 620, max: false },
        // Left column width (px) of the kb layout; draggable via a resizer bar.
        leftWidth: 300,
        // Collapsible tree: set of directory keys currently expanded.
        expandedDirs: {},
        // better-sidebar integration (detected client-side at render time).
        sidebar: null,        // null=unknown, false=not connected, {}=connected
        sidebarRegistered: false,
        // Whether the "openwiki知识库" left footer entry + entry shows at all.
        showEntry: true,
        // Document content language passed to openwiki (-l/--language, BCP-47).
        language: 'zh',
        // Auto-update watcher state (host polls git HEAD and regenerates).
        autoUpdate: { enabled: false },
      }
      return {
        get: () => state,
        set: (patch) => {
          state = { ...state, ...patch }
          listeners.forEach((fn) => fn())
        },
        subscribe: (fn) => {
          listeners.add(fn)
          return () => listeners.delete(fn)
        },
      }
    }
    const kb = createKbStore()

    // Restore user preferences: entry visibility + document language
    // (persisted in localStorage).
    try {
      const stored = window.localStorage.getItem('dsh-openwiki:showEntry')
      if (stored === '0') kb.set({ showEntry: false })
      const lang = window.localStorage.getItem('dsh-openwiki:language')
      if (lang) kb.set({ language: lang })
      const mdl = window.localStorage.getItem('dsh-openwiki:model')
      if (mdl) kb.set({ genModel: mdl })
    } catch { /* localStorage unavailable */ }

    const useKb = () => {
      const [snap, setSnap] = React.useState(kb.get())
      React.useEffect(() => kb.subscribe(() => setSnap(kb.get())), [])
      return snap
    }

    const call = (method, args) => rpc.call(method, args)

    // Detect the dsh-better-sidebar service (client-side Cordis service).
    // Exposed via ctx.provide('betterSidebar') by that plugin; we read it with
    // ctx.get so the sidebar integration works only when the plugin is mounted.
    const detectSidebar = () => {
      try {
        const svc = ctx.get('betterSidebar')
        if (svc !== undefined) return { connected: true, service: svc }
      } catch { /* service absent */ }
      return { connected: false, service: null }
    }

    const refreshSidebar = () => {
      const d = detectSidebar()
      kb.set({ sidebar: { connected: d.connected } })
      return d.connected
    }

    // Auto-update watcher: read state and toggle from host.
    const fetchAutoUpdate = () => {
      call('openwiki/autoupdate/status', {})
        .then((res) => { if (res && typeof res === 'object') kb.set({ autoUpdate: { enabled: Boolean(res.enabled) } }) })
        .catch(() => {})
    }

    const toggleAutoUpdate = () => {
      const workspaceId = kb.get().selected
      if (!workspaceId) { kb.set({ error: '请先选择一个工作区' }); return }
      const nextEnabled = !kb.get().autoUpdate.enabled
      call('openwiki/autoupdate/set', { workspaceId, enabled: nextEnabled })
        .then((res) => {
          if (res && res.ok === false) kb.set({ error: res.error })
          else kb.set({ autoUpdate: { enabled: nextEnabled } })
        })
        .catch((err) => kb.set({ error: `自动更新切换失败：${String(err && err.message ? err.message : err)}` }))
    }


    const refreshRuntime = () => {
      kb.set({ busy: true, lastOutput: '' })
      call('openwiki/runtime/status', {})
        .then((res) => {
          // Normalize an RPC-level failure into the same shape as a host
          // status, so the footer entry never misreads it as "未安装".
          const payload = res && typeof res === 'object' ? res : {}
          kb.set({
            runtime: payload.ok === false
              ? { installed: false, error: payload.error || '运行时状态查询失败' }
              : payload,
            busy: false,
          })
        })
        .catch((err) => kb.set({
          runtime: { installed: false, error: String(err && err.message ? err.message : err) },
          busy: false,
        }))
    }

    const refreshModel = () => {
      kb.set({ busy: true })
      call('openwiki/model/status', {})
        .then((res) => kb.set({ model: res, busy: false }))
        .catch((err) => kb.set({ model: { error: String(err && err.message ? err.message : err) }, busy: false }))
    }

    const runAction = (method, label, args) => {
      kb.set({ busy: true, action: label, lastOutput: '' })
      call(method, args)
        .then((res) => {
          // refreshRuntime()/refreshModel() publish busy + clear lastOutput
          // (and are async), so run them FIRST and publish the action result
          // LAST — otherwise a probe's output would be wiped immediately.
          refreshRuntime()
          refreshModel()
          if (res && typeof res === 'object' && res.ok === false) {
            kb.set({ lastOutput: `错误：${res.error}\n${res.output ?? ''}`, busy: false, action: null })
          } else {
            const out = (res && res.output ? res.output : '') || (res && res.error ? res.error : '')
            // Always leave a visible result so a probe/check that ran clean (no
            // stdout) still gives feedback instead of silently doing nothing.
            kb.set({ lastOutput: out || '命令执行成功（无输出）。', busy: false, action: null })
          }
        })
        .catch((err) => kb.set({
          busy: false,
          action: null,
          lastOutput: `调用失败：${String(err && err.message ? err.message : err)}`,
        }))
    }

    // Model sync (M2): independent of runtime actions, so its result/error is
    // published to the MODEL card (modelOutput) instead of the runtime card's
    // lastOutput. A permission failure returns a copy-paste command (the
    // user runs it in a terminal) instead of a dead-end error row.
    const syncModel = () => {
      kb.set({ busy: true, modelOutput: '', modelCommand: null })
      call('openwiki/model/sync', {})
        .then((res) => {
          const payload = res && typeof res === 'object' ? res : {}
          if (payload.ok) {
            const via = payload.via === 'node'
              ? '（经 node 子进程写入，绕过工作区沙箱限制）'
              : '（经 DSH fs 服务写入）'
            kb.set({
              modelOutput: `同步成功${via}：\n${(payload.applied ?? []).join('、')}\n写入：${payload.envPath ?? '~/.openwiki/.env'}`,
              modelCommand: null,
              busy: false,
            })
          } else {
            kb.set({
              modelOutput: `同步失败：${payload.error ?? '未知错误'}`,
              modelCommand: payload.command ?? null,
              busy: false,
            })
          }
          refreshModel()
        })
        .catch((err) => kb.set({
          busy: false,
          modelOutput: `同步调用失败：${String(err && err.message ? err.message : err)}`,
        }))
    }

    // ------------------------------------------------------------------
    // Knowledge-base actions
    // ------------------------------------------------------------------
    const refreshJobs = () => {
      call('openwiki/job/status', {})
        .then((res) => kb.set({ jobs: (res && res.jobs) || [] }))
        .catch(() => {})
    }

    const loadWorkspaces = (workspaces) => {
      const items = workspaces || []
      kb.set({ workspaces: items })
      if (items.length > 0 && kb.get().selected === null) {
        selectWorkspace(items[0].id)
      }
    }

    // Fetch the workspace list from the host registry (authoritative).
    const fetchWorkspaces = () => {
      call('openwiki/workspaces', {})
        .then((res) => {
          if (res && res.ok && Array.isArray(res.workspaces)) loadWorkspaces(res.workspaces)
        })
        .catch(() => {})
    }

    const selectWorkspace = (id) => {
      kb.set({ selected: id, tree: null, page: null, overview: null, claims: null, tabs: [], activeTab: null, browseDir: null, error: null, showIgnore: false })
      if (!id) return
      refreshWorkspace(id)
    }

    const refreshWorkspace = (id) => {
      const workspaceId = id || kb.get().selected
      if (!workspaceId) return
      call('openwiki/wiki/overview', { workspaceId })
        .then((res) => kb.set({ overview: res }))
        .catch(() => {})
      call('openwiki/wiki/tree', { workspaceId })
        .then((res) => {
          // Expand all directories by default when (re)loading a tree.
          if (res && res.ok && Array.isArray(res.pages)) {
            const expanded = { ...(kb.get().expandedDirs || {}) }
            expandAllDirs(buildTree(res.pages), expanded)
            kb.set({ tree: res, expandedDirs: expanded })
          } else {
            kb.set({ tree: res })
          }
        })
        .catch(() => {})
      const s = kb.get()
      if (s.tab === 'cards') {
        call('openwiki/wiki/claims', { workspaceId })
          .then((res) => kb.set({ claims: res }))
          .catch(() => {})
      }
      if (s.showIgnore) loadIgnore(workspaceId)
    }

    const loadIgnore = (workspaceId) => {
      call('openwiki/ignore/get', { workspaceId: workspaceId || kb.get().selected })
        .then((res) => { if (res && res.ok) kb.set({ ignoreContent: res.content ?? '' }) })
        .catch(() => {})
    }

    const saveIgnore = () => {
      const workspaceId = kb.get().selected
      call('openwiki/ignore/save', { workspaceId, content: kb.get().ignoreContent })
        .then((res) => {
          kb.set({ error: res && res.ok ? null : (res && res.error || '保存失败') })
          if (res && res.ok) kb.set({ showIgnore: false })
        })
        .catch((err) => kb.set({ error: `保存失败：${String(err && err.message ? err.message : err)}` }))
    }

    const openPage = (path) => {
      const workspaceId = kb.get().selected
      if (!workspaceId) return
      // Keep the path verbatim: the tree (disk-scan fallback) and in-doc links
      // both carry ".md"; host readWikiPage appends it directly to the wiki dir.
      const norm = String(path)
      const s = kb.get()
      const known = s.tabs.find((t) => t.path === norm)
      if (known) {
        kb.set({ activeTab: norm, browseDir: null })
        if (s.page && s.page.path === norm) return
      } else {
        kb.set({ tabs: [...s.tabs, { path: norm, title: norm.split('/').pop().replace(/\.md$/u, '') }], browseDir: null })
      }
      kb.set({ activeTab: norm, browseDir: null, page: { loading: true, path: norm } })
      call('openwiki/wiki/page', { workspaceId, path: norm })
        .then((res) => kb.set({ page: res }))
        .catch((err) => kb.set({ page: { ok: false, error: String(err && err.message ? err.message : err) } }))
    }

    // Browse a folder in the right panel: list that directory's pages (from the
    // loaded tree) so a folder link in the index can be drilled into, and each
    // file can be opened.
    const browseDirectory = (dir) => {
      const s = kb.get()
      const dirKey = String(dir || '').replace(/\/+$/u, '')
      kb.set({ browseDir: dirKey, page: null, activeTab: null })
      // Ensure the tree is loaded (needed to enumerate the folder's pages).
      if (s.selected && (s.tree === null || s.tree.ok === false)) refreshWorkspace(s.selected)
    }

    const closeTab = (path) => {
      const s = kb.get()
      const tabs = s.tabs.filter((t) => t.path !== path)
      let activeTab = s.activeTab
      if (activeTab === path) {
        activeTab = tabs.length > 0 ? tabs[tabs.length - 1].path : null
        if (activeTab) {
          const last = tabs[tabs.length - 1]
          kb.set({ page: { loading: true, path: last.path } })
          call('openwiki/wiki/page', { workspaceId: s.selected, path: last.path })
            .then((res) => kb.set({ page: res }))
            .catch(() => {})
        } else {
          kb.set({ page: null })
        }
      }
      kb.set({ tabs, activeTab })
    }

    /**
     * Normalize the configured document-content language into the BCP-47 code
     * openwiki's `-l/--language` accepts. Mirrors openwiki's own
     * resolveLanguage (platform/language.js): a tag is valid only when
     * Intl.DisplayNames recognizes its primary subtag (a structurally valid
     * but unknown tag like "English" does NOT pass — openwiki would warn and
     * fall back). Well-known language names ("English", "chinese") map to
     * their codes so a plain name in the settings input also works.
     */
    const normalizeLanguage = (raw) => {
      const input = String(raw || '').trim().replace(/\s+/gu, ' ')
      if (!input) return { code: null, error: null, empty: true }
      const KNOWN = ['en', 'zh', 'zh-CN', 'zh-TW', 'ja', 'ko', 'fr', 'de', 'es', 'it', 'ru', 'pt', 'pt-BR', 'hi', 'ar', 'nl', 'pl', 'tr', 'vi', 'th', 'id', 'uk', 'cs', 'sv', 'da', 'fi', 'no', 'he', 'fa', 'el']
      try {
        const display = new Intl.DisplayNames(['en'], { type: 'language' })
        const canonical = Intl.getCanonicalLocales(input)[0]
        const primary = new Intl.Locale(canonical).language
        const name = display.of(primary)
        if (name && name.toLowerCase() !== primary.toLowerCase()) return { code: canonical, error: null }
      } catch { /* fall through to name matching below */ }
      try {
        const display = new Intl.DisplayNames(['en'], { type: 'language' })
        const lower = input.toLowerCase()
        let exact = null
        let partial = null
        for (const code of KNOWN) {
          const name = display.of(code)
          if (!name) continue
          const n = name.toLowerCase()
          if (n === lower) exact = code
          else if (!partial && n.includes(lower)) partial = code
        }
        if (exact) return { code: exact, error: null }
        if (partial) return { code: partial, error: null }
      } catch { /* DisplayNames unavailable */ }
      return { code: null, error: `无法识别的语言 "${input}"：openwiki 使用 BCP-47 语言代码（如 zh / en / zh-CN），或常见语言名（如 English、中文）` }
    }

    const startJob = (mode) => {
      const workspaceId = kb.get().selected
      const overview = kb.get().overview
      const raw = kb.get().language
      const normalized = normalizeLanguage(raw)
      if (normalized.error) {
        kb.set({ error: `文档语言设置无效：${normalized.error}` })
        return
      }
      const language = normalized.code || ((overview && overview.lastUpdate && overview.lastUpdate.language) || 'zh')
      const model = String(kb.get().genModel || '').trim() || undefined
      kb.set({ error: null })
      call('openwiki/job/start', { workspaceId, mode, language, model })
        .then((res) => {
          if (res && res.ok === false) {
            kb.set({ error: res.error })
          } else if (res && res.resumed) {
            const rmode = res.resumedMode === 'update' ? '增量更新' : '初始化'
            kb.set({ error: null, notice: `检测到之前未完成的生成任务（已保存断点），openwiki 将从断点继续（${rmode} · 语言 ${res.resumedLanguage || language}${model ? `、模型 ${model}` : ''}）` })
          }
          refreshJobs()
        })
        .catch((err) => kb.set({ error: `任务启动失败：${String(err && err.message ? err.message : err)}` }))
    }

    const pauseJob = () => {
      const workspaceId = kb.get().selected
      call('openwiki/job/pause', { workspaceId })
        .then((res) => {
          if (res && res.ok === false) kb.set({ error: res.error })
          refreshJobs()
        })
        .catch((err) => kb.set({ error: `暂停失败：${String(err && err.message ? err.message : err)}` }))
    }

    const resumeJob = () => {
      const workspaceId = kb.get().selected
      kb.set({ error: null })
      call('openwiki/job/resume', { workspaceId })
        .then((res) => {
          if (res && res.ok === false) kb.set({ error: res.error })
          refreshJobs()
        })
        .catch((err) => kb.set({ error: `继续失败：${String(err && err.message ? err.message : err)}` }))
    }

    const killJob = () => {
      const workspaceId = kb.get().selected
      call('openwiki/job/kill', { workspaceId })
        .then((res) => {
          if (res && res.abandoned) kb.set({ error: '已放弃暂停中的任务（openwiki 的 .run.json 保留，下次生成会从断点恢复；如需全新生成请先完成该次任务）' })
          refreshJobs()
        })
        .catch(() => {})
    }

    let lastErrorJobId = null
    if (timer !== undefined) {
      timer.interval(() => {
        const s = kb.get()
        if (!s.open) return
        refreshJobs()
        // Surface a failed generation: the selected workspace's job may go
        // running→error quickly (e.g. openwiki needs a git repo but the
        // workspace has none) with no other feedback — show it on the error row.
        const errJob = (s.jobs || []).find((j) => j.workspaceId === s.selected && j.status === 'error')
        if (errJob && errJob.jobId !== lastErrorJobId) {
          lastErrorJobId = errJob.jobId
          kb.set({ error: `生成失败：${errJob.message || errJob.phase || '未知错误'}` })
        } else if (!errJob) {
          lastErrorJobId = null
        }
        // Only poll the workspace docs (tree/overview) while a live job is
        // running; a full disk scan of the whole wiki every 3s otherwise
        // churns the disk and can sluggish the UI. Idle just shows job state.
        const running = (s.jobs || []).some((j) => j.workspaceId === s.selected && j.status === 'running')
        if (running) refreshWorkspace(s.selected)
        // Always refresh the overview so the status card's counts stay fresh.
        else if (s.selected) call('openwiki/wiki/overview', { workspaceId: s.selected })
          .then((res) => { if (res && res.ok) kb.set({ overview: res }) })
          .catch(() => {})
      }, 3000)
    }

    // ------------------------------------------------------------------
    // Markdown rendering (lightweight, no deps)
    // ------------------------------------------------------------------
    const esc = (s) => String(s)

    // Current wiki document relative path (set per renderDoc preview pass).
    // Used to resolve in-document relative links into wiki page paths.
    let currentWikiPath = null

    // Navigate an in-document link in-app: resolve its target (relative to the
    // current page) into a wiki page path and open it, instead of crunching the
    // browser away to a raw file:// URL.
    const openWikiLink = (href) => {
      let target = String(href ?? '')
      const hashIdx = target.indexOf('#')
      if (hashIdx >= 0) target = target.slice(0, hashIdx)
      const qIdx = target.indexOf('?')
      if (qIdx >= 0) target = target.slice(0, qIdx)
      if (target === '') return
      // A trailing slash (or "/openwiki/foo/") marks a FOLDER link: browsing it
      // shows the folder's file list instead of trying to open a page.
      const isFolder = target.endsWith('/') || /\/openwiki\/[^/]+\/$/u.test(target)
      target = target.replace(/^\.\//u, '')
      // Absolute links (leading "/" or the "/openwiki/" prefix the tree reader
      // also strips) resolve to the wiki root; the prefix-stripped remainder is
      // already a complete relative path, so it must NOT be joined to the
      // current page's directory.
      const isAbsolute = target.startsWith('/') || target.startsWith('/openwiki/')
      if (target.startsWith('/openwiki/')) {
        target = target.replace(/^\/openwiki\//u, '')
      } else {
        target = target.replace(/^\/+/u, '')
      }
      if (!isAbsolute) {
        const dir = currentWikiPath ? currentWikiPath.split('/').slice(0, -1).join('/') : ''
        target = dir ? `${dir}/${target}` : target
      }
      // Normalize '.' / '..' segments.
      const parts = target.split('/')
      const stack = []
      for (const part of parts) {
        if (part === '..') stack.pop()
        else if (part !== '.' && part !== '') stack.push(part)
      }
      const resolved = stack.join('/')
      if (resolved.length === 0) return
      if (isFolder) browseDirectory(resolved)
      else openPage(resolved)
    }

    const renderInline = (text, keyBase) => {
      const nodes = []
      const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))/gu
      let last = 0
      let m
      let i = 0
      while ((m = re.exec(text)) !== null) {
        if (m.index > last) nodes.push(esc(text.slice(last, m.index)))
        if (m[1]) {
          nodes.push(React.createElement('code', { key: `${keyBase}-${i}` }, m[1].slice(1, -1)))
        } else if (m[2]) {
          nodes.push(React.createElement('strong', { key: `${keyBase}-${i}` }, m[2].slice(2, -2)))
        } else if (m[3]) {
          nodes.push(React.createElement('em', { key: `${keyBase}-${i}` }, m[3].slice(1, -1)))
        } else if (m[4]) {
          const lm = m[4].match(/^\[([^\]]+)\]\(([^)]+)\)$/u)
          if (lm) {
            const href = lm[2]
            // External scheme (http/https/mailto/...) → new tab. Everything else
            // is treated as an internal wiki link and routed in-app.
            const isExternal = /^[a-z][a-z0-9+.-]*:/i.test(href)
            if (isExternal) {
              nodes.push(React.createElement('a', { key: `${keyBase}-${i}`, href, target: '_blank', rel: 'noreferrer' }, lm[1]))
            } else {
              nodes.push(React.createElement('a', {
                key: `${keyBase}-${i}`,
                href: '#',
                className: 'owk-wiki-link',
                onClick: (e) => {
                  e.preventDefault()
                  openWikiLink(href)
                },
              }, lm[1]))
            }
          } else {
            nodes.push(esc(m[4]))
          }
        }
        last = m.index + m[0].length
        i += 1
      }
      if (last < text.length) nodes.push(esc(text.slice(last)))
      return nodes
    }

    const renderMarkdown = (md) => {
      const lines = String(md || '').split(/\r?\n/u)
      const out = []
      let i = 0
      let key = 0
      let tocIndex = 0
      while (i < lines.length) {
        const line = lines[i]
        const keyId = key
        key += 1
        // fenced code block (also matches "```ts type-equiv" style info strings
        // with spaces, which a `^```(\S*)\s*$` regex rejects — that would leave
        // the line to the paragraph branch whose `!/^```/` guard then never
        // advances i, looping forever.)
        const fence = line.startsWith('```') ? true : null
        if (fence) {
          const buf = []
          i += 1
          while (i < lines.length && !/^```\s*$/u.test(lines[i])) {
            buf.push(lines[i])
            i += 1
          }
          i += 1
          out.push(React.createElement('pre', { key: keyId },
            React.createElement('code', null, buf.join('\n'))))
          continue
        }
        // headings
        const h = line.match(/^(#{1,6})\s+(.*)$/u)
        if (h) {
          const level = h[1].length
          const title = h[2]
          const tag = `h${level}`
          // Anchors are numbered by h2-h4 order only, matching extractToc().
          const anchor = level >= 2 && level <= 4 ? `owk-h-${tocIndex++}` : undefined
          out.push(React.createElement(tag, { key: keyId, id: anchor }, renderInline(title, keyId)))
          i += 1
          continue
        }
        // hr
        if (/^\s*(---+|\*\*\*+)\s*$/u.test(line)) {
          out.push(React.createElement('hr', { key: keyId }))
          i += 1
          continue
        }
        // blockquote
        if (line.startsWith('>')) {
          const buf = []
          while (i < lines.length && lines[i].startsWith('>')) {
            buf.push(lines[i].replace(/^>\s?/u, ''))
            i += 1
          }
          out.push(React.createElement('blockquote', { key: keyId }, renderInline(buf.join(' '), keyId)))
          continue
        }
        // table (consecutive | rows)
        if (line.includes('|') && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/u.test(lines[i + 1]) && lines[i + 1].includes('-')) {
          const rows = []
          while (i < lines.length && lines[i].includes('|')) {
            const cells = lines[i].replace(/^\|/u, '').replace(/\|$/u, '').split('|').map((c) => c.trim())
            rows.push(cells)
            i += 1
          }
          if (rows.length > 1) {
            const head = rows[0]
            const body = rows.slice(2)
            out.push(React.createElement('table', { key: keyId },
              React.createElement('thead', null,
                React.createElement('tr', null, head.map((c, ci) => React.createElement('th', { key: ci }, renderInline(c, `${keyId}-h${ci}`))))),
              React.createElement('tbody', null,
                body.map((row, ri) =>
                  React.createElement('tr', { key: ri },
                    row.map((c, ci) => React.createElement('td', { key: ci }, renderInline(c, `${keyId}-b${ri}-${ci}`))))))))
          }
          continue
        }
        // list
        const ul = line.match(/^\s*[-*]\s+(.*)$/u)
        if (ul) {
          const items = []
          while (i < lines.length) {
            const m2 = lines[i].match(/^\s*[-*]\s+(.*)$/u)
            if (!m2) break
            items.push(React.createElement('li', { key: items.length }, renderInline(m2[1], `${keyId}-${items.length}`)))
            i += 1
          }
          out.push(React.createElement('ul', { key: keyId }, items))
          continue
        }
        const ol = line.match(/^\s*\d+\.\s+(.*)$/u)
        if (ol) {
          const items = []
          while (i < lines.length) {
            const m2 = lines[i].match(/^\s*\d+\.\s+(.*)$/u)
            if (!m2) break
            items.push(React.createElement('li', { key: items.length }, renderInline(m2[1], `${keyId}-${items.length}`)))
            i += 1
          }
          out.push(React.createElement('ol', { key: keyId }, items))
          continue
        }
        // blank line
        if (line.trim().length === 0) {
          i += 1
          continue
        }
        // paragraph: collect until blank
        const buf = []
        while (i < lines.length && lines[i].trim().length > 0 && !/^(#{1,6})\s+/u.test(lines[i]) && !/^```/u.test(lines[i])) {
          buf.push(lines[i])
          i += 1
        }
        out.push(React.createElement('p', { key: keyId }, renderInline(buf.join(' '), keyId)))
      }
      return out
    }

    // ------------------------------------------------------------------
    // Tree with search filter (PRD §9: parent bubbling)
    // ------------------------------------------------------------------
    const filterPages = (pages, q) => {
      if (!q) return pages
      const lower = q.toLowerCase()
      const hit = (p) => p.title.toLowerCase().includes(lower) || p.path.toLowerCase().includes(lower)
      const hits = pages.filter(hit)
      if (hits.length === 0) return []
      const hitDirs = new Set()
      for (const h of hits) {
        const segs = h.path.split('/')
        for (let i = 1; i < segs.length; i += 1) hitDirs.add(segs.slice(0, i).join('/'))
      }
      return pages.filter((p) => hit(p) || hitDirs.has(p.path.split('/').slice(0, -1).join('/')))
    }

    const buildTree = (pages) => {
      const root = { path: '', dirs: {}, pages: [] }
      for (const p of pages || []) {
        const segs = p.path.split('/')
        let node = root
        let prefix = ''
        for (let i = 0; i < segs.length - 1; i += 1) {
          const s = segs[i]
          prefix = prefix ? `${prefix}/${s}` : s
          if (node.dirs[s] === undefined) node.dirs[s] = { path: prefix, dirs: {}, pages: [] }
          node = node.dirs[s]
        }
        node.pages.push(p)
      }
      return root
    }

    // Mark every directory node as expanded the first time a tree loads (so the
    // tree shows fully expanded, not collapsed, by default). `expandAll` is
    // invoked when a workspace's tree is (re)built.
    const expandAllDirs = (node, expanded) => {
      for (const dirName of Object.keys(node.dirs || {})) {
        const dirNode = node.dirs[dirName]
        expanded[dirNode.path] = true
        expandAllDirs(dirNode, expanded)
      }
      return expanded
    }

    const toggleDir = (key) => {
      const cur = kb.get().expandedDirs || {}
      kb.set({ expandedDirs: { ...cur, [key]: !cur[key] } })
    }

    const renderTree = (node, depth, onOpen, selectedPath, expandedDirs) => {
      const children = []
      // Sort pages with index/quickstart first (they are the entry docs), then
      // alphabetically. Root-level pages render BEFORE directories so index and
      // quickstart appear at the top of the tree.
      const pageWeight = (p) => {
        const name = (p.path.split('/').pop() || '').toLowerCase()
        if (name === 'index.md' || name === 'index') return 0
        if (name === 'quickstart.md' || name === 'quickstart') return 1
        return 2
      }
      const sortedPages = (node.pages || []).slice().sort((a, b) => {
        const wa = pageWeight(a)
        const wb = pageWeight(b)
        if (wa !== wb) return wa - wb
        return (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' })
      })
      for (const p of sortedPages) {
        children.push(
          React.createElement('button', {
            key: `p-${p.path}`,
            type: 'button',
            className: `owk-tree-item${selectedPath === p.path ? ' sel' : ''}`,
            style: { paddingLeft: 4 + depth * 14 },
            onClick: () => onOpen(p.path),
          },
            React.createElement('span', null, p.status === 'complete' ? '✓' : '◐'),
            React.createElement('span', null, p.title),
          ),
        )
      }
      const dirNames = Object.keys(node.dirs || {}).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      for (const dirName of dirNames) {
        const dirNode = node.dirs[dirName]
        const key = dirNode.path !== undefined ? dirNode.path : dirName
        const isOpen = expandedDirs[key] === true
        const childCount = (dirNode.pages ? dirNode.pages.length : 0) + Object.keys(dirNode.dirs || {}).length
        children.push(
          React.createElement('div', { key: `d-${dirName}` },
            React.createElement('button', {
              type: 'button',
              className: 'owk-tree-item owk-tree-dir',
              style: { paddingLeft: 4 + depth * 14 },
              onClick: () => toggleDir(key),
            },
              React.createElement('span', null, isOpen ? '▾' : '▸'),
              React.createElement('span', null, '📁'),
              React.createElement('span', null, dirName),
              React.createElement('span', { className: 'owk-muted', style: { marginLeft: 4 } }, childCount)),
            isOpen ? renderTree(dirNode, depth + 1, onOpen, selectedPath, expandedDirs) : null,
          ),
        )
      }
      return React.createElement('div', null, children)
    }

    const renderProgress = (job) => {
      if (!job) return null
      const pct = job.total > 0 ? Math.round((job.done / job.total) * 100) : 0
      const paused = job.status === 'paused'
      // 「暂停中…」：host 已发出终止信号、进程尚未退出（phase='pausing'）。
      // 这 1~2 秒内按钮保持禁用并显示加载反馈，避免用户误以为没有响应。
      const pausing = !paused && job.phase === 'pausing'
      const tagClass = paused ? 'owk-tag-warn' : 'owk-tag-run'
      const tagText = paused ? '已暂停' : (pausing ? '暂停中…' : (job.phase === 'cancelled' ? '已取消' : job.phase))
      // 布局：第一行 = 状态标签 + 文案（可换行）；第二行 = 操作按钮，始终
      // 独立成行且不被长文案挤压（原先按钮与文案同行会被 Flex-wrap 挤走）。
      const buttons = paused
        ? [
            React.createElement('button', {
              key: 'resume',
              type: 'button',
              className: 'owk-btn owk-btn-primary',
              onClick: () => resumeJob(),
            }, '继续'),
            React.createElement('button', {
              key: 'abandon',
              type: 'button',
              className: 'owk-btn',
              onClick: () => killJob(),
            }, '放弃'),
          ]
        : [
            React.createElement('button', {
              key: 'pause',
              type: 'button',
              className: 'owk-btn',
              disabled: pausing,
              onClick: () => pauseJob(),
            }, pausing ? '暂停中…' : '暂停'),
            React.createElement('button', {
              key: 'cancel',
              type: 'button',
              className: 'owk-btn',
              disabled: pausing,
              onClick: () => killJob(),
            }, '取消'),
          ]
      return React.createElement('div', { className: 'owk-card' },
        React.createElement('div', { className: 'owk-row' },
          React.createElement('span', { className: `owk-tag ${tagClass}` }, tagText),
          React.createElement('span', null, job.message),
        ),
        React.createElement('div', { className: 'owk-row', style: { marginTop: 6 } },
          buttons,
        ),
        React.createElement('div', { className: 'owk-progress', style: { marginTop: 6 } },
          React.createElement('div', { className: 'owk-progress-fill', style: { width: `${pct}%` } })),
      )
    }

    const extractToc = (body) => {
      const toc = []
      for (const line of String(body || '').split(/\r?\n/u)) {
        const m = line.match(/^(#{2,4})\s+(.*)$/u)
        if (m) toc.push({ level: m[1].length, title: m[2] })
      }
      return toc
    }

    const renderDoc = (snap) => {
      // Folder browse mode: a folder link (e.g. "architecture/") in the index
      // shows that folder's file list; clicking a file opens it.
      if (snap.browseDir) {
        const dir = snap.browseDir
        const tree = snap.tree
        const pages = tree && tree.ok ? tree.pages : []
        const prefix = dir ? `${dir}/` : ''
        const files = pages
          .filter((p) => p.path.startsWith(prefix) && p.path.slice(prefix.length).indexOf('/') === -1)
          .sort((a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }))
        return React.createElement('div', null,
          React.createElement('div', { className: 'owk-row', style: { marginBottom: 8 } },
            React.createElement('span', { className: 'owk-icon' }, '📂'),
            React.createElement('span', { style: { fontWeight: 600 } }, dir ? `目录：${dir}` : '根目录'),
            React.createElement('span', { className: 'owk-overlay-spacer' }),
            React.createElement('button', {
              type: 'button',
              className: 'owk-btn',
              onClick: () => kb.set({ browseDir: null }),
            }, '返回')),
          files.length === 0
            ? React.createElement('div', { className: 'owk-empty' }, '该目录下暂无文档')
            : React.createElement('div', { className: 'owk-card' },
                files.map((p) =>
                  React.createElement('button', {
                    key: p.path,
                    type: 'button',
                    className: 'owk-tree-item',
                    style: { paddingLeft: 8 },
                    onClick: () => openPage(p.path),
                  },
                    React.createElement('span', null, '📄'),
                    React.createElement('span', null, p.title),
                    React.createElement('span', { className: 'owk-muted', style: { marginLeft: 4 } }, p.path)))))
      }
      const page = snap.page
      if (page === null) return React.createElement('div', { className: 'owk-empty' }, 'Wiki 将在生成完成后显示在这里')
      if (page.loading) return React.createElement('div', { className: 'owk-empty' }, '渲染中...')
      if (page.ok === false) return React.createElement('div', { className: 'owk-empty' }, page.error || 'Repo Wiki 生成失败，请重试。')
      const sources = page.frontmatter && Array.isArray(page.frontmatter.sources) ? page.frontmatter.sources : []
      const toc = extractToc(page.content)
      // Toolbar order: 目录 / 预览 / 代码. "目录" toggles a split pane below the
      // toolbar: the left column lists the headings (its own vertical scrollbar,
      // sticky so it does not scroll away with the content), the right column is
      // the document. Clicking an entry scrolls the preview to that heading and
      // keeps the pane open.
      const goToHeading = (aIndex) => {
        kb.set({ tab: 'wiki', docView: 'preview' })
        // Let the preview re-render before scrolling.
        setTimeout(() => {
          try {
            const el = document.getElementById(`owk-h-${aIndex}`)
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
          } catch { /* noop */ }
        }, 40)
      }
      const tocPane = React.createElement('div', { className: 'owk-toc-pane' },
        toc.length === 0
          ? React.createElement('div', { className: 'owk-muted', style: { padding: '8px 12px' } }, '本文档无二级及以上标题')
          : toc.map((t, i) =>
              React.createElement('button', {
                key: i,
                type: 'button',
                className: 'owk-tree-item',
                style: { paddingLeft: 8 + (t.level - 2) * 16 },
                onClick: () => goToHeading(i),
              }, t.title)))
      const viewSwitch = React.createElement('div', { className: 'owk-row', style: { marginBottom: 8 } },
        React.createElement('button', {
          type: 'button',
          className: `owk-btn${snap.tocOpen ? ' owk-btn-primary' : ''}`,
          onClick: () => {
            if (snap.docView === 'code') kb.set({ docView: 'preview' })
            kb.set({ tocOpen: !snap.tocOpen })
          },
        }, '目录'),
        React.createElement('button', {
          type: 'button',
          className: `owk-btn${snap.docView === 'preview' ? ' owk-btn-primary' : ''}`,
          onClick: () => kb.set({ docView: 'preview', tocOpen: false }),
        }, '预览'),
        React.createElement('button', {
          type: 'button',
          className: `owk-btn${snap.docView === 'code' ? ' owk-btn-primary' : ''}`,
          onClick: () => kb.set({ docView: 'code', tocOpen: false }),
        }, '代码'),
        React.createElement('span', { className: 'owk-overlay-spacer' }),
        React.createElement('span', { className: 'owk-muted' },
          sources.length > 0 ? `章节来源：${sources.join('，')}` : ''),
      )
      if (snap.docView === 'code') {
        return React.createElement('div', null,
          viewSwitch,
          React.createElement('pre', { className: 'owk-pre', style: { maxHeight: 'none' } }, page.content))
      }
      currentWikiPath = page.path
      return React.createElement('div', { className: 'owk-doc-split' },
        snap.tocOpen ? tocPane : null,
        React.createElement('div', { className: 'owk-doc-main' },
          viewSwitch,
          React.createElement('div', { className: 'owk-doc' }, renderMarkdown(page.content))),
      )
    }

    const renderKb = (snap, workspaces) => {
      const sel = snap.selected
      // A paused job still occupies the workspace (resume continues it), so it
      // blocks starting a new run and shows the 暂停/继续 progress card.
      const job = snap.jobs.find((j) => j.workspaceId === sel && (j.status === 'running' || j.status === 'paused'))
      const overview = snap.overview
      const tree = snap.tree
      const claims = snap.claims
      const isRunning = job !== undefined
      const wikiReady = tree !== null && tree.ok && tree.pages.length > 0
      const filteredPages = tree && tree.ok ? filterPages(tree.pages, snap.search) : []

      // Drag the divider to resize the left column (clamped 220–520px).
      const onColResize = (ev) => {
        ev.preventDefault()
        const startX = ev.clientX
        const startW = kb.get().leftWidth
        const onMove = (moveEv) => {
          const next = Math.min(520, Math.max(220, startW + (moveEv.clientX - startX)))
          kb.set({ leftWidth: next })
        }
        const onUp = () => {
          document.removeEventListener('mousemove', onMove)
          document.removeEventListener('mouseup', onUp)
        }
        document.addEventListener('mousemove', onMove)
        document.addEventListener('mouseup', onUp)
      }

      // Selected workspace identity; generation status lives in the RIGHT panel.
      // Two persistent mode buttons (Open Wiki / 知识卡片) with selected state.
      const modeTabs = React.createElement('div', { className: 'owk-tabs', style: { marginBottom: 8 } },
        React.createElement('button', {
          type: 'button',
          className: `owk-tab${snap.tab === 'wiki' ? ' sel' : ''}`,
          onClick: () => kb.set({ tab: 'wiki', showIgnore: false }),
        }, 'Open Wiki'),
        React.createElement('button', {
          type: 'button',
          className: `owk-tab${snap.tab === 'cards' ? ' sel' : ''}`,
          onClick: () => kb.set({ tab: 'cards', showIgnore: false }),
        }, '知识卡片'),
      )

      const leftContent = snap.showIgnore
        ? React.createElement('div', null,
            React.createElement('div', { className: 'owk-muted', style: { marginBottom: 4 } }, '.openwikiignore（gitignore 语法）'),
            React.createElement('textarea', {
              className: 'owk-select',
              style: { width: '100%', height: 180, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'monospace' },
              value: snap.ignoreContent,
              onChange: (e) => kb.set({ ignoreContent: e.target.value }),
            }),
            React.createElement('div', { className: 'owk-row', style: { marginTop: 6 } },
              React.createElement('button', {
                type: 'button',
                className: 'owk-btn owk-btn-primary',
                onClick: saveIgnore,
              }, '保存'),
              React.createElement('button', {
                type: 'button',
                className: 'owk-btn',
                onClick: () => kb.set({ showIgnore: false }),
              }, '取消')))
        : (snap.tab === 'wiki'
            ? (tree === null
                ? React.createElement('div', { className: 'owk-muted' }, '加载中…')
                : tree.ok === false
                  ? React.createElement('div', { className: 'owk-muted' }, tree.error)
                  : React.createElement('div', null,
                      (tree.inProgress || []).map((p, i) =>
                        React.createElement('div', { key: `ip-${i}`, className: 'owk-tree-item' },
                          React.createElement('span', null, '◐'),
                          React.createElement('span', null, p.title),
                          React.createElement('span', { className: 'owk-muted' }, p.status))),
                      renderTree(buildTree(filteredPages), 0, openPage, snap.activeTab, snap.expandedDirs),
                      tree.pages.length === 0 && (tree.inProgress || []).length === 0
                        ? React.createElement('div', { className: 'owk-empty', style: { padding: '24px 0' } },
                            '尚未生成 Wiki，点击右上「生成」')
                        : null))
            : (claims === null
                ? React.createElement('div', { className: 'owk-muted' }, '加载中…')
                : React.createElement('div', null,
                    (claims.claims || []).map((c) =>
                      React.createElement('div', { key: c.id, className: 'owk-claim' },
                        React.createElement('div', null, c.statement),
                        React.createElement('div', { className: 'owk-muted' },
                          `${c.evidenceCount} 条证据${c.firstEvidence ? ` · ${c.firstEvidence}` : ''}`))))))

      return React.createElement('div', { className: 'owk-kb' },
        React.createElement('div', { className: 'owk-kb-left', style: { width: snap.leftWidth } },
          // Workspace list (replaces the select dropdown): click to select.
          React.createElement('div', { className: 'owk-wslist' },
            workspaces.map((w) =>
              React.createElement('button', {
                key: w.id,
                type: 'button',
                className: `owk-wsitem${sel === w.id ? ' sel' : ''}`,
                onClick: () => selectWorkspace(w.id),
              },
                React.createElement('span', { className: 'owk-wsicon' }, '▸'),
                React.createElement('span', { className: 'owk-wsname' }, w.title || w.path || w.id),
              ))),
          React.createElement('input', {
            type: 'text',
            className: 'owk-select',
            style: { width: '100%', marginBottom: 8, boxSizing: 'border-box' },
            placeholder: '🔍 搜索 Open Wiki',
            value: snap.search,
            onChange: (e) => kb.set({ search: e.target.value }),
          }),
          React.createElement('div', { className: 'owk-row', style: { marginBottom: 8 } },
            modeTabs,
          ),
          React.createElement('div', { className: 'owk-row', style: { marginBottom: 8 } },
            React.createElement('button', {
              type: 'button',
              className: 'owk-btn',
              onClick: () => {
                kb.set({ showIgnore: !snap.showIgnore, tab: 'wiki' })
                if (!snap.showIgnore) loadIgnore()
              },
            }, '忽略文件'),
            React.createElement('button', {
              type: 'button',
              className: 'owk-btn',
              onClick: () => {
                // Refresh reloads the workspace list too (workspaces may have
                // been added since the last open).
                fetchWorkspaces()
                if (sel) refreshWorkspace(sel)
              },
            }, '刷新'),
          ),
          React.createElement('div', { style: { marginTop: 8 } }, leftContent),
        ),
        React.createElement('div', {
          className: 'owk-kb-resizer',
          title: '拖动调整左栏宽度',
          onMouseDown: onColResize,
        }),
        React.createElement('div', { className: 'owk-kb-right' },
          overview && overview.ok && (overview.wikiExists || overview.runActive)
            ? React.createElement('div', { className: 'owk-card' },
                // Wiki generation status (counts / time / location / regen).
                React.createElement('div', { className: 'owk-row' },
                  React.createElement('span', { style: { fontWeight: 600 } }, 'Open Wiki 状态'),
                  React.createElement('span', { className: 'owk-overlay-spacer' }),
                  overview.runActive
                    ? React.createElement('span', { className: 'owk-tag owk-tag-run' }, '生成中')
                    : React.createElement('span', { className: 'owk-tag owk-tag-ok' }, '已生成')),
                React.createElement('div', { className: 'owk-row' },
                  React.createElement('span', { className: 'owk-muted' }, '文件数：'),
                  React.createElement('span', null, overview.pageCount ?? 0),
                  React.createElement('span', { className: 'owk-muted', style: { marginLeft: 12 } }, '成功：'),
                  React.createElement('span', null, overview.successCount ?? overview.pageCount ?? 0),
                  React.createElement('span', { className: 'owk-muted', style: { marginLeft: 12 } }, '失败：'),
                  React.createElement('span', null, overview.failedCount ?? 0),
                ),
                overview.lastUpdate
                  ? React.createElement('div', { className: 'owk-muted' },
                      `更新时间：${String(overview.lastUpdate.updatedAt || '').slice(0, 16).replace('T', ' ')} · ${overview.lastUpdate.language} · ${overview.lastUpdate.status} · 模型 ${overview.lastUpdate.model || '—'}`)
                  : null,
                overview.wikiDirRelative
                  ? React.createElement('div', { className: 'owk-muted' }, `文档位置：项目根目录/${overview.wikiDirRelative}`)
                  : null,
                React.createElement('div', { className: 'owk-row', style: { marginTop: 8 } },
                  React.createElement('button', {
                    type: 'button',
                    className: 'owk-btn owk-btn-primary',
                    disabled: isRunning,
                    title: '根据仓库新增/修改的原始并更新 wiki 文档',
                    onClick: () => startJob('update'),
                  }, '重新生成'),
                  isRunning
                    ? React.createElement('button', {
                        type: 'button',
                        className: 'owk-btn',
                        onClick: () => killJob(),
                      }, '取消')
                    : null,
                ),
              )
            : React.createElement('div', { className: 'owk-card' },
                React.createElement('div', { className: 'owk-row' },
                  React.createElement('span', null, '生成你的 Open Wiki'),
                  React.createElement('span', { className: 'owk-overlay-spacer' }),
                  React.createElement('button', {
                    type: 'button',
                    className: 'owk-btn owk-btn-primary',
                    disabled: isRunning,
                    onClick: () => startJob('init'),
                  }, '生成'),
                ),
                React.createElement('div', { className: 'owk-muted', style: { marginTop: 6 } },
                  'Open Wiki（为您准备）和知识卡片（为 Agent 准备）将基于您的代码库一起生成和更新。'),
              ),
          snap.error
            ? React.createElement('div', { className: 'owk-row', style: { color: '#e74c3c' } }, snap.error)
            : null,
          snap.notice
            ? React.createElement('div', { className: 'owk-row owk-muted', style: { color: '#27ae60' } }, snap.notice)
            : null,
          renderProgress(job),
          snap.tabs.length > 0
            ? React.createElement('div', { className: 'owk-row', style: { borderBottom: '1px solid var(--dsw-border, #333)', paddingBottom: 6 } },
                snap.tabs.map((t) =>
                  React.createElement('span', { key: t.path, style: { display: 'inline-flex', alignItems: 'center', gap: 4 } },
                    React.createElement('button', {
                      type: 'button',
                      className: `owk-btn${snap.activeTab === t.path ? ' owk-btn-primary' : ''}`,
                      onClick: () => openPage(t.path),
                    }, t.title),
                    React.createElement('button', {
                      type: 'button',
                      className: 'owk-btn',
                      style: { padding: '1px 6px' },
                      title: '关闭',
                      onClick: () => closeTab(t.path),
                    }, '✕'))))
            : null,
          renderDoc(snap),
        ),
      )
    }

    // ------------------------------------------------------------------
    // dsh-better-sidebar integration (M4): register an openwiki sidebar tab.
    // ------------------------------------------------------------------
    const toggleShowEntry = () => {
      const next = !kb.get().showEntry
      kb.set({ showEntry: next })
      try { window.localStorage.setItem('dsh-openwiki:showEntry', next ? '1' : '0') } catch { /* noop */ }
    }

    // A self-contained view reusing the shared kb store; used both as the
    // better-sidebar tab content and to keep the tree/page state consistent.
    const SidebarKbView = (props) => {
      const snap = useKb()
      React.useEffect(() => {
        fetchWorkspaces()
      }, [])
      return React.createElement('div', { style: { height: '100%', display: 'flex', flexDirection: 'column' } },
        React.createElement('div', { className: 'owk-row', style: { padding: '6px 10px', borderBottom: '1px solid var(--dsw-border, #333)' } },
          React.createElement('span', { className: 'owk-icon' }, '📚'),
          React.createElement('span', null, 'openwiki 知识库'),
          React.createElement('span', { className: 'owk-overlay-spacer' }),
          React.createElement('button', {
            type: 'button',
            className: 'owk-btn',
            onClick: () => kb.set({ open: true }),
          }, '弹窗'),
        ),
        React.createElement('div', { style: { flex: 1, overflow: 'hidden', display: 'flex' } },
          React.createElement('div', { className: 'owk-body', style: { flex: 1, display: 'flex', padding: 0 } },
            renderKb(snap, snap.workspaces),
          ),
        ),
      )
    }

    // registerSidebarTab: call ctx.get('betterSidebar').registerTab(...) once.
    // Returns { ok, error? }. Idempotent: re-registration is refused.
    const registerSidebarTab = () => {
      const d = detectSidebar()
      if (!d.connected) return { ok: false, error: '未检测到 dsh-better-sidebar 插件。请先安装并启用该插件，然后刷新页面。' }
      if (kb.get().sidebarRegistered) return { ok: true, error: null, already: true }
      try {
        const dispose = d.service.registerTab({
          id: 'openwiki',
          title: () => 'openwiki知识库',
          icon: (size) => React.createElement('span', { style: { fontSize: size || 15 } }, '📚'),
          order: 50,
          single: true,
          component: (props) => React.createElement(SidebarKbView, props),
        })
        kb.set({ sidebarRegistered: true })
        // Keep the disposer so we could unregister (not wired to a button yet).
        // eslint-disable-next-line no-unused-vars
        void dispose
        return { ok: true, error: null, already: false }
      } catch (err) {
        return { ok: false, error: `注册失败：${String(err && err.message ? err.message : err)}` }
      }
    }

    // Auto-register the openwiki sidebar page whenever dsh-better-sidebar is
    // present. Registration is per-page-load (the client service registry is
    // rebuilt on refresh), so we re-register on load: the tab then survives a
    // refresh, which is exactly the persistence the user asked for. We poll a
    // few times because betterSidebar may be provided after our apply runs.
    const autoRegisterSidebar = () => {
      if (kb.get().sidebarRegistered) return
      const res = registerSidebarTab()
      if (res.ok) {
        kb.set({ sidebarRegistered: true, sidebar: { connected: true }, error: null })
        return true
      }
      return false
    }

    styles.insert(`
      .owk-overlay { position: fixed; inset: 0; z-index: 99999; display: flex; flex-direction: column;
        background: var(--dsw-bg, #1e1e1e); color: var(--dsw-fg, #e8e8e8); }
      .owk-overlay-header { display: flex; align-items: center; gap: 8px; padding: 8px 14px;
        border-bottom: 1px solid var(--dsw-border, #333); flex: 0 0 auto; }
      .owk-overlay-title { font-weight: 600; font-size: 14px; }
      .owk-overlay-spacer { flex: 1; }
      .owk-btn { background: transparent; border: 1px solid var(--dsw-border, #444); color: inherit;
        border-radius: 6px; padding: 4px 12px; cursor: pointer; font-size: 13px; }
      .owk-btn:hover { border-color: var(--dsw-accent, #4a9eff); }
      .owk-btn:disabled { opacity: 0.45; cursor: default; }
      .owk-btn-primary { background: var(--dsw-accent, #4a9eff); border-color: var(--dsw-accent, #4a9eff); color: #fff; }
      .owk-entry { display: flex; align-items: center; gap: 8px; width: 100%; border: none;
        background: transparent; color: inherit; cursor: pointer; padding: 6px 10px; border-radius: 6px;
        font-size: 13px; }
      /* Sidebar footer conflict fix: the shell renders every sidebar.footer.action
         entry side-by-side in one non-wrapping flex row, so loading this plugin
         together with other footer plugins (e.g. dsh-cost-meter) squeezes the
         openwiki entry to the right of that row. The slot runner wraps each
         registered entry in a display:contents div (inline-styled by the shell);
         scope the override with :has() to the wrapper that directly holds OUR
         entry and stack it into a full-width column, so openwiki lands on its
         own line at the bottom-left (directly above 设置) while other plugins'
         entries keep their own layout. */
      div:has(> .owk-entry) { display: flex !important; flex-direction: column !important;
        width: 100% !important; min-width: 0; align-items: stretch; }
      .owk-entry:hover { background: var(--dsw-hover, rgba(255,255,255,0.08)); }
      .owk-icon { font-size: 15px; line-height: 1; }
      .owk-body { flex: 1; overflow: auto; padding: 16px 20px; }
      .owk-card { border: 1px solid var(--dsw-border, #333); border-radius: 10px; padding: 14px 16px; margin-bottom: 12px; }
      .owk-muted { opacity: 0.65; font-size: 12px; }
      .owk-row { display: flex; align-items: center; gap: 8px; margin: 4px 0; font-size: 13px; flex-wrap: wrap; }
      .owk-tag { background: var(--dsw-accent, #4a9eff); color: #fff; border-radius: 4px;
        padding: 1px 8px; font-size: 11px; }
      .owk-tag-ok { background: #27ae60; }
      .owk-tag-warn { background: #c0392b; }
      .owk-tag-run { background: #e67e22; }
      .owk-pre { background: rgba(0,0,0,0.35); border-radius: 6px; padding: 8px; font-size: 11px;
        white-space: pre-wrap; word-break: break-all; max-height: 200px; overflow: auto; }
      .owk-empty { color: var(--dsw-fg-muted, #999); text-align: center; padding: 48px 0; font-size: 14px; }
      .owk-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
      .owk-dot-ok { background: #27ae60; }
      .owk-dot-err { background: #c0392b; }
      .owk-kb { display: flex; flex: 1; overflow: hidden; }
      .owk-kb-left { flex: 0 0 auto; min-width: 220px; max-width: 520px;
        overflow: auto; padding: 10px; }
      /* Draggable divider between the left column and the content area. */
      .owk-kb-resizer { flex: 0 0 6px; width: 6px; cursor: col-resize;
        background: transparent; border-left: 1px solid var(--dsw-border, #333); }
      .owk-kb-resizer:hover, .owk-kb-resizer:active {
        background: var(--dsw-accent-soft, rgba(74,158,255,0.25)); }
      .owk-kb-right { flex: 1; overflow: auto; padding: 14px 18px; }
      .owk-tree-item { display: flex; align-items: center; gap: 6px; padding: 3px 6px; border-radius: 5px;
        cursor: pointer; font-size: 13px; color: inherit; background: none; border: none; width: 100%; text-align: left; }
      .owk-tree-item:hover { background: var(--dsw-hover, rgba(255,255,255,0.07)); }
      .owk-tree-item.sel { background: var(--dsw-accent-soft, rgba(74,158,255,0.18)); }
      .owk-tree-dir { font-weight: 600; opacity: 0.85; }
      .owk-progress { height: 8px; border-radius: 4px; background: rgba(0,0,0,0.35); overflow: hidden; }
      .owk-progress-fill { height: 100%; background: #27ae60; transition: width 0.4s ease; }
      .owk-doc { line-height: 1.65; font-size: 14px; }
      .owk-doc h1 { font-size: 20px; }
      .owk-doc h2 { font-size: 17px; margin-top: 18px; }
      .owk-doc h3 { font-size: 15px; margin-top: 14px; }
      .owk-doc pre { background: rgba(0,0,0,0.35); border-radius: 6px; padding: 10px; overflow: auto; font-size: 12px; }
      .owk-doc code { background: rgba(0,0,0,0.3); border-radius: 3px; padding: 1px 4px; font-size: 12px; }
      .owk-doc table { border-collapse: collapse; margin: 10px 0; }
      .owk-doc th, .owk-doc td { border: 1px solid var(--dsw-border, #444); padding: 4px 10px; font-size: 13px; }
      .owk-doc blockquote { border-left: 3px solid var(--dsw-border, #444); margin: 8px 0; padding-left: 12px; opacity: 0.85; }
      .owk-doc a { color: var(--dsw-accent, #4a9eff); }
      .owk-select { background: var(--dsw-bg, #1e1e1e); color: inherit; border: 1px solid var(--dsw-border, #444);
        border-radius: 6px; padding: 3px 8px; font-size: 13px; }
      .owk-claim { border: 1px solid var(--dsw-border, #333); border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; }
      /* Floating window (draggable + resizable) */
      .owk-win { position: fixed; z-index: 99999; display: flex; flex-direction: column;
        background: var(--dsw-bg, #1e1e1e); color: var(--dsw-fg, #e8e8e8);
        border: 1px solid var(--dsw-border, #333); border-radius: 10px;
        box-shadow: 0 12px 40px rgba(0,0,0,0.5); overflow: hidden; }
      .owk-win-header { display: flex; align-items: center; gap: 8px; padding: 8px 12px;
        border-bottom: 1px solid var(--dsw-border, #333); flex: 0 0 auto;
        background: var(--dsw-bg-soft, rgba(255,255,255,0.03)); cursor: move; user-select: none; }
      .owk-win-resize { position: absolute; right: 0; bottom: 0; width: 16px; height: 16px;
        cursor: nwse-resize; }
      .owk-win-resize::after { content: ''; position: absolute; right: 3px; bottom: 3px;
        width: 10px; height: 10px; border-right: 2px solid var(--dsw-border, #555);
        border-bottom: 2px solid var(--dsw-border, #555); border-radius: 2px; }
      /* Workspace list */
      .owk-wslist { display: flex; flex-direction: column; gap: 2px; margin-bottom: 8px; }
      .owk-wsitem { display: flex; align-items: center; gap: 6px; width: 100%; text-align: left;
        background: transparent; border: none; color: inherit; cursor: pointer; border-radius: 6px;
        padding: 5px 8px; font-size: 13px; }
      .owk-wsitem:hover { background: var(--dsw-hover, rgba(255,255,255,0.07)); }
      .owk-wsitem.sel { background: var(--dsw-accent-soft, rgba(74,158,255,0.18)); }
      .owk-wsicon { font-size: 11px; opacity: 0.7; }
      .owk-wsname { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .owk-wsinfo { margin-bottom: 8px; padding: 6px 8px; background: var(--dsw-bg-soft, rgba(255,255,255,0.03));
        border-radius: 6px; }
      /* Mode tabs (wiki / cards) */
      .owk-tabs { display: inline-flex; gap: 4px; }
      .owk-tab { display: inline-flex; align-items: center; gap: 5px; background: transparent;
        border: 1px solid var(--dsw-border, #444); color: inherit; border-radius: 6px;
        padding: 4px 10px; cursor: pointer; font-size: 13px; }
      .owk-tab:hover { border-color: var(--dsw-accent, #4a9eff); }
      .owk-tab.sel { background: var(--dsw-accent, #4a9eff); border-color: var(--dsw-accent, #4a9eff);
        color: #fff; }
      .owk-wiki-link { color: var(--dsw-accent, #4a9eff); cursor: pointer; }
      .owk-wiki-link:hover { text-decoration: underline; }
      /* TOC split pane: left column under the toolbar, own vertical scrollbar,
         sticky so it stays visible while the document scrolls independently. */
      .owk-doc-split { display: flex; align-items: flex-start; gap: 10px; }
      .owk-toc-pane { flex: 0 0 220px; width: 220px; max-width: 30%;
        position: sticky; top: 0; max-height: calc(100vh - 240px);
        overflow-y: auto; background: var(--dsw-bg, #1e1e1e);
        border: 1px solid var(--dsw-border, #444); border-radius: 8px; padding: 6px; }
      .owk-doc-main { flex: 1; min-width: 0; }
    `)

    // ------------------------------------------------------------------
    // 1) Sidebar footer entry
    // ------------------------------------------------------------------
    slots.inject('sidebar.footer.action', () => slots.register(
      { name: 'sidebar.footer.action', id: 'openwiki', order: 10, label: () => 'openwiki知识库' },
      (props) => {
        const snap = useKb()
        const r = snap.runtime
        // "是否展示 openwiki 知识库入口" switch: hide the footer entry entirely
        // when the user turns it off.
        if (!snap.showEntry) return null
        return React.createElement('button', {
          type: 'button',
          className: 'owk-entry',
          title: 'openwiki 知识库',
          onClick: () => {
            if (!snap.runtime) refreshRuntime()
            kb.set({ open: true })
          },
        },
          React.createElement('span', { className: 'owk-icon' }, '📚'),
          props.wide
            ? React.createElement('span', null,
                'openwiki知识库',
                React.createElement('span', { className: 'owk-muted', style: { marginLeft: 6 } },
                  r ? (r.installed ? `v${r.version ?? '?'}` : '未安装') : '')) : null,
          props.wide && r
            ? React.createElement('span', {
                className: `owk-dot ${r.installed ? 'owk-dot-ok' : 'owk-dot-err'}`,
                style: { marginLeft: 'auto' },
              })
            : null,
        )
      },
    ))

    // ------------------------------------------------------------------
    // 2) Full-screen knowledge-base layer
    // ------------------------------------------------------------------
    slots.inject('shell.overlay', () => slots.register(
      { name: 'shell.overlay', id: 'openwiki-kb', order: 10 },
      (props) => {
        const snap = useKb()
        // Always re-fetch the workspace list when the kb window opens, so a
        // workspace added since the last open shows up without a page reload.
        React.useEffect(() => {
          if (snap.open) fetchWorkspaces()
        }, [snap.open])
        if (!snap.open) return null
        const r = snap.runtime
        const wsList = snap.workspaces
        const win = snap.win

        // Clamp window geometry into the viewport: the window's top/left edge
        // never leaves the screen (x/y >= 0) and it shrinks to fit if larger
        // than the viewport. This prevents dragging the title bar out of the
        // browser (which would make the window un-grabbable/unrecoverable).
        const clampWin = (x, y, w, h) => {
          const vw = window.innerWidth
          const vh = window.innerHeight
          const width = Math.round(Math.min(Math.max(w, 360), Math.max(360, vw)))
          const height = Math.round(Math.min(Math.max(h, 240), Math.max(240, vh)))
          return {
            x: Math.round(Math.min(Math.max(x, 0), Math.max(0, vw - width))),
            y: Math.round(Math.min(Math.max(y, 0), Math.max(0, vh - height))),
            w: width,
            h: height,
          }
        }

        // Drag the window: mousedown on the header, follow pointer on the
        // document until mouseup. Position is clamped to the viewport so the
        // header can never be dragged off-screen (unreachable).
        const onDragStart = (ev) => {
          ev.preventDefault()
          const startX = ev.clientX
          const startY = ev.clientY
          const startWin = { ...kb.get().win }
          const onMove = (moveEv) => {
            const next = clampWin(
              startWin.x + (moveEv.clientX - startX),
              startWin.y + (moveEv.clientY - startY),
              startWin.w, startWin.h,
            )
            kb.set({ win: { ...kb.get().win, ...next } })
          }
          const onUp = () => {
            document.removeEventListener('mousemove', onMove)
            document.removeEventListener('mouseup', onUp)
          }
          document.addEventListener('mousemove', onMove)
          document.addEventListener('mouseup', onUp)
        }

        // Resize from the SE handle: anchor the top-left corner, clamp into viewport.
        const onResizeStart = (ev) => {
          ev.preventDefault()
          ev.stopPropagation()
          const startX = ev.clientX
          const startY = ev.clientY
          const startWin = { ...kb.get().win }
          const onMove = (moveEv) => {
            const next = clampWin(
              startWin.x,
              startWin.y,
              startWin.w + (moveEv.clientX - startX),
              startWin.h + (moveEv.clientY - startY),
            )
            kb.set({ win: { ...kb.get().win, ...next } })
          }
          const onUp = () => {
            document.removeEventListener('mousemove', onMove)
            document.removeEventListener('mouseup', onUp)
          }
          document.addEventListener('mousemove', onMove)
          document.addEventListener('mouseup', onUp)
        }

        const winStyle = win.max ? { left: 0, top: 0, width: '100%', height: '100%' } : {
          left: win.x, top: win.y, width: win.w, height: win.h,
        }

        return React.createElement('div', { className: 'owk-win', style: winStyle },
          React.createElement('div', { className: 'owk-win-header', onMouseDown: onDragStart },
            React.createElement('span', { className: 'owk-icon' }, '📚'),
            React.createElement('span', { className: 'owk-overlay-title' }, 'openwiki 知识库'),
            React.createElement('button', {
              type: 'button',
              className: 'owk-btn',
              style: { marginLeft: 8 },
              title: '最大化/还原',
              onClick: () => kb.set({ win: { ...kb.get().win, max: !win.max } }),
            }, win.max ? '▣' : '□'),
            React.createElement('span', { className: 'owk-overlay-spacer' }),
            React.createElement('span', { className: 'owk-muted' },
              r
                ? (r.installed
                    ? `运行时 v${r.version ?? '?'}${r.hasUpdate ? `（可升级到 v${r.latestVersion}）` : ''}`
                    : '运行时未安装')
                : '运行时状态未知'),
            React.createElement('button', {
              type: 'button',
              className: 'owk-btn',
              style: { marginLeft: 8 },
              onClick: () => kb.set({ open: false }),
            }, '关闭'),
          ),
          React.createElement('div', { className: 'owk-body', style: { display: 'flex', flexDirection: 'column', padding: 0 } },
            renderKb(snap, wsList),
          ),
          !win.max
            ? React.createElement('div', {
                className: 'owk-win-resize',
                onMouseDown: onResizeStart,
                title: '拖动缩放',
              })
            : null,
        )
      },
    ))

    // ------------------------------------------------------------------
    // 4) Settings section — runtime + model management
    // ------------------------------------------------------------------
    slots.inject('settings.section', () => slots.register(
      { name: 'settings.section', id: 'openwiki', order: 30, label: () => 'openwiki' },
      () => {
        const snap = useKb()
        // Always re-fetch runtime + model state when the settings section
        // opens: the page-load warm-up can race the app boot (an early RPC can
        // fail and leave the cards in their fallback state), so the first
        // explicit visit heals them without requiring a manual 「刷新」.
        React.useEffect(() => {
          refreshRuntime()
          refreshModel()
          refreshSidebar()
          fetchAutoUpdate()
        }, [])
        const r = snap.runtime
        const m = snap.model
        return React.createElement('div', { style: { padding: '4px 2px' } },
          React.createElement('div', { className: 'owk-card' },
            React.createElement('div', { className: 'owk-row' },
              React.createElement('span', { style: { fontWeight: 600 } }, '运行时'),
              React.createElement('span', { className: 'owk-overlay-spacer' }),
              React.createElement('button', {
                type: 'button',
                className: 'owk-btn',
                disabled: snap.busy,
                onClick: refreshRuntime,
              }, '刷新'),
            ),
            r === null
              ? React.createElement('div', { className: 'owk-muted' }, snap.busy ? '检测中…' : '未检测（点刷新）')
              : React.createElement('div', null,
                  React.createElement('div', { className: 'owk-row' },
                    React.createElement('span', { className: `owk-dot ${r.installed ? 'owk-dot-ok' : 'owk-dot-err'}` }),
                    React.createElement('span', null, r.installed ? '已安装' : '未安装'),
                    r.error && !r.installed ? React.createElement('span', { className: 'owk-muted' }, `（${r.error}）`) : null,
                  ),
                  React.createElement('div', { className: 'owk-row' },
                    React.createElement('span', null, '版本：'),
                    React.createElement('span', null, r.version ?? '—'),
                    r.hasUpdate
                      ? React.createElement('span', { className: 'owk-tag owk-tag-warn' }, `有新版本 v${r.latestVersion}`)
                      : React.createElement('span', { className: 'owk-tag owk-tag-ok' }, '最新'),
                  ),
                  React.createElement('div', { className: 'owk-row' },
                    React.createElement('span', null, '可执行：'),
                    React.createElement('span', { className: 'owk-muted' }, r.exePath ?? '—'),
                  ),
                  React.createElement('div', { className: 'owk-row' },
                    React.createElement('span', null, '脚本：'),
                    React.createElement('span', { className: 'owk-muted' }, r.scriptPath ?? '—'),
                  ),
                ),
            React.createElement('div', { className: 'owk-row', style: { marginTop: 8 } },
              !r || !r.installed
                ? React.createElement('button', {
                    type: 'button',
                    className: 'owk-btn owk-btn-primary',
                    disabled: snap.busy,
                    onClick: () => runAction('openwiki/runtime/install', 'installing', {}),
                  }, '安装 openwiki 运行时')
                : React.createElement('button', {
                    type: 'button',
                    className: 'owk-btn',
                    disabled: snap.busy || !r.hasUpdate,
                    onClick: () => runAction('openwiki/runtime/update', 'updating', {}),
                  }, r.hasUpdate ? `升级到 v${r.latestVersion}` : '已是最新版本'),
              React.createElement('button', {
                type: 'button',
                className: 'owk-btn',
                disabled: snap.busy || !r || !r.installed,
                onClick: () => runAction('openwiki/runtime/probe', 'probing', {}),
              }, '自检（openwiki --help）'),
            ),
            snap.action
              ? React.createElement('div', { className: 'owk-row owk-muted' },
                  snap.action === 'installing' ? '正在安装（npm install -g openwiki）…' : snap.action === 'updating' ? '正在升级…' : '正在自检…')
              : null,
            snap.lastOutput
              ? React.createElement('div', { className: 'owk-pre' }, snap.lastOutput)
              : null,
          ),
          React.createElement('div', { className: 'owk-card' },
            React.createElement('div', { className: 'owk-row' },
              React.createElement('span', { style: { fontWeight: 600 } }, '模型（DSH 复用 → openwiki）'),
              React.createElement('span', { className: 'owk-overlay-spacer' }),
              React.createElement('button', {
                type: 'button',
                className: 'owk-btn',
                disabled: snap.busy,
                onClick: refreshModel,
              }, '刷新'),
            ),
            m === null
              ? React.createElement('div', { className: 'owk-muted' }, snap.busy ? '读取中…' : '未读取（点刷新）')
              : React.createElement('div', null,
                  React.createElement('div', { className: 'owk-row' },
                    React.createElement('span', null, 'DSH 默认模型：'),
                    React.createElement('span', null,
                      m.selection ? `${m.selection.provider} / ${m.selection.model}` : '—'),
                  ),
                  React.createElement('div', { className: 'owk-row' },
                    React.createElement('span', null, '映射到 openwiki：'),
                    m.owProvider
                      ? React.createElement('span', { className: 'owk-tag owk-tag-ok' }, m.owProvider)
                      : React.createElement('span', { className: 'owk-tag owk-tag-warn' }, '无法自动映射'),
                    m.keyConfigured
                      ? React.createElement('span', { className: 'owk-tag owk-tag-ok' }, 'Key 已解析')
                      : React.createElement('span', { className: 'owk-tag owk-tag-warn' }, 'Key 未解析'),
                  ),
                  m.warnings && m.warnings.length > 0
                    ? React.createElement('div', { className: 'owk-row owk-muted' }, m.warnings[0])
                    : null,
                  React.createElement('div', { className: 'owk-row' },
                    React.createElement('span', null, '凭证引用：'),
                    React.createElement('span', { className: 'owk-muted' }, m.apiKeyEnv ?? '—'),
                    m.keySource ? React.createElement('span', { className: 'owk-muted' }, `来源：${m.keySource}`) : null,
                  ),
                  React.createElement('div', { className: 'owk-row' },
                    React.createElement('span', null, '~/.openwiki/.env：'),
                    m.envExists
                      ? React.createElement('span', { className: 'owk-tag owk-tag-ok' }, `已存在（provider=${m.envProvider ?? '?'}，model=${m.envModel ?? '?'}）`)
                      : React.createElement('span', { className: 'owk-tag owk-tag-warn' }, '不存在'),
                  ),
                  // 同步 + 可选生成模型（--modelId，留空跟随 DSH 模型）。
                  React.createElement('div', { className: 'owk-row', style: { marginTop: 8 } },
                    React.createElement('button', {
                      type: 'button',
                      className: 'owk-btn owk-btn-primary',
                      disabled: snap.busy || !m.keyConfigured,
                      onClick: syncModel,
                    }, '同步到 openwiki (.env)'),
                    React.createElement('button', {
                      type: 'button',
                      className: 'owk-btn',
                      onClick: () => {
                        const v = String(kb.get().genModel || '').trim()
                        if (v && !/^[A-Za-z0-9][A-Za-z0-9._:/@+,-]*$/u.test(v)) {
                          kb.set({ error: `模型 ID 无效：${v}` })
                          return
                        }
                        kb.set({ genModel: v, error: null })
                        try { window.localStorage.setItem('dsh-openwiki:model', v) } catch { /* noop */ }
                      },
                    }, '保存生成模型'),
                    React.createElement('input', {
                      type: 'text',
                      className: 'owk-select',
                      style: { flex: 1, minWidth: 0, boxSizing: 'border-box' },
                      placeholder: '生成模型（可选）：留空跟随 DSH 模型，如 deepseek-chat',
                      value: snap.genModel,
                      onChange: (e) => kb.set({ genModel: e.target.value }),
                    }),
                  ),
                  React.createElement('div', { className: 'owk-muted', style: { marginTop: 4 } },
                    'openwiki 支持 --modelId 覆盖生成模型：填一个更快的模型（如 deepseek-chat）可显著提升生成速度；留空则跟随 DSH 模型。'),
                  // Model-bridge feedback lives in THIS card (the runtime card
                  // owns lastOutput for install/update/probe only).
                  snap.modelOutput
                    ? React.createElement('div', { className: 'owk-pre', style: { marginTop: 6 } }, snap.modelOutput)
                    : null,
                  snap.modelCommand
                    ? React.createElement('div', { className: 'owk-row', style: { marginTop: 6 } },
                        React.createElement('button', {
                          type: 'button',
                          className: 'owk-btn',
                          onClick: () => {
                            try { navigator.clipboard.writeText(snap.modelCommand) } catch { /* clipboard unavailable */ }
                          },
                        }, '复制命令'),
                        React.createElement('span', { className: 'owk-muted' },
                          '在终端执行后重新点击同步（命令包含 API Key，请勿泄露）'),
                      )
                    : null,
                  snap.modelCommand
                    ? React.createElement('pre', { className: 'owk-pre', style: { marginTop: 4 } }, snap.modelCommand)
                    : null,
                ),
          ),
          React.createElement('div', { className: 'owk-card' },
            React.createElement('div', { className: 'owk-row' },
              React.createElement('span', { style: { fontWeight: 600 } }, '文档内容语言'),
              React.createElement('span', { className: 'owk-overlay-spacer' }),
              React.createElement('span', { className: 'owk-muted' }, '设置页'),
            ),
            React.createElement('div', { className: 'owk-row', style: { marginTop: 6 } },
              React.createElement('input', {
                type: 'text',
                className: 'owk-select',
                style: { flex: 1, minWidth: 0, boxSizing: 'border-box' },
                placeholder: '例如 zh / en / zh-CN / English / 中文',
                value: snap.language,
                onChange: (e) => kb.set({ language: e.target.value }),
              }),
              React.createElement('button', {
                type: 'button',
                className: 'owk-btn owk-btn-primary',
                onClick: () => {
                  const normalized = normalizeLanguage(kb.get().language)
                  if (normalized.error) {
                    kb.set({ error: `文档语言设置无效：${normalized.error}` })
                    return
                  }
                  kb.set({ language: normalized.code || 'zh', error: null })
                  try { window.localStorage.setItem('dsh-openwiki:language', normalized.code || 'zh') } catch { /* noop */ }
                },
              }, '保存'),
            ),
            React.createElement('div', { className: 'owk-muted', style: { marginTop: 6 } },
              '生成 / 重新生成 / 更新文档时传给 openwiki 的 -l/--language（BCP-47）。默认中文（zh）；输入 English、chinese 等常见语言名也会自动换算成对应代码。'),
            React.createElement('div', { className: 'owk-muted', style: { marginTop: 4 } },
              '注意：切换语言后「重新生成」会按 openwiki 的语言变更逻辑重写全部文档；下一次运行以设置的文档内容语言为准。'),
          ),
          React.createElement('div', { className: 'owk-card' },
            React.createElement('div', { className: 'owk-row' },
              React.createElement('span', { style: { fontWeight: 600 } }, '自动更新'),
              React.createElement('span', { className: 'owk-overlay-spacer' }),
              React.createElement('button', {
                type: 'button',
                className: `owk-btn${snap.autoUpdate.enabled ? ' owk-btn-primary' : ''}`,
                onClick: toggleAutoUpdate,
              }, snap.autoUpdate.enabled ? '已开启自动更新 ✔' : '开启自动更新'),
            ),
            React.createElement('div', { className: 'owk-muted', style: { marginTop: 6 } },
              '监听所选工作区的 git 提交（轮询 HEAD），代码提交后自动运行 openwiki 增量更新（仅重新生成变更页面）。'),
            React.createElement('div', { className: 'owk-muted', style: { marginTop: 4 } },
              '说明：openwiki 无法原生感知 git 提交（仅自带每日 CI 定时），本插件通过轮询 git HEAD 实现提交后更新。'),
          ),
          React.createElement('div', { className: 'owk-card' },
            React.createElement('div', { className: 'owk-row' },
              React.createElement('span', { style: { fontWeight: 600 } }, '侧边栏页面插件（dsh-better-sidebar）'),
              React.createElement('span', { className: 'owk-overlay-spacer' }),
              React.createElement('button', {
                type: 'button',
                className: 'owk-btn',
                onClick: refreshSidebar,
              }, '检测'),
            ),
            React.createElement('div', { className: 'owk-row', style: { marginTop: 6 } },
              snap.sidebar === null
                ? React.createElement('span', { className: 'owk-muted' }, '检测中…')
                : snap.sidebar.connected
                  ? React.createElement('span', { className: 'owk-tag owk-tag-ok' }, '已连接 dsh-better-sidebar')
                  : React.createElement('span', { className: 'owk-tag owk-tag-warn' }, '未检测到 dsh-better-sidebar'),
              snap.sidebar && snap.sidebar.connected
                ? React.createElement('span', { className: 'owk-muted' },
                    snap.sidebarRegistered ? '（openwiki 页面已注册）' : '（尚未注册）')
                : null,
            ),
            React.createElement('div', { className: 'owk-row', style: { marginTop: 8 } },
              React.createElement('button', {
                type: 'button',
                className: 'owk-btn owk-btn-primary',
                disabled: !(snap.sidebar && snap.sidebar.connected) || snap.sidebarRegistered,
                onClick: () => {
                  const res = registerSidebarTab()
                  if (!res.ok) kb.set({ error: res.error })
                },
              }, snap.sidebarRegistered ? '已注册侧边页' : '注册侧边页面到 dsh-better-sidebar'),
            ),
            React.createElement('div', { className: 'owk-muted', style: { marginTop: 6 } },
              '把 openwiki 知识库注册为 dsh-better-sidebar 的一个侧边栏 Tab（新侧边页面），可直接在侧边栏查看。需要先安装并启用 dsh-better-sidebar 插件。'),
            React.createElement('div', { className: 'owk-muted', style: { marginTop: 4 } },
              'dsh-better-sidebar 地址：https://github.com/omdsh-dev/DSH-better-sidebar（已安装时可从侧边栏文件预览访问）。' ),
            !(snap.sidebar && snap.sidebar.connected)
              ? React.createElement('div', { className: 'owk-row', style: { marginTop: 6, color: '#e67e22' } },
                  '未检测到 dsh-better-sidebar：请先在 DSH 设置/插件中安装并启用该插件，然后刷新页面，再点击「注册侧边页面到 dsh-better-sidebar」。')
              : null,
          ),
          React.createElement('div', { className: 'owk-card' },
            React.createElement('div', { className: 'owk-row' },
              React.createElement('span', { style: { fontWeight: 600 } }, '入口显示'),
              React.createElement('span', { className: 'owk-overlay-spacer' }),
              React.createElement('button', {
                type: 'button',
                className: `owk-btn${snap.showEntry ? ' owk-btn-primary' : ''}`,
                onClick: toggleShowEntry,
              }, snap.showEntry ? '展示知识库入口 ✔' : '隐藏知识库入口'),
            ),
            React.createElement('div', { className: 'owk-muted', style: { marginTop: 6 } },
              '控制是否在 DSH 主界面左下角「设置」按钮上方显示「openwiki知识库」入口。默认展示，可关闭。'),
          ),
        )
      },
    ))

    // Auto-register openwiki into dsh-better-sidebar when present. The client
    // service registry is rebuilt on every page load, so we re-register here so
    // the tab survives a refresh (persistence). betterSidebar may attach after
    // this plugin's apply, so poll a bounded number of times.
    if (timer !== undefined) {
      let regTries = 0
      const regStop = timer.interval(() => {
        regTries += 1
        const done = autoRegisterSidebar()
        if (done || regTries >= 12) {
          regStop()
          if (autoRegisterSidebar()) kb.set({ sidebar: { connected: true } })
          else kb.set({ sidebar: { connected: detectSidebar().connected } })
        }
      }, 400)
    } else {
      // No timer service: best-effort single immediate attempt.
      autoRegisterSidebar()
    }

    // Warm the runtime + model state on load so the sidebar footer entry and
    // the settings page show live data (installed state, version) right away
    // instead of only after the first click / settings open.
    if (kb.get().runtime === null) refreshRuntime()
    if (kb.get().model === null) refreshModel()

    console.log('dsh-openwiki client: M4 redesign loaded')
  },
}
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
  exports.inject = [];
  exports.apply = apply;
  return module.exports;
}});
