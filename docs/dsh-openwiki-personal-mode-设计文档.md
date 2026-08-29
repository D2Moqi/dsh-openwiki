# dsh-openwiki 适配 openwiki personal 模式设计文档（「知识库」Tab）

> 状态：设计定稿（未实现；默认路线 A：`OPENWIKI_CONFIG_DIR=<项目>/openwiki-kb`）
> 目标 openwiki：≥ 0.3（本机 0.4.3）
> 关联源码：`src/host/index.js`、`src/client/index.js`、`scripts/build-host.mjs`、`scripts/build-client.mjs`

## 1. 背景与目标

当前 dsh-openwiki 插件只支持 openwiki 的 **code（仓库）模式**：选择一个 git 工作区，生成 `<项目>/openwiki/` 下的仓库 Wiki 与 Grounded Claims（知识卡片）；非 git 目录直接报错（`src/host/index.js:798`）。

目标：在知识库浮动窗口的 Tab 栏（现有 `Open Wiki` / `知识卡片`）之后新增第三个 **「知识库」** Tab，实现：

1. 上传本地文件到执行路径（默认 `<项目>/openwiki/doc/`）；
2. 调用 openwiki **personal 模式**分析上传文件，生成个人知识库文档；
3. 在 Tab 内列出生成的文件（类 wiki tree）并支持阅读；
4. 明确 personal 模式生成路径的可控性，并给出可落地的路径配置。

## 2. 上游 personal 模式机制事实（已逐条核实，含源码证据）

| # | 事实 | 证据 |
|---|------|------|
| 1 | 模式映射：`personal → outputMode: "local-wiki"`，wiki 目录固定为 `<home>/wiki` | `src/cli/run-mode.ts:40-45` `getRunModeCwd` 返回 `openWikiLocalWikiDir` |
| 2 | home 默认 `~/.openwiki`；`OPENWIKI_CONFIG_DIR` 环境变量整体搬移 home（含 wiki/connectors/.env/conversation_history/skills），支持 `~` 展开与相对路径 resolve | `src/config/openwiki-home.ts:8-29` |
| 3 | **`<home>/wiki` 的 `wiki` 段为硬编码**（`path.join(openWikiHomeDir, "wiki")`），无环境变量/CLI 参数可覆盖 | `src/config/openwiki-home.ts:46` |
| 4 | run 命令参数全集：`--init/--update`、`-p/--print`、`-l/--language`、`--mode personal\|code`、`--modelId`、`--telemetry-file`，位置参数 = 自由文本消息。**无任何输出路径/cwd 参数** | `src/cli/commands.ts` `parseRunCommand`（`--output`/`--cwd`/`--wiki-dir` 均不存在） |
| 5 | personal 模式**不要求配置 connector**：只有 code 模式走 `ensureCodeModeRepoSetup` + `runCodeModeConnectors`；personal 直接把 userMessage 交给 `runOpenWikiAgent` | `src/cli/runners.ts` `runPrintCommand` |
| 6 | agent 基于 deepagents `LocalShellBackend`（本地 shell 工具：read/execute/ls/grep）；`read` 只受 `.openwikiignore` 与 claims 所有权限制，**不受 docs-only 写边界限制** → 可读取任意 host 路径（含 `<项目>/openwiki/doc/`） | `src/agent/docs-only-backend.ts`（`OpenWikiLocalShellBackend`） |
| 7 | personal 模式**不生成 Grounded Claims（知识卡）**：connector 数据视为不可信证据，用置信标签（confirmed/source-backed/contested/watchlist/saved-context）合成 | `openwiki/workflows/personal-ingestion.md:41-46` |
| 8 | connectors 共 9 个（custom-mcp/git-repo/notion/x/google/web-search/hackernews/langsmith/slack），**无纯本地文件上传 connector**；`git-repo` 为 agentic discovery | `src/connectors/registry.ts` |

**推论（对本方案的决定性影响）**：

- 上传文件无需任何 connector：`openwiki personal <init|update> -p -l zh "<消息>"` 即可让 agent 用 shell 工具读取 `<项目>/openwiki/doc/` 并写知识库；
- 生成路径**只能**通过 `OPENWIKI_CONFIG_DIR` 控制，且输出恒为 `<configDir>/wiki`。

## 3. 生成路径设计（核心决策）

### 3.1 路径推导表

设项目根为 `<P>`，`OPENWIKI_CONFIG_DIR` 取不同值时真实输出：

| config dir | 真实 wiki 输出 | 字面 `openwiki/knowledgebase`？ |
|---|---|---|
| **`<P>/openwiki-kb`（本方案默认）** | **`<P>/openwiki-kb/wiki`** | ❌ |
| `<P>/openwiki/knowledgebase`（备选 A'） | `<P>/openwiki/knowledgebase/wiki` | ❌（多一层 `wiki`） |
| `<P>/openwiki` | `<P>/openwiki/wiki` | ❌，且与 code 输出目录混杂，禁用 |

> **结论：任何 config dir 都会多出一层硬编码的 `wiki` 子目录**（上游 `openwiki-home.ts:46`）。字面 `<P>/openwiki/knowledgebase` 在不开源改动下不可达；可选变通见 3.3。

### 3.2 为什么默认选 `<P>/openwiki-kb`（用户决策）

用户已确认默认路线 A：**spawn 时注入 `OPENWIKI_CONFIG_DIR=<P>/openwiki-kb`，输出 `<P>/openwiki-kb/wiki`**。理由：

1. **与 code 输出目录完全隔离**：home 附属物（`.env` 含 API Key、`connectors/`、`conversation_history/`、`skills/`）全部收在独立目录，不进入 `openwiki/`，避免密钥误提交与语义混杂；
2. **不触发 code 模式 disk-scan fallback 混入**：`openwiki-kb/` 不在 `openwiki/` 扫描范围内，`readWikiTree`/`readWikiOverview`/`readWikiClaims` 的递归扫描（`src/host/index.js:1014/1187/1254`）天然不会扫到 personal 产物；
3. `.gitignore` 一行 `openwiki-kb/` 排除全部 personal 产物。

**备选 A'（`<P>/openwiki/knowledgebase`）保留**：若后续希望 personal 产物收在 `openwiki/` 下，仅需改配置值并接受两项配套改动——`.gitignore` 排除 `openwiki/knowledgebase/`，以及 code 扫描跳过 `doc`/`knowledgebase` 目录名（与现有跳过 `.claims`/`.git` 同模式）。

### 3.3 字面路径方案对比（修订版）

| 路线 | 实现 | 字面 `openwiki/knowledgebase` | 风险/代价 |
|---|---|---|---|
| **A（默认，用户确认）** | spawn 注入 `OPENWIKI_CONFIG_DIR=<P>/openwiki-kb` → 输出 `<P>/openwiki-kb/wiki`；UI 显示真实路径 | ❌ | 最低；隔离最干净 |
| A' | `OPENWIKI_CONFIG_DIR=<P>/openwiki/knowledgebase` → 输出 `<P>/openwiki/knowledgebase/wiki` | ❌（多 `wiki` 层） | 低；需 §3.2 的两条配套改动 |
| B | A/A' 基础上建链接：`openwiki/knowledgebase` → `<configDir>/wiki`（Windows `mklink /J`，POSIX `ln -s`） | ✅ | 中：跨平台实现与清理复杂；git 按链接提交；openwiki shell 工具跟随 symlink 写入行为需实测；误删链接风险 |
| C | 生成后移动/复制到 `openwiki/knowledgebase` | ✅ | 高：`.run.json`/`.last-update.json`/`.page-manifest.json` 记录原路径，移动后增量更新与断点续跑断裂，**禁用** |
| D | 上游 PR：支持 `OPENWIKI_WIKI_DIR` 类配置 | ✅ | 远期；当前不可用 |

**决策**：首版采用 **A**（用户已确认）；若用户强诉求字面路径，再评估 B。

### 3.4 上传目录

- 默认 `<P>/openwiki/doc/`（用户指定），可配置；
- 校验：上传目录 ≠ 输出目录；上传文件名路径穿越防护（拒绝 `..`、绝对路径、控制字符、保留名）；
- 与 code 模式互不污染：`openwiki/` 是 code 输出目录概念，证据解析自排除 `openwiki/` 下内容；personal agent 用 shell 工具读 `doc/`（仅受 `.openwikiignore` 限制，见 §7 风险 4）；
- 上传目录 `openwiki/doc/` 与输出 `openwiki-kb/wiki` 父目录不同，物理分离，无冲突。

## 4. UI 设计（「知识库」Tab）

### 4.1 Tab 结构

- `src/client/index.js`：store 的 `tab` 由 `'wiki' | 'cards'` 扩展为 `'wiki' | 'cards' | 'kb'`；
- `renderKb` 的 `modeTabs`（现 ~967-978 行）增加第三个纯文本按钮 `知识库`，位于 `知识卡片` 之后；
- 说明文案沿用现有"Open Wiki（为您准备）和知识卡片（为 Agent 准备）"风格，补充一句模式说明。

### 4.2 面板布局

```
┌ 知识库（personal 模式）────────────────────────────────┐
│ 上传目录: openwiki/doc/   输出: openwiki-kb/wiki          │
│ [📁 上传文件] [🔄 生成知识库] [⏸/▶/继续] [⚙ 设置]        │
│ ── 输入文件（openwiki/doc/）──                          │
│  📄 课程大纲.md   12KB  2026-08-29  [删除]               │
│  📄 会议纪要.txt   4KB  2026-08-29  [删除]               │
│ ── 生成的知识库（openwiki-kb/wiki/）──                   │
│  📁 sources/                                            │
│  📄 themes.md          [阅读]                           │
│  📄 open-questions.md  [阅读]                           │
│ ── 任务状态卡 ──（复用现有 overview/job 卡）              │
└────────────────────────────────────────────────────────┘
```

- 上传：`<input type="file" multiple>` → `File.arrayBuffer()` → base64 → RPC；
- 生成：主按钮「生成知识库」→ 确认弹窗（复用「生成将消耗模型额度」）→ `openwiki/job/start { mode:'personal' }`；
- 树/阅读：复用现有 `buildTree`/展开/`tabs[]` 文档阅读机制，数据源换为知识库目录；
- 状态：复用 `job/status` 轮询与任务卡渲染。

## 5. Host 改动设计（`src/host/index.js`）

### 5.1 `startJob` personal 分支

- 入参扩展：`{ workspaceId, mode: 'init'|'update', kind: 'code'|'personal', language, model }`（`kind` 默认 `code`，兼容现有调用）；
- **git 校验仅 code 模式执行**（现 807-810 行）；personal 跳过；
- spawn 参数（复用 696 行拼装模式）：

  ```
  openwiki personal <--init|--update> -p -l <语言> "<消息>"
  ```

  消息模板（可配置）：`请阅读 <abs(上传目录)> 下的文件，整理成个人知识库文档。`
  **`OPENWIKI_CONFIG_DIR=<P>/openwiki-kb` 用绝对路径注入**（避免相对 cwd 解析歧义；spawn cwd 沿用 `ws.path` 即可，上游 `getRunModeCwd` 无视进程 cwd），openwiki 进程内解析输出为 `<P>/openwiki-kb/wiki`；
- **断点/轮询适配**：`readRunState`/`readLastUpdate`（629/663 行）现读 `<ws>/openwiki/.run.json`，personal 模式状态文件在 `<configDir>/wiki/` 下 → 按 `kind` 切换读取路径（**待实测**：personal 的 `.run.json`/`.last-update.json` 确切落点与字段）；
- jobs Map：key 改为 `workspaceId` + `kind` 复合（`"<id>@personal"`），避免 personal 与 code 任务互斥误伤；
- 首版生成命令倾向 `--update` 或带消息的 chat 形式（**待实测** `personal --init` 是否清空既有 wiki）。

### 5.2 ModelBridge env 写入适配

- 现 `openWikiEnvPath()`（336-341 行）硬编码 `~/.openwiki/.env`；
- personal 模式需写入 `<configDir>/.env`（openwiki 从 `<home>/.env` 读模型配置）→ `applyEnvUpdates`（477 行）支持按 configDir 写入（node 子进程 fallback 模式已有，直接复用）；
- 附带收益：多项目各自 `OPENWIKI_CONFIG_DIR`，conversation_history/connectors 天然隔离。

### 5.3 新增 RPC

| RPC | 功能 | 要点 |
|---|---|---|
| `openwiki/kb/config` | 读/写 personal 配置（上传目录、config dir、提示词模板、输出路径展示） | 内存态 + localStorage（沿用 settings 命名空间不可用的既定规避） |
| `openwiki/kb/upload` | 接收 `[{name, data(base64)}]` 写盘 | 路径穿越防护；`fs.writeText` 沙箱失败 → node 子进程写（复用 513 行 fallback）；返回已写/失败清单 |
| `openwiki/kb/files` | 列出上传目录（含大小/时间） | 复用 1014 行扫描模式 |
| `openwiki/kb/delete` | 删除上传文件 | 同写盘 fallback |
| `openwiki/kb/tree` / `kb/page` | 知识库输出目录树 + 阅读 | `wikiDir()`（951 行）按 kind 参数化：code → `<ws>/openwiki`，personal → `<configDir>/wiki` |

### 5.4 配套改动

- code 模式 tree/overview/claims 的 disk-scan fallback 跳过上传目录（默认 `doc`；与跳过 `.claims`/`.git` 同模式，1018/1191/1258 行三处；若选用 A' 配置，同法跳过 `knowledgebase`）；
- 上传目录 ≠ 输出目录校验（默认 `openwiki/doc` vs `openwiki-kb/wiki`，天然不同）；
- `.gitignore` 建议写入文档/设置页提示：排除 `openwiki-kb/`（含 `.env` 密钥；选用 A' 时排除 `openwiki/knowledgebase/`）。

## 6. Client 改动设计（`src/client/index.js`）

- store 新增：`kbFiles`、`kbTree`、`kbPage`、`kbConfig`、`uploading`、`uploadError`、`tab: 'kb'` 分支；
- `selectWorkspace`（248 行）与 `refreshWorkspace`（253 行）：`tab === 'kb'` 时并行拉 `kb/files` + `kb/tree` + `kb/config`；
- 上传实现：隐藏 input → 逐文件 base64 → `host.call('openwiki/kb/upload')`；单文件 ≤ 20MB、单次 ≤ 100MB（base64 膨胀 33%）；
- 生成按钮：确认弹窗 → `job/start { kind:'personal' }` → 复用任务卡轮询；
- 阅读：`kb/page` → 复用 `renderDoc` 与 `tabs[]`；
- 删除：`kb/delete` 后刷新 `kb/files`。

## 7. 限制与风险

1. **模型额度**：personal 生成消耗 DSH 模型，确认弹窗必须有；
2. **文件格式**：agent `read` 面向文本；PDF/DOCX 提示先转 markdown/txt（或依赖机器上的转换工具）；
3. **上传大小**：见 §6 限制；
4. **`.openwikiignore` 边界**：若项目根规则排除了 `openwiki/`，personal agent 读不到上传文件 → 面板给出检测提示；
5. **版本要求**：personal 模式需 openwiki ≥ 0.3（本机 0.4.3 ✅）；`ensure()` 安装逻辑不变；
6. **无知识卡**：personal 模式不产 Grounded Claims；「知识卡片」Tab 保持 code 专属。「知识库」Tab 只展示文档树；
7. **多项目隔离**：每项目独立 config dir（§5.2 附带收益）；
8. **待实测项**：personal `.run.json`/`.last-update.json` 落点与断点续跑；`--init` 清空语义；`subprocess.spawn` env 参数支持（不支持则包 node `-e` 或临时改环境再 spawn）；symlink（路线 B）跟随行为。

## 8. 与知识卡片（Grounded Claims）的关系

- 上游 personal 模式**刻意不生成 claims**（§2 事实 7），知识卡是 code 模式专属能力；
- 本方案：知识卡片 Tab 保持 code 专属；知识库 Tab 为 personal 专属，两者互不引用；
- 二期可选：自定义轻量溯源卡——上传时对文件计算 SHA-256 作为「证据版本」，agent 生成后把「文件→页面」引用写入 `<configDir>/wiki/.claims/` 边车（复用现有 `readWikiClaims` 读取契约），更新时重 hash 标注过期。偏离上游语义，需单独评估。

## 9. 实施里程碑与验证

| 里程碑 | 内容 | 验证 |
|---|---|---|
| M1 | host：`kb/config`/`kb/upload`/`kb/files`/`kb/delete`、`wikiDir` 参数化、扫描跳过 | 新增 `tests/verify-kb-host.mjs`（路径穿越、写盘 fallback、列表） |
| M2 | host：`startJob` personal 分支、env 注入（`OPENWIKI_CONFIG_DIR=<P>/openwiki-kb`）、状态读取适配 | 真实调用 `openwiki personal --update -p -l zh "整理 <P>/openwiki/doc"`（临时目录 + API key），核对输出 `<P>/openwiki-kb/wiki` 与状态文件 |
| M3 | client：「知识库」Tab + 上传 + 树/阅读 + 生成按钮 | 现有 Playwright 模式加 `kb tab present`/`upload button` 断言 |
| M4 | 路径配置（A 默认 + 可选 A'/B）与文档/README 更新 | 端到端截图 + `.gitignore` 建议 |

## 10. 参考

- 上游：`src/config/openwiki-home.ts`、`src/cli/commands.ts`（parseRunCommand）、`src/cli/run-mode.ts`、`src/cli/runners.ts`（runPrintCommand）、`src/agent/docs-only-backend.ts`、`openwiki/workflows/personal-ingestion.md`、[Personal mode 官方文档](https://docs.langchain.com/oss/openwiki/personal-mode)
- 插件：`src/host/index.js`（startJob / wikiDir / applyEnvUpdates / RPC 注册 / disk-scan fallback）、`src/client/index.js`（modeTabs / refreshWorkspace / renderKb / tabs[]）
