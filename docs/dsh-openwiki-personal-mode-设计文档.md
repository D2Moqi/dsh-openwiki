# dsh-openwiki 适配 openwiki personal 模式设计文档（「知识库」Tab + 导入来源）

> 状态：**已实现**（M1-M5 完成；构建产物 lib/index.js + client/client.js；验证：tests/verify-kb-host.mjs、tests/verify-host-entry.mjs 全部通过；UI 层 Playwright 断言待 GUI 环境补充）
> 变更记录：v0.1.8 起**移除「导入来源」**（connector/OAuth 来源管理，国内外服务水土不服），仅保留本地文件上传；「上传文件」增加文件类型提示（openwiki agent 读取为纯文本，无类型显示/转换机制）
> 默认路线 A：`OPENWIKI_CONFIG_DIR=<项目>/openwiki-kb`，输出 `<项目>/openwiki-kb/wiki`
> 目标 openwiki：≥ 0.3（本机 0.4.3）
> 关联源码：`src/host/index.js`、`src/client/index.js`、`scripts/build-host.mjs`、`scripts/build-client.mjs`

## 1. 背景与目标

当前 dsh-openwiki 插件只支持 openwiki 的 **code（仓库）模式**：选择一个 git 工作区，生成 `<项目>/openwiki/` 下的仓库 Wiki 与 Grounded Claims（知识卡片）；非 git 目录直接报错（`src/host/index.js:798`）。

目标：在知识库浮动窗口的 Tab 栏（现有 `Open Wiki` / `知识卡片`）之后新增第三个 **「知识库」** Tab，实现：

1. **导入来源**（替代最初的"上传文件"概念）：按 openwiki 支持的来源类型（本地文件/文件夹、本地 git 仓库、Gmail、Notion、X、Slack、网页搜索、Hacker News、Custom MCP、LangSmith）分别提供对应的配置交互；
2. 调用 openwiki **personal 模式**分析来源内容，生成个人知识库文档到 `<项目>/openwiki-kb/wiki`；
3. 在 Tab 内列出生成的文件（类 wiki tree）并支持阅读；
4. **凭据单点化**：模型配置继续用 `~/.openwiki/.env`，不在项目内重复配置，也不让 git 记录 `.env`。

## 2. 上游 personal 模式机制事实（已逐条核实，含源码证据）

| # | 事实 | 证据 |
|---|------|------|
| 1 | 模式映射：`personal → outputMode: "local-wiki"`，wiki 目录固定为 `<home>/wiki` | `src/cli/run-mode.ts:40-45` `getRunModeCwd` 返回 `openWikiLocalWikiDir` |
| 2 | home 默认 `~/.openwiki`；`OPENWIKI_CONFIG_DIR` 环境变量整体搬移 home（含 wiki/connectors/.env/conversation_history/skills），支持 `~` 展开与相对路径 resolve | `src/config/openwiki-home.ts:8-29` |
| 3 | **`<home>/wiki` 的 `wiki` 段为硬编码**（`path.join(openWikiHomeDir, "wiki")`），无环境变量/CLI 参数可覆盖 | `src/config/openwiki-home.ts:46` |
| 4 | run 命令参数全集：`--init/--update`、`-p/--print`、`-l/--language`、`--mode personal\|code`、`--modelId`、`--telemetry-file`，位置参数 = 自由文本消息。**无任何输出路径/cwd 参数** | `src/cli/commands.ts` `parseRunCommand` |
| 5 | personal 模式**不要求配置 connector**：只有 code 模式走 `ensureCodeModeRepoSetup` + `runCodeModeConnectors`；personal 直接把 userMessage 交给 `runOpenWikiAgent` | `src/cli/runners.ts` `runPrintCommand` |
| 6 | agent 基于 deepagents `LocalShellBackend`（本地 shell 工具：read/execute/ls/grep）；`read` 只受 `.openwikiignore` 与 claims 所有权限制，**不受 docs-only 写边界限制** → 可读取任意 host 路径 | `src/agent/docs-only-backend.ts`（`OpenWikiLocalShellBackend`） |
| 7 | personal 模式**不生成 Grounded Claims（知识卡）**：connector 数据视为不可信证据，用置信标签（confirmed/source-backed/contested/watchlist/saved-context）合成 | `openwiki/workflows/personal-ingestion.md:41-46` |
| 8 | connectors 共 9 个：`custom-mcp` / `git-repo` / `notion` / `x` / `google` / `web-search` / `hackernews` / `langsmith` / `slack`；`isConnectorId` 白名单校验 | `src/connectors/registry.ts` |
| 9 | **openwiki 加载 `.env` 时只填充 `process.env` 中未定义的键**（`if (process.env[key] === undefined)`）→ 进程/shell 环境优先于 `.env` 文件 | `src/config/env.ts` `loadOpenWikiEnv` |
| 10 | **`connectors/raw/` 只存确定性 connector 拉取的原始数据**（Gmail 邮件、X 推文等，`getConnectorRawDir = <home>/connectors/<id>/raw`），**不含用户手动上传的任意文件**；`git-repo` 为 agentic discovery（config：`{repos:[{id,path}]}` 存 `<home>/connectors/git-repo/config.json`，要求本地 git 仓库） | `src/config/openwiki-home.ts:65-67`、`src/connectors/sources/git-repo.ts`、`openwiki/workflows/personal-ingestion.md` |
| 11 | 来源实例注册在 `<home>/onboarding.json`：`sourceInstances: [{ id, connectorId, name?, connectedAt?, connectorConfig?, ingestionGoal? }]`；**connectorId 必须在上游白名单内**，`connectedAt` 决定 ingest 资格 | `src/setup/onboarding.ts` |
| 12 | DSH `subprocess.spawn` 支持显式 `env` 选项；显式 env 在**凭据 scrub**（`/KEY|PASSWORD|SECRET|TOKEN/i` + `DSH_` 前缀剔除）**之后**合并 → 可显式注入 API Key 类变量 | `@deepseek-ai/dsh-subprocess`（`scrubbedParentEnv`）、`dsh-subprocess-local`（`childEnv(spec.env)`，`spawn(spec)` 支持 `env` 字段） |

**推论（对本方案的决定性影响）**：

- 生成路径只能通过 `OPENWIKI_CONFIG_DIR` 控制，输出恒为 `<configDir>/wiki`（→ 路线 A 见 §3）；
- **模型凭据可以不落项目文件**：spawn 时从 `~/.openwiki/.env` 读取并显式注入 `env`（事实 9 + 12），openwiki 进程内 `process.env` 已有值 → `.env` 文件不参与（见 §6）；
- **上传文件需要插件自己的动作**：上游没有任何机制"接收用户上传的文件"（事实 10）→ 插件自定义「本地文件」来源，文件存 `<P>/openwiki-kb/source/files/`，靠 personal 消息驱动 agent 读取（事实 5、6）；
- 其余 9 个来源通过 onboarding.json + connector 配置接入，生成走 `openwiki ingest <connector>`（事实 8、11）。

## 3. 生成路径设计（路线 A）

### 3.1 路径推导

| config dir | 真实 wiki 输出 | 字面 `openwiki/knowledgebase`？ |
|---|---|---|
| **`<P>/openwiki-kb`（本方案默认）** | **`<P>/openwiki-kb/wiki`** | ❌ |
| `<P>/openwiki/knowledgebase`（备选 A'） | `<P>/openwiki/knowledgebase/wiki` | ❌（多一层 `wiki`） |
| `<P>/openwiki` | `<P>/openwiki/wiki` | ❌，且与 code 输出目录混杂，禁用 |

> **结论：任何 config dir 都会多出一层硬编码的 `wiki` 子目录**（事实 3）。字面 `<P>/openwiki/knowledgebase` 在不开源改动下不可达；可选变通见 3.3。

### 3.2 为什么默认选 `<P>/openwiki-kb`（用户决策）

用户已确认默认路线 A：**spawn 时注入 `OPENWIKI_CONFIG_DIR=<P>/openwiki-kb`，输出 `<P>/openwiki-kb/wiki`**。理由：

1. **与 code 输出目录完全隔离**：home 附属物（`.env`、`connectors/`、`conversation_history/`、`skills/`）全部收在独立目录，不进入 `openwiki/`，避免密钥误提交与语义混杂；
2. **不触发 code 模式 disk-scan fallback 混入**：`openwiki-kb/` 不在 `openwiki/` 扫描范围内（`src/host/index.js:1014/1187/1254` 的递归扫描天然不会扫到 personal 产物）；
3. `.gitignore` 一行 `openwiki-kb/` 排除全部 personal 产物（含 `.env`、connector 原始数据、会话历史）。

**备选 A'（`<P>/openwiki/knowledgebase`）保留**：若后续希望 personal 产物收在 `openwiki/` 下，仅需改配置值并接受两项配套改动——`.gitignore` 排除 `openwiki/knowledgebase/`，以及 code 扫描跳过 `doc`/`knowledgebase` 目录名。

### 3.3 字面路径方案对比

| 路线 | 实现 | 字面 `openwiki/knowledgebase` | 风险/代价 |
|---|---|---|---|
| **A（默认，用户确认）** | spawn 注入 `OPENWIKI_CONFIG_DIR=<P>/openwiki-kb` → 输出 `<P>/openwiki-kb/wiki`；UI 显示真实路径 | ❌ | 最低；隔离最干净 |
| A' | `OPENWIKI_CONFIG_DIR=<P>/openwiki/knowledgebase` → 输出 `<P>/openwiki/knowledgebase/wiki` | ❌（多 `wiki` 层） | 低；需 §3.2 的两条配套改动 |
| B | A/A' 基础上建链接：`openwiki/knowledgebase` → `<configDir>/wiki`（Windows `mklink /J`，POSIX `ln -s`） | ✅ | 中：跨平台实现与清理复杂；git 按链接提交；openwiki shell 工具跟随 symlink 写入行为需实测；误删链接风险 |
| C | 生成后移动/复制到 `openwiki/knowledgebase` | ✅ | 高：`.run.json`/`.last-update.json`/`.page-manifest.json` 记录原路径，移动后增量更新与断点续跑断裂，**禁用** |
| D | 上游 PR：支持 `OPENWIKI_WIKI_DIR` 类配置 | ✅ | 远期；当前不可用 |

**决策**：首版采用 **A**（用户已确认）；若用户强诉求字面路径，再评估 B。

## 4. 来源与文件存储（替代最初的"上传到执行路径"设计）

### 4.1 分析结论：是否需要"上传到指定目录"？

**需要**。事实 10 表明：上游 `connectors/<id>/raw/` 只存放**确定性 connector 拉取**的原始数据（由 `connector.ingest` 写入），**不会**接收或存储用户手动上传的任意文件；且 9 个 connector 中没有任何一个是"通用文件上传"。因此"导入本地文件"必须由插件实现上传动作。

**但位置不再需要独立的 `openwiki/doc/` 执行路径**——统一收敛到 `<P>/openwiki-kb/` 下（用户决策），全部 personal 产物（输入 + 配置 + 输出）一个根目录：

```
<P>/openwiki-kb/                      ← OPENWIKI_CONFIG_DIR（home）
├── wiki/                             ← personal 模式输出（知识库文档）
├── source/
│   └── files/                        ← 「本地文件」来源：插件上传的文件（含子目录）
├── connectors/
│   ├── git-repo/config.json          ← 来源配置：本地 git 仓库路径列表
│   ├── custom-mcp/config.json        ← 来源配置：MCP transport
│   └── <其他>/raw/…                  ← ingest 拉取的原始数据（上游自管）
├── onboarding.json                   ← 来源实例注册（插件写入，schema 见事实 11）
├── .env                              ← 仅 connector/OAuth 凭据（见 §6）
├── conversation_history/             ← agent 会话（上游自管）
└── skills/                           ← 上游自管
```

- **输入**（上传文件）：`<P>/openwiki-kb/source/files/`——插件通过 `kb/import` 写盘，路径穿越防护见 §7.2；
- **来源配置**：`connectors/<id>/config.json`（git-repo/custom-mcp）与 `onboarding.json`（全部来源实例）——即"根据配置的来源生成的配置文件"；
- **输出**：`<P>/openwiki-kb/wiki/`；
- 上传目录与输出目录父结构分离（`source/` vs `wiki/`），无冲突。

### 4.2 生成动作（按来源分流）

| 来源类别 | 生成命令 |
|---|---|
| 本地文件来源（插件自定义） | `openwiki personal --update -p -l <语言> "<消息：读取 <abs(source/files)> 下的文件，整理成个人知识库>"`（事实 5、6：agent 用 shell 工具读 host 路径） |
| 9 个上游 connector | `openwiki ingest <connectorId\|all> --print [-l <语言>] [--modelId <id>]`（ingest 内含确定性拉取 + agent 更新 wiki） |
| 组合场景 | 先 `ingest all`，再跑一次本地文件来源的 personal update（可选，避免消息相互覆盖） |

## 5. 导入来源设计（「上传按钮」升级为「导入来源」）

> **v0.1.8 已移除本节内容**：按用户决策删除来源管理（§5.1-5.3 的 connector/OAuth 交互与测试矩阵），仅保留本地文件上传；`kb/sources`、`kb/source/*`、`kb/env/set` RPC 与对应 UI 已删除。以下保留为历史记录。

### 5.1 来源类型 × 交互 × 存储 × 生成

| 来源 | 凭据 | 配置交互（UI） | 存储位置 | 生成 |
|---|---|---|---|---|
| **本地文件/文件夹**（插件自定义，非上游 connector） | 无 | 文件选择器（多选/拖拽）或本地文件夹路径输入 | `<P>/openwiki-kb/source/files/` | `personal --update` + 消息 |
| **git-repo**（本地 git 仓库） | 无 | 路径列表表单（可多个，校验为 git 仓库） | `connectors/git-repo/config.json`（`{repos:[{id,path}]}`）+ onboarding | `ingest git-repo`（agentic） |
| **web-search**（Tavily） | `TAVILY_API_KEY` | Key 表单（可存 DSH 凭据或项目 .env） | `.env` + onboarding | `ingest web-search`（确定性，24h 窗口） |
| **hackernews** | 无 | 一键添加 | onboarding | `ingest hackernews`（确定性） |
| **google/gmail** | OAuth | 「授权」→ spawn `openwiki auth gmail`（本地回调 127.0.0.1:53682），完成后检查 `.env` token 键 | `.env`（auth 写回）+ onboarding | `ingest google` |
| **x** | OAuth（PKCE） | 「授权」→ `openwiki auth x` | `.env` + onboarding | `ingest x` |
| **slack** | OAuth | 「授权」→ `openwiki auth slack`（**需 HTTPS 回调**，UI 提示 ngrok 及 `OPENWIKI_HTTPS_OAUTH_REDIRECT_URI`） | `.env` + onboarding | `ingest slack` |
| **notion** | OAuth（hosted MCP） | 「授权」→ `openwiki auth notion`；或手动填 `OPENWIKI_NOTION_MCP_ACCESS_TOKEN` | `.env` + onboarding | `ingest notion`（agentic，MCP 工具） |
| **custom-mcp** | 无（transport 内自含） | JSON 编辑/表单（HTTP/stdio transport + allowedTools） | `connectors/custom-mcp/config.json` + onboarding | `ingest custom-mcp`（agentic） |
| **langsmith** | `LANGSMITH_API_KEY` | Key 表单 | `.env` + onboarding | 主要为 code 模式证据增强；personal 场景可选 |

### 5.2 交互分级与 UI

- **无凭据来源**（本地文件、hackernews）：「添加」即完成；
- **单 Key 来源**（web-search、langsmith）：弹出 Key 输入表单（保存后掩码显示）；
- **OAuth 来源**（gmail/x/slack/notion）：「授权」按钮 → host spawn `openwiki auth <id>`（stdout 透出回调 URL），完成后轮询 `.env` 对应 token 键确认连接状态；未授权显示 ⚠ 徽标；
- **路径/JSON 来源**（git-repo、custom-mcp、本地文件夹）：表单或 JSON 编辑器（校验后写 config.json）。

面板布局：

```
┌ 知识库（personal 模式）────────────────────────────────┐
│ 输出: openwiki-kb/wiki   来源: openwiki-kb/source/       │
│ [➕ 导入来源] [🔄 生成知识库] [⏸/▶/继续] [⚙ 设置]        │
│ ── 来源列表 ──                                         │
│  📁 本地文件 ×3      [查看] [生成] [移除]                │
│  📄 web-search      ✓已连接 [刷新] [移除]                │
│  📄 Hacker News     ✓已连接 [刷新] [移除]                │
│  🔑 Gmail           ⚠未授权 [授权]                      │
│ ── 生成的知识库（openwiki-kb/wiki/）──                   │
│  📁 sources/  📄 themes.md  📄 open-questions.md  …     │
│ ── 任务状态卡 ──（复用现有 overview/job 卡）              │
└────────────────────────────────────────────────────────┘
```

### 5.3 测试矩阵（逐来源测试，用户要求）

新增 `tests/verify-kb-sources.mjs`（host RPC 级离线测试）+ 现有 Playwright 体系补 UI 断言；OAuth 流程用 mock 环境（不真跑授权）：

| 来源 | 配置交互测试 | 落盘测试 | 生成命令测试 |
|---|---|---|---|
| 本地文件 | 上传列表/大小限制/路径穿越防护/删除 | `source/files/` 落盘 + 子目录 | 消息模板含 `abs(source/files)` |
| git-repo | 路径表单校验（非 git 报错） | `connectors/git-repo/config.json` 结构 | `ingest git-repo` argv 断言 |
| web-search | Key 表单/掩码/空值 | `.env` 键写入 | `ingest web-search` argv 断言 |
| hackernews | 一键添加/重复添加去重 | onboarding 实例 | `ingest hackernews` argv 断言 |
| gmail/x/slack/notion | 授权按钮 → spawn `auth <id>` mock；token 键轮询 | `.env` token 键存在性 | `ingest <id>` argv 断言 |
| custom-mcp | JSON 校验（非法 transport 报错） | config.json 写入 | `ingest custom-mcp` argv 断言 |
| langsmith | Key 表单 | `.env` 键写入 | code 模式 connector 断言 |

## 6. 凭据单点化（`.env` 分析结论）

**问题**：`<P>/openwiki-kb/.env` 是否必要？能否用 `~/.openwiki/.env` 代替？不希望重复配置模型，也不希望 git 记录 `.env`。

### 6.1 模型凭据：不落项目文件，spawn 时注入（推荐）

可行性证据链（事实 9 + 12）：

1. openwiki `loadOpenWikiEnv` 只在 `process.env[key] === undefined` 时用 `.env` 文件填充 → **进程环境优先于 `.env` 文件**；
2. DSH `subprocess.spawn(spec)` 支持显式 `env`，且显式 env 在凭据 scrub **之后**合并 → API Key 类变量可显式传入子进程；
3. 因此：host 每次 spawn personal 任务前，从 **`~/.openwiki/.env`**（ModeBridge 现有单一维护点）读取 `MANAGED_ENV_KEYS`（`OPENWIKI_PROVIDER`/`OPENWIKI_MODEL_ID`/`OPENAI_COMPATIBLE_API_KEY`/`OPENAI_COMPATIBLE_BASE_URL`/`OPENWIKI_OPENAI_COMPATIBLE_STREAMING` 等，见 `src/host/index.js:344-358`），连同 `OPENWIKI_CONFIG_DIR` 一起显式注入：

```js
subprocess.spawn({
  argv: [cli.program, ...argv],
  cwd: ws.path,
  env: {
    OPENWIKI_CONFIG_DIR: '<P>/openwiki-kb',   // 绝对路径
    OPENWIKI_PROVIDER: 'openai-compatible',
    OPENWIKI_MODEL_ID: '<model>',
    OPENAI_COMPATIBLE_API_KEY: '<key>',
    // …其余模型键
  },
  stdio: { … }, graceMs: 10000,
})
```

→ `<P>/openwiki-kb/.env` **不需要存在**，模型配置保持 `~/.openwiki/.env` 单点，git 完全无感（`openwiki-kb/` 可整体 gitignore，但即使不 gitignore，项目内也没有模型凭据文件）。

**兜底**（若某环境 spawn env 注入失效）：生成前把 `~/.openwiki/.env` 的模型键同步复制进 `<P>/openwiki-kb/.env`（复用 `applyEnvUpdates` 的写盘 fallback，每次 spawn 前刷新，仍为单点语义）。

### 6.2 connector/OAuth 凭据：必然落 `<P>/openwiki-kb/.env`，gitignore 兜底

- `openwiki auth <id>` 与手动保存都会写 `<home>/.env`（事实 2 后 home = `<P>/openwiki-kb`；上游 `saveOpenWikiEnv` 行为，`src/config/env.ts`）——**无法重定向**，且 openwiki 的 ingest 子进程需要从该文件读取（`readOpenWikiEnv` 只读文件）；
- 结论：`<P>/openwiki-kb/.env` 会存在，但**只含 connector/OAuth 凭据**（TAVILY_API_KEY、OPENWIKI_GMAIL_*、OPENWIKI_X_*、OPENWIKI_SLACK_*、OPENWIKI_NOTION_*、LANGSMITH_API_KEY 等），不含模型配置；
- git 记录问题：`.gitignore` 建议 `openwiki-kb/`（含 `.env`、connectors 原始数据、会话历史）——一条规则全部排除；
- 可选优化：单 Key 类来源（web-search/langsmith）的 Key 也可存入 **DSH 凭据系统**并在 spawn 时注入（同 §6.1），从而项目 `.env` 只出现 OAuth token；OAuth 类因 `openwiki auth` 写回而不可避免。

### 6.3 结论表

| 凭据类别 | 落盘位置 | git 风险 | 方案 |
|---|---|---|---|
| 模型配置（provider/model/各家 Key） | **仅 `~/.openwiki/.env`** | 无（项目内无文件） | spawn 显式 env 注入 |
| 单 Key 来源（Tavily/LangSmith） | DSH 凭据（可选）或项目 `.env` | gitignore 兜底 | 优先注入，fallback 落盘 |
| OAuth 来源（gmail/x/slack/notion） | `<P>/openwiki-kb/.env`（上游写回） | gitignore 兜底 | 不可避免 |

## 7. Host 改动设计（`src/host/index.js`）

### 7.1 `startJob` personal 分支

- 入参扩展：`{ workspaceId, mode: 'init'|'update', kind: 'code'|'personal', language, model }`（`kind` 默认 `code`，兼容现有调用）；
- **git 校验仅 code 模式执行**（现 807-810 行）；personal 跳过；
- spawn 参数（复用 696 行拼装模式 + §6.1 env 注入）：

  ```
  openwiki personal <--init|--update> -p -l <语言> "<消息>"
  ```

  消息模板（可配置）：`请阅读 <abs(source/files)> 下的文件，整理成个人知识库文档。`（本地文件来源）；connector 来源走 §4.2 的 `ingest`；
- **断点/轮询适配**：`readRunState`/`readLastUpdate`（629/663 行）现读 `<ws>/openwiki/.run.json`，personal 状态文件在 `<configDir>/wiki/` 下 → 按 `kind` 切换读取路径（**待实测**：personal 的 `.run.json`/`.last-update.json` 确切落点与字段）；
- jobs Map：key 改为 `workspaceId` + `kind` 复合（`"<id>@personal"`），避免 personal 与 code 任务互斥误伤；
- 首版生成命令倾向 `--update`（**待实测** `personal --init` 是否清空既有 wiki）。

### 7.2 新增 RPC

| RPC | 功能 | 要点 |
|---|---|---|
| `openwiki/kb/config` | 读/写 personal 配置（config dir、消息模板、输出路径展示） | 内存态 + localStorage（沿用 settings 命名空间不可用的既定规避） |
| `openwiki/kb/import` | 导入本地文件 `[{name, data(base64)}]` → `<P>/openwiki-kb/source/files/` | **路径穿越防护**（拒绝 `..`、绝对路径、控制字符）；`fs.writeText` 沙箱失败 → node 子进程写（复用 513 行 fallback）；返回已写/失败清单 |
| `openwiki/kb/files` | 列出 `source/files/`（含大小/时间） | 复用 1014 行扫描模式 |
| `openwiki/kb/delete` | 删除上传文件 | 同写盘 fallback |
| `openwiki/kb/sources` | 来源实例列表（onboarding.json + config.json 合并，含连接状态） | 读 `<P>/openwiki-kb/onboarding.json`（缺失返回空列表） |
| `openwiki/kb/source/add` / `remove` | 添加/移除来源（写 onboarding.json + connector config.json） | connectorId 白名单校验（事实 8、11）；`connectedAt` 由插件生成 |
| `openwiki/kb/source/auth` | spawn `openwiki auth <id>`（OAuth 引导） | 完成后轮询 `.env` token 键返回连接状态 |
| `openwiki/kb/tree` / `kb/page` | 知识库输出目录树 + 阅读 | `wikiDir()`（951 行）按 kind 参数化：code → `<ws>/openwiki`，personal → `<configDir>/wiki` |

### 7.3 配套改动

- code 模式 tree/overview/claims 的 disk-scan fallback 跳过上传来源目录（默认 `source`；与跳过 `.claims`/`.git` 同模式，1018/1191/1258 行三处；若选用 A' 配置，同法跳过 `knowledgebase`）；
- 输入目录 ≠ 输出目录校验（默认 `source/files` vs `wiki`，天然不同）；
- `.gitignore` 建议写入设置页提示：排除 `openwiki-kb/`（含 `.env` 密钥、connector 原始数据、会话历史）。

## 8. Client 改动设计（`src/client/index.js`）

- store 新增：`kbFiles`、`kbTree`、`kbPage`、`kbSources`、`kbConfig`、`importing`、`authing`、`tab: 'kb'` 分支；
- `selectWorkspace`（248 行）与 `refreshWorkspace`（253 行）：`tab === 'kb'` 时并行拉 `kb/files` + `kb/tree` + `kb/sources` + `kb/config`；
- 导入实现：隐藏 input（多选/拖拽）→ 逐文件 base64 → `host.call('openwiki/kb/import')`；单文件 ≤ 20MB、单次 ≤ 100MB（base64 膨胀 33%）；
- 来源管理：「导入来源」弹层 = 来源类型选择（§5.1 交互分级）；OAuth 授权按钮 → `kb/source/auth` + 轮询状态；
- 生成按钮：确认弹窗（复用「生成将消耗模型额度」）→ `job/start { kind:'personal' }`（本地文件）或 `kb/source/refresh` → `ingest` 任务（复用任务卡轮询）；
- 阅读：`kb/page` → 复用 `renderDoc` 与 `tabs[]`。

## 9. 限制与风险

1. **模型额度**：personal 生成与 ingest 均消耗 DSH 模型，确认弹窗必须有；
2. **文件格式**：agent `read` 面向文本；PDF/DOCX 提示先转 markdown/txt（或依赖机器转换工具）；
3. **上传大小**：见 §8 限制；
4. **`.openwikiignore`**：~~若项目根规则排除了 `source/files` 路径，personal agent 读不到~~——**已实测修正**：personal（local-wiki）模式加载**空 ignore 规则**（`new OpenWikiIgnore([])`，`src/agent/index.js`），`source/files` 不会被 ignore 阻挡（仅受 shell 权限限制）；
5. **版本要求**：personal 模式需 openwiki ≥ 0.3（本机 0.4.3 ✅）；`ensure()` 安装逻辑不变；
6. **无知识卡**：personal 模式不产 Grounded Claims；「知识卡片」Tab 保持 code 专属（二期可做自定义溯源卡，见 §10）；
7. **多项目隔离**：每项目独立 config dir，conversation_history/connectors 不串扰；
8. **OAuth 交互**：slack 需 HTTPS 回调（UI 引导 ngrok）；auth 是交互式流程，spawn 时 stdout 需透出 URL（maxBytes 调大，host 90s 超时终止）；
9. **实测结论（openwiki 0.4.3，静态源码验证）**：
   - personal 模式**没有 `.run.json` 断点**（repository 专属 `repositoryRunStatePath`；local-wiki 的 init/update 用 `:memory:` checkpoint）→ 插件轮询无逐页进度，`readRunState(kind=personal)` 恒为 null；
   - `.last-update.json` 写在 **wiki 目录根**（`<configDir>/wiki/.last-update.json`，`agent/utils.js getMetadataFilePath` local-wiki 分支），成功写 `complete`、失败/中断写 `interrupted`；
   - **`personal --init` 不清空既有 wiki**（无清理代码，仅 init/update 的 system prompt 不同）→ 插件统一用 `--update` 安全；
   - ingest 为 **per-source 串行循环**（`runOpenWikiIngestion`），单个来源失败不中止其余；与本地文件消息（`personal --update`）是两条独立生成路径，插件侧先 ingest 后 personal update 编排；
   - **symlink 跟随**：openwiki 路径规范化是字符串级（`posix.normalize`），不解析 symlink；底层 fs 跟随 symlink → 路线 B 技术可行，维持 A 决策；
   - **env 注入生效**：`loadOpenWikiEnv` 只填充未定义键 + DSH spawn 显式 env 在 scrub 后合并（事实 9、12），已由 `tests/verify-kb-host.mjs` 断言（`env.OPENAI_COMPATIBLE_API_KEY` 注入成功）。

## 10. 与知识卡片（Grounded Claims）的关系

- 上游 personal 模式**刻意不生成 claims**（事实 7），知识卡是 code 模式专属能力；
- 本方案：知识卡片 Tab 保持 code 专属；知识库 Tab 为 personal 专属，两者互不引用；
- 二期可选：自定义轻量溯源卡——导入时对文件计算 SHA-256 作为「证据版本」，agent 生成后把「来源→页面」引用写入 `<configDir>/wiki/.claims/` 边车（复用现有 `readWikiClaims` 读取契约），更新时重 hash 标注过期。偏离上游语义，需单独评估。

## 11. 实施里程碑与验证

| 里程碑 | 内容 | 验证 |
|---|---|---|
| M1 | host：`kb/config`/`kb/import`/`kb/files`/`kb/delete`、`wikiDir` 参数化、扫描跳过 | 新增 `tests/verify-kb-host.mjs`（路径穿越、写盘 fallback、列表） |
| M2 | host：`startJob` personal 分支、env 注入（§6.1）、状态读取适配 | 真实调用 `openwiki personal --update -p -l zh "整理 <P>/openwiki-kb/source/files"`（临时目录 + API key），核对输出 `<P>/openwiki-kb/wiki` 与状态文件；验证**项目内无模型凭据文件** |
| M3 | host：`kb/sources` + `source/add/remove/auth`（onboarding.json + connector config 写入） | `tests/verify-kb-sources.mjs` 逐来源矩阵（§5.3） |
| M4 | client：「知识库」Tab + 导入来源弹层 + 树/阅读 + 生成按钮 | 现有 Playwright 模式加 `kb tab present`/`import source dialog`/`source rows` 断言 |
| M5 | 路径配置（A 默认 + 可选 A'/B）、`.gitignore` 建议、README 更新 | 端到端截图 + 文档 |

## 12. 参考

- 上游：`src/config/openwiki-home.ts`、`src/config/env.ts`（loadOpenWikiEnv/saveOpenWikiEnv）、`src/cli/commands.ts`（parseRunCommand）、`src/cli/run-mode.ts`、`src/cli/runners.ts`（runPrintCommand）、`src/agent/docs-only-backend.ts`、`src/connectors/registry.ts`、`src/connectors/sources/git-repo.ts`、`src/setup/onboarding.ts`、`openwiki/workflows/personal-ingestion.md`、[Personal mode 官方文档](https://docs.langchain.com/oss/openwiki/personal-mode)
- DSH：`@deepseek-ai/dsh-subprocess`（scrubbedParentEnv）、`dsh-subprocess-local`（childEnv/spawn）
- 插件：`src/host/index.js`（startJob / wikiDir / applyEnvUpdates / RPC 注册 / disk-scan fallback）、`src/client/index.js`（modeTabs / refreshWorkspace / renderKb / tabs[]）
