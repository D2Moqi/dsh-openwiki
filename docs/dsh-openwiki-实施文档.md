# dsh-openwiki 插件实施文档（开发计划 · 开发设计 · 开发规范）

| 文档信息 | 内容 |
| --- | --- |
| 插件名称 | dsh-openwiki（DSH 内嵌 openwiki 知识库） |
| 文档版本 | v1.0 |
| 编写日期 | 2026-09-XX |
| 上游参考 | PRD《知识中心（Repo Wiki）》v1.0（`PRD-知识中心-RepoWiki.md`） |
| 上游程序 | OpenWiki v0.4.3（`openwiki-main/`，langchain-ai/openwiki，MIT） |
| 运行平台 | DeepSeek Harness（DSH）Web profile（`http://127.0.0.1:3080`），Cordis 插件体系 |
| 交付物 | 本文档 + `code/` 目录下后续生成的插件代码 |

---

## 1. 项目概述

### 1.1 背景

DSH（DeepSeek Harness）是 Cordis 全插件架构的 Agent 工作台，主界面为左侧边栏 + 中间对话区 + 设置面板。用户日常使用 DSH 时已经配置好了模型（Provider / API Key / 模型 ID），但缺少一个「代码库知识资产管理中枢」：没有自动生成的仓库 Wiki、没有结构化的知识卡片、没有可检索的记忆沉淀。

OpenWiki 是一个开源的 CLI 程序（Node.js ≥ 22）：由一个 DeepAgents 文档 Agent 读取代码库，生成并持续维护一份**用户自有的 Markdown Wiki**（写在仓库 `openwiki/` 目录下），提供 13 种模型 Provider、忽略文件（`.openwikiignore`）、可断点续跑的分页任务队列（`begin → submit_plan → next_page → submit_page → finish`）、Grounding Claims 溯源、OKF v0.2 输出、以及一个交互式可视化服务器（`openwiki visualize`，仅监听 `127.0.0.1`）。

PRD《知识中心（Repo Wiki）》以 Qoder CN IDE 的知识中心为蓝本，定义了「Repo Wiki / 知识卡片 / 记忆」三大资产、四种项目状态、两阶段生成模型（先目录规划后文档填充）、总进度 + 单文件进度的双进度体系、暂停/继续/取消、自动导出与导入、搜索筛选、三视图阅读、多文档 Tab 等完整交互规格。

本插件把 OpenWiki 的能力搬进 DSH：在 DSH 侧边栏「设置」上方增加 **openwiki 知识库**入口，在中间区域以视图方式展示知识库页面；在「设置」页左侧新增 **openwiki** 设置页，负责模型配置（重点：复用 DSH 已配置的模型）、忽略文件配置、运行时管理（安装 / 启动 / 版本 / 更新 / 自启动）等功能。

### 1.2 目标

1. **零成本复用 DSH 模型**：openwiki 直接使用 DSH 已配置的 Provider、API Key 与模型，无需用户二次填 Key。
2. **一键接入知识库**：插件加载时自动检测并安装/启动 openwiki 运行时；侧边栏一键进入知识库页面。
3. **页面体验对标 PRD**：知识库页面呈现项目列表、目录树、文档阅读（预览/代码/目录三视图）、多 Tab、搜索筛选、生成进度等 PRD 核心交互。
4. **设置一体化**：在 DSH 设置页内完成 openwiki 的全部配置（模型、忽略文件、语言、运行时管理、更新策略等）。
5. **可维护可分发**：代码落在 `code/` 目录，遵循本文件规定的目录结构、开发规范与验证流程。

### 1.3 范围

| 范围内 | 范围外（本期） |
| --- | --- |
| openwiki 运行时托管（安装/启动/停止/更新/自启动） | 重写 openwiki 的生成 Agent 本体（直接调用其 CLI） |
| 知识库页面（项目列表/目录树/文档阅读/进度/搜索筛选） | 实现 Qoder 云端配额/计费体系（openwiki 无此概念） |
| 模型配置复用与映射 | 记忆 Tab 的 Agent 检索注入（DSH 侧记忆沉淀独立规划） |
| 忽略文件（`.openwikiignore`）图形化管理 | Personal 模式全量接入（首期以 code 模式为主，预留扩展） |
| `--init` / `--update` 生成任务驱动与进度展示 | 连接器（Notion/Slack/Gmail 等）图形化配置 |
| 版本检查与升级 | CI 自更新流水线（openwiki 原生能力，文档说明即可） |

---

## 2. 需求分析：PRD × OpenWiki 能力映射

### 2.1 PRD 功能清单（提炼）

| 编号 | PRD 章节 | 功能 | 关键交互 |
| --- | --- | --- | --- |
| P1 | §2.1 | 入口 | 左侧导航底部 Tab 区，点击展开知识中心主面板 |
| P2 | §2.2 | 项目列表与四种状态 | 未生成/生成中/已暂停/已完成/部分完成 |
| P3 | §3 | 生成配置页 | 语言（双语互斥）、自动更新（Git 条件禁用）、自动导出、引用 4 项配置 + 生成/通过 Plan 创建 2 按钮 + Credits 确认弹窗 |
| P4 | §4 | 四阶段流水线 | 等待中→初始化中→生成目录中→生成文档中→已完成/已暂停/已取消 |
| P5 | §4.2 | 总进度条 | `已完成 X/Y (Z%)，处理中: N，失败: M`，总数动态修正，进度条非线性映射 |
| P6 | §4.3 | 目录树生成期动态展现 | 目录规划完成瞬间整树出现，完成节点打 ✓ |
| P7 | §4.4 | 单文件四状态视图 | 排队占位/渲染中.../完成即阅读/失败+重试，多文档 Tab 并行 |
| P8 | §4.5 | 暂停/继续/取消 | 任务级软暂停，恢复从断点继续 |
| P9 | §5 | 两阶段生成 + 目录数据模型 | 目录规划节点含 name/slug/prompt/dependent_files/parent/layer |
| P10 | §6 | 完成态 | 项目概览卡（版本标签/状态/完成数/更新时间/Commit ID）+ 重新生成 + ⋯更多菜单 |
| P11 | §6.3 | 三视图阅读 | 预览（Markdown 渲染 + Mermaid）/代码/目录（TOC 悬浮面板） |
| P12 | §6.3 | 多文档 Tab | 新开独立 Tab、关闭、面包屑、章节来源跳转源码 |
| P13 | §6.4 | 重新生成 | 确认弹窗 → 全量重置 → 完整流水线，沿用旧配置 |
| P14 | §7 | 部分完成/失败态 | 黄色警告条、已完成文档可读、失败节点保留、重试可用性受全局约束 |
| P15 | §8 | 自动导出/导入 | `.qoder/repowiki/{lang}/content + meta` 目录结构 |
| P16 | §9 | 搜索与筛选 | 左栏实时过滤（父级保留向上冒泡）、项目筛选下拉，正交叠加 |
| P17 | §10 | 知识卡片 Tab | 卡片列表（标题/摘要/标签），与 Wiki 同批生成 |
| P18 | §11 | 记忆 Tab | 自动生成/记忆检索开关、成熟度筛选、四分组树 |
| P19 | §13 | 非功能 | 并发 3、任务隔离、可恢复、成本确认、可追溯、i18n、多 Tab 稳定 |

### 2.2 OpenWiki 能力分析（源码事实，v0.4.3）

| 能力 | 事实依据 | 对应 PRD |
| --- | --- | --- |
| **CLI 命令集** | `openwiki --init`（全量生成）/ `--update`（增量）/ `-p --print`（一次性非交互）/ `-l --language` / `--modelId` / `visualize [path] [--port] [--no-open] [--export]` / `auth` / `ingest` / `cron` / `integrations`（`src/cli/commands.ts`） | P3/P4/P13 |
| **模型 Provider（13 种）** | openai / openai-chatgpt / anthropic / copilot / gemini / gemini-enterprise / openrouter / openai-compatible / bedrock / fireworks / baseten / nebius / nvidia；凭证存 `~/.openwiki/.env`（`src/config/constants.ts`） | 模型配置 |
| **无头化可行** | 向导对已满足的 env 步骤自动跳过（`src/setup/credentials/use-init-setup.ts`），`-p` 打印退出；**插件预写 `.env` 后即可全自动 init** | P3 |
| **分页任务队列（可断点续跑）** | `openwiki/.run.json` 检查点 + `begin→submit_plan→next_page→submit_page→finish`；页面级持久化（Markdown+Claims+manifest 落盘才标记完成）（`src/generation/page-jobs.ts`、`repository-run.ts`） | P4/P5/P7/P8 |
| **进度可观测** | `.run.json` 记录各 page job 状态（pending/skipped/complete）与总数；CLI stdout 输出进度（`src/cli/run-log/`） | P5/P6/P7 |
| **目录数据模型** | `openwiki/.page-manifest.json`（页面清单）+ OKF frontmatter（`generated/verified/sources/status`）；目录树由 agent 规划 | P9 |
| **忽略文件** | 仓库根 `.openwikiignore`（gitignore 语法：注释/空行/`*`/`**`/目录规则/`!` 取反，大小写不敏感，last-match-wins）（`src/agent/openwiki-ignore.ts`） | 忽略配置 |
| **可视化服务器** | `openwiki visualize`：仅监听 `127.0.0.1`，默认 4321 端口（占用自增），路由 `/`、`/client.js`、`/client-lib.js`、`/styles.css`、`/api/graph`、`/events`(SSE 热更新)；`--export` 可导出静态站点（`src/visualize/server.ts`） | P11 预览 |
| **Wiki 产物** | 仓库 `openwiki/`：`index.md`、`log.md`、各概念页 Markdown、`.claims/`（证据溯源）、`.run.json`、`.last-update.json`、`INSTRUCTIONS.md`（用户撰写、永不覆盖） | P15 |
| **语言** | `--language zh|en`（`src/platform/language.ts`） | P3/P19 |
| **版本** | 读取自身 package.json；npm 发布（`npm view openwiki version` 可查最新） | 版本管理 |
| **遥测** | `OPENWIKI_TELEMETRY_DISABLED=1` / `DO_NOT_TRACK=1` 可关 | 隐私 |
| **无 Git 处理** | PRD 的「自动更新条件禁用」对应 openwiki 的 git 仓库依赖（code 模式面向 git 仓库） | P3 |

### 2.3 功能映射矩阵

| PRD 功能 | 实现策略 | 说明 |
| --- | --- | --- |
| P1 入口 | **新建**：`sidebar.footer.action` 注册「openwiki知识库」 | DSH 无左侧 Tab 区，用侧边栏脚部动作位（设置按钮旁/上方） |
| P2 项目状态 | **适配**：以「仓库（workspace/repo）」为项目单位；状态 = openwiki 目录存在性 + `.run.json` + `.last-update.json` 推导 | 未生成（无 openwiki/）、生成中（.run.json）、已完成（.last-update.json success）、失败/中断（update metadata interrupted/failed） |
| P3 配置页 | **新建 UI + 写 openwiki 配置**：语言→`-l` 参数；自动导出→openwiki 天然落盘（恒开，作为提示展示）；引用→预留（DSH 侧引用开关）；自动更新→Git 检测后开放（驱动 `--update`） | Credits 弹窗→改为「将调用 DSH 模型并消耗额度」确认弹窗 |
| P4 四阶段 | **适配**：等待中（任务入队）→初始化中（进程启动）→生成目录中（agent 规划期）→生成文档中（page job 逐页完成）；openwiki 的规划与生成在同一进程内串行，插件以 `.run.json` + stdout 解析出阶段 | 状态机由插件实现 |
| P5 总进度 | **适配**：总数 = 规划完成后 page 数（.run.json），进度 = complete/(total)，处理中/失败从 run 状态读 | openwiki 无「知识卡片并入计数」，总数即页面数 |
| P6 目录树 | **新建**：读取 `.page-manifest.json` + 概念页 frontmatter（`sources`/标题/层级）构建树；生成期轮询刷新，完成节点打 ✓ | 目录树与 wiki 页面一一对应 |
| P7 单文件视图 | **新建**：队列占位（pending）/渲染中（complete 前）/成品（Markdown 渲染）/失败（failed→重试按钮重新驱动该页） | openwiki 失败页在下次 `--update` 重试 |
| P8 暂停/继续/取消 | **适配**：暂停 = 终止子进程（`.run.json` 保证断点）；继续 = 重新 `--init`/`--update` 自动续跑（openwiki 原生 resumable）；取消 = 终止并标记 | 无需丢弃已生成成果 |
| P9 目录模型 | **透出**：`.page-manifest.json` + frontmatter 即目录模型，插件只做读取与展示 | 与 PRD 的 `wiki_catalogs` 语义等价 |
| P10 完成态 | **新建**：概览卡（页面数/更新时间/commit/language）+ 重新生成（确认弹窗→`--init`）+ ⋯菜单（导入导出/语言/开关） | openwiki 产物天然在仓库内，导出即仓库文件；导入即 `--init` 重新生成或直接读取已有 `openwiki/` |
| P11 三视图 | **混合**：预览 = 自渲染 Markdown（前端 `marked` 类库或 iframe 嵌入 openwiki visualizer）；代码 = 原始 Markdown 文本；目录 = TOC 解析 | iframe 方案（P0 验证项）与原生方案二选一，见 §5.2.3 |
| P12 多 Tab/面包屑/章节来源 | **新建**：视图内 Tab 管理（插件私有 store）；章节来源 = frontmatter `sources`（`repo://path#L..`）→ 点击调用 DSH 文件打开（host RPC） | DSH 无内置源码编辑器，回退为「在文件系统打开/复制路径」 |
| P13 重新生成 | **复用**：确认弹窗 → `--init`（openwiki 语义即全量重规划，保留 INSTRUCTIONS.md） | 与 PRD「全量重置+重新规划」一致 |
| P14 失败态 | **适配**：`.last-update.json`/`.run.json` 错误信息 → 黄色警告条；失败页可单独重试（openwiki 无单页重试命令，用 `--update` 驱动） | 错误原因分层：项目级展示、单文件级统一文案 |
| P15 导出/导入 | **复用**：code 模式 wiki 本就落盘在仓库 `openwiki/`；「导出到」= 提示路径（可选 zip）；「导入自」= 从任意目录复制 `openwiki/` 到当前仓库 | PRD 的 `.qoder/repowiki` → 本项目 `openwiki/` |
| P16 搜索筛选 | **新建**：前端过滤目录树（父级冒泡保留 + 项目剪枝）；筛选 = 仓库下拉 | 纯前端实现 |
| P17 知识卡片 | **适配降级**：openwiki 的 Claims（`.claims/`）即「为 Agent 准备的短结构化知识点」，可映射为知识卡片列表（标题=claim 命题，标签=claim 类型） | PRD 卡片三要素与 Claim 结构可对应；首期以 Claims 浏览呈现 |
| P18 记忆 | **占位**：预留 Tab 结构 + 空态；DSH 会话/记忆能力独立规划，首期不实现 | 明确为后续迭代 |
| P19 非功能 | 任务隔离 = 每仓库一个子进程；并发 = openwiki 内部 page worker 并发（默认并发 3 左右）；i18n = `--language`；可恢复 = `.run.json` | — |

### 2.4 差异化设计取舍（重要决策）

1. **知识库页面呈现方式**：采用 DSH `conversation.view` 视图环（会话页头 Tab「openwiki知识库」），而非自绘弹窗 —— 原生、不遮挡、与会话并列；侧边栏入口负责「确保运行 + 打开会话」，视图直达的可行路径见 §5.2.1（含 `shell.overlay` 兜底方案）。
2. **预览渲染**：优先**原生 Markdown 渲染**（进度/失败态/三视图完全可控），`openwiki visualize` 服务器仅作为「图谱浏览」附加能力（可选 iframe 嵌入，P0 验证 iframe 的 CSP/端口可用性）。
3. **项目单位 = 仓库（workspace）**：DSH 的 workspace 列表即项目列表；wiki 写入 workspace 根目录的 `openwiki/`。
4. **Credits 弹窗语义替换**：openwiki 消耗的是用户模型 API 额度，保留「确认弹窗」的防误触设计（文案改为额度说明）。
5. **知识卡片 = Claims**：openwiki 的 Grounded Claims 是更严谨的「为 Agent 准备的结构化知识」，首期以 Claims 浏览实现知识卡片 Tab，后续可扩展。
6. **设置持久化分离**：DSH 侧插件设置存 DSH settings 命名空间（`openwiki`）；openwiki 自身凭证/模型配置仍写 `~/.openwiki/.env`（openwiki 原生读取，插件只做桥接），两者通过「跟随/手动」模式联动。

---

## 3. 总体架构设计

### 3.1 架构总览

```
┌────────────────────────── DSH Web 浏览器（Client 侧） ──────────────────────────┐
│  sidebar.footer.action         conversation.view               settings.section │
│  「openwiki知识库」入口         视图 Tab：openwiki知识库         设置页「openwiki」   │
│        │ 点击                       │ 渲染知识库页面                  │             │
│        └──────────┬────────────────┘       │                        │             │
│           插件私有 Client Store（视图/页面/任务状态）                        │             │
│                  │ host.call(method, args)  ←── Package-private JSON RPC  ──┘            │
└──────────────────┼───────────────────────────────────────────────────────────┘
                   ▼
┌────────────────────────── DSH Host（Node.js 进程） ─────────────────────────────┐
│  dsh-openwiki Host 插件                                                        │
│   ├─ RuntimeManager  安装/启动/停止/更新/自启动（subprocess + fs + timer）        │
│   ├─ ModelBridge     读 DSH 模型配置 → 生成 ~/.openwiki/.env（agentDefaultModel │
│   │                  + settings(llm-*) + credentials）                          │
│   ├─ JobDriver       驱动 openwiki --init/--update 子进程，解析 .run.json 进度    │
│   ├─ WikiReader      读 openwiki/ 产物（.page-manifest.json/frontmatter/Claims）│
│   ├─ SettingsStore   插件设置命名空间（settings.register('openwiki')）            │
│   └─ RpcHandlers     harness.handle() 方法集（见 §6）                            │
│                    │ spawn(env, cwd=仓库根, args)                               │
│                    ▼                                                           │
│        ┌──────────────────── openwiki CLI 子进程（独立 Node 进程） ──────────────┐  │
│        │ openwiki --init -p -l zh / --update -p        openwiki visualize      │  │
│        │ 读取 ~/.openwiki/.env（DSH 模型桥接写入）          127.0.0.1:4321        │  │
│        │ 写入 {repo}/openwiki/（md + .claims + .run.json + manifest）            │  │
│        └───────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 插件形态

| 维度 | 决策 | 理由 |
| --- | --- | --- |
| 开发期形态 | **动态插件**（cordis_define/run，会话内迭代） | 快速原型、热修复、无需重启 DSH |
| 交付形态 | **包插件**（`code/plugin/dsh-openwiki/`，npm 包，`dsh plugin add` + cordis.patch.yml） | 可分发、可随 profile 常驻、自启动能力（随 DSH 启动） |
| Host/Client | Host（进程/文件/模型桥接）+ Client（三处 UI）双半 | 见 §3.3 |
| 依赖 | 运行时依赖 openwiki（npm 全局安装，插件托管）；DSH 侧仅用内置服务（subprocess/fs/settings/credentials/agentDefaultModel/harness/timer） | 零额外依赖，避免与 DSH 版本冲突 |

> 说明：动态插件（开发期）与包插件（交付期）共用同一份代码，Client/Host 代码体保持一致；包插件把 `code.host`/`code.client` 固化为 `plugin/` 下的两个入口文件（见 §3.4）。

### 3.3 Host / Client 职责划分

| 能力 | 平台 | 依据（已核实） |
| --- | --- | --- |
| 进程管理（安装/启动/停止/更新） | Host | `subprocess`（spawn/resolveExecutable/terminate）、`timer` |
| 文件读写（.env/.openwikiignore/wiki 产物/日志） | Host | `fs`（readText/writeText/listDir/stat） |
| 插件设置持久化 | Host | `settings.register('openwiki', schema)` / `get` / `mutate` |
| 模型配置读取 | Host | `agentDefaultModel.currentSelection()`、`settings.get('llm-pi-ai' / 'llm-deepseek' / 'agent-default-model')`、`credentials.resolve(credentialRef(name))` |
| openwiki 凭证写入 | Host | 写 `~/.openwiki/.env`（格式对齐 `src/config/env.ts` 的 `formatEnv`：`KEY="value"`，原子写） |
| 任务驱动与进度轮询 | Host | 子进程 stdout/stderr 采集 + `timer.interval` 轮询 `.run.json` |
| 版本检查/更新 | Host | `npm view openwiki version`（`web.fetch` 或子进程 npm）+ 已装版本（`openwiki --version` 或读 package.json） |
| 侧边栏入口 / 视图 / 设置页 UI | Client | `slots` 注册 + `React.createElement` + `styles.insert` |
| Client→Host RPC | 双向 | `harness.handle`（Host）/ `host.call`（Client），方法集见 §6 |
| 自启动检测 | Host | 插件 apply 时执行 `RuntimeManager.ensure()`（幂等），见 §5.5 |

### 3.4 代码目录结构（`code/` 规划）

```
code/
├── README.md                        # 目录说明：文档与插件代码的位置约定
├── docs/
│   └── dsh-openwiki-实施文档.md      # 本文档（开发计划/设计/规范）
└── plugin/
    └── dsh-openwiki/                # 插件包（交付形态，后续开发产出）
        ├── package.json             # name: dsh-openwiki；exports host/client
        ├── src/
        │   ├── host/
        │   │   ├── index.ts         # Host 插件入口（apply）
        │   │   ├── runtime.ts       # RuntimeManager（安装/启动/停止/更新/自启动）
        │   │   ├── model-bridge.ts  # ModelBridge（DSH 模型 → ~/.openwiki/.env 映射）
        │   │   ├── jobs.ts          # JobDriver（init/update 子进程 + .run.json 进度）
        │   │   ├── wiki-reader.ts   # WikiReader（manifest/frontmatter/claims 解析）
        │   │   ├── settings.ts      # SettingsStore（settings 命名空间注册）
        │   │   └── rpc.ts           # RpcHandlers（harness.handle 注册）
        │   └── client/
        │       ├── index.ts         # Client 插件入口（apply：三处 slots 注册）
        │       ├── sidebar-entry.ts # sidebar.footer.action 入口组件
        │       ├── kb-view.ts       # conversation.view 'openwiki' 知识库视图
        │       ├── kb-pages/        # 知识库页面子组件（项目列表/目录树/文档阅读/进度/搜索）
        │       ├── settings-page.ts # settings.section 'openwiki' 设置页
        │       ├── store.ts         # 插件私有 Client store（视图/任务/页面状态）
        │       └── styles.css       # 插件样式（--dsw-* token）
        ├── tests/                   # 单元/组件测试
        └── README.md                # 插件使用与开发说明
```

---

## 4. 详细功能设计

### 4.1 侧边栏入口（`sidebar.footer.action`）

**Slot 事实（已核实）**：`sidebar.footer.action` 是 root 级 list Slot，「Optional actions beside Settings at the sidebar foot」，注册项 `{ id, order, label }`，owner props `{ wide: boolean }`（false = 56px 窄栏）。现占用者：`cordis-panel`。

**注册参数**：

```js
slots.register(
  { name: 'sidebar.footer.action', id: 'openwiki', order: 10, label: () => 'openwiki知识库' },
  (props) => React.createElement(OpenWikiEntry, { wide: props.wide, onOpen: openKnowledgeBase }),
)
```

**点击行为**（`openKnowledgeBase`）：
1. `host.call('openwiki/runtime/ensure', {})` —— 幂等检查/安装/启动运行时（首次约数秒），返回 `{ ready, version, port }`；
2. 打开/激活一个会话（通过 `useSessions`/`useWorkspaces` 标准 props 提供的能力；无会话则新建）；
3. **视图直达**：置位插件私有 store `viewRequest = { open: true }`，并触发知识库视图激活（机制见 §4.2.1；若实现阶段确认无法程序化切换会话视图，则回退为「打开会话后停留在当前视图，页头已出现「openwiki知识库」Tab，点击即进入」，并把该限制写入插件 README）。

**视觉**：窄栏（rail）显示图标（📚 或 SVG），宽栏显示「openwiki知识库」文字；状态点：运行时未就绪时灰色、运行中绿色、有生成任务时蓝色脉冲。

### 4.2 知识库页面（`conversation.view`）

#### 4.2.1 视图注册与切换机制

**Slot 事实（已核实）**：`conversation.view` 是 session 级 list Slot，注册项 `{ id, order, label }`；会话体通过 `only: <active id>` 一次渲染一个视图；owner props：`viewRequest`、`openView(view, focus)`、`completeViewRequest()`（会话 store 的写操作绑定，会话页头 Tab 点击即 `actions.setView(id)`）。现占用者：`chat`(z5)、`trajectory`(ui-trajectory)。

**注册参数**：

```js
slots.register(
  { name: 'conversation.view', id: 'openwiki', order: 20, label: () => 'openwiki知识库' },
  (props) => React.createElement(KbView, {
    sessionId: props.sessionId,
    useSession: props.useSession,
    viewRequest: props.viewRequest,
    openView: props.openView,
    completeViewRequest: props.completeViewRequest,
  }),
)
```

**视图切换矩阵**：

| 从 → 到 | 机制 | 实现方 |
| --- | --- | --- |
| 页头 Tab → openwiki | `actions.setView('openwiki')`（会话 store，原生） | z5 已实现 |
| 知识库内 → 回对话 | 视图组件调用 owner prop `openView('chat')` | 本插件（组件内按钮） |
| 侧边栏入口 → openwiki | **M0 已决策：`shell.overlay` 全屏层为主呈现**（源码确认 `uiConversation` 服务无公开视图切换 API，会话活动视图仅存于会话私有 store，根级 Slot 无法程序化切换） | 本插件 |
| 会话重开 | 会话 store `view` 持久化（`dsh.conversation.<session>`），上次停在 openwiki 则重开直接进入 | z5 已实现 |

> **M0 决策（2026-09，见 `code/docs/M0-预研报告.md`）**：侧边栏入口直达的呈现 = **`shell.overlay` 全屏知识库层**（root 级 list Slot，插件私有 store 控制开合，含标题栏/关闭按钮；打开/关闭完全插件可控，不依赖会话 store）。同时保留 `conversation.view` 'openwiki' 注册作为会话页头 Tab 的并行入口，两个入口渲染同一 KbView 组件、共享同一插件 store，用户任选其一。若后续 DSH 提供公共视图切换服务，再评估收敛为单一视图入口。

#### 4.2.2 页面布局（对标 PRD §2.1）

```
┌────────────────────────────────────────────────────────────────┐
│ openwiki 知识库        [回到对话]                       [关闭]   │  ← 视图内工具条
├──────────────┬─────────────────────────────────────────────────┤
│ [Repo Wiki] [知识卡片] [记忆]        🔍 搜索      [筛选▽]        │  ← 三大 Tab + 搜索筛选
│ ┌────────────────────────┐                                    │
│ │ 项目选择器：<workspace> ▽ │                                    │
│ ├────────────────────────┤                                    │
│ │ 左侧目录树（项目分组 →   │  右侧内容区（按状态切换）：             │
│ │  多级章节树，实时过滤）    │  - 未生成：生成配置页（§4.2.4）       │
│ │  ✓ 已完成  ◐ 生成中      │  - 生成中：进度卡（§4.2.5）          │
│ │  ✗ 失败    ○ 排队        │  - 已完成：概览卡（§4.2.6）          │
│ │                        │  - 阅读：文档 Tab 区（§4.2.7）       │
│ └────────────────────────┘                                    │
└────────────────────────────────────────────────────────────────┘
```

#### 4.2.3 数据来源（WikiReader）

| 数据 | 来源 | 解析 |
| --- | --- | --- |
| 项目列表 | DSH workspaces（`useWorkspaces`）+ 各 workspace 的 `openwiki/` 存在性 | 状态推导见 §2.3 P2 |
| 目录树 | `{repo}/openwiki/.page-manifest.json`（页面清单）+ 各页面 frontmatter（`type/title/description/sources`） | 树结构 = 页面路径层级（`openwiki/<dir>/<page>.md`）；生成中期轮询刷新 |
| 页面内容 | `{repo}/openwiki/**/*.md`（不含 `index.md`/`log.md`/`.claims/` 等保留文件） | 文本读取 |
| 知识卡片 | `{repo}/openwiki/.claims/**`（claim 侧车文件）+ frontmatter `sources` | claim = {id, proposition, evidence(versioned)} → 卡片 {标题=proposition, 摘要=evidence 路径, 标签=claim 类型} |
| 进度 | `{repo}/openwiki/.run.json`（存在时） | 阶段/总数/complete/pending/skipped 数 |
| 完成信息 | `{repo}/openwiki/.last-update.json` | 状态（complete/interrupted/failed/...）、时间、commit |

#### 4.2.4 生成配置页（对标 PRD §3）

| 配置项 | 控件 | 落点 |
| --- | --- | --- |
| 语言 | 双按钮互斥（简体中文 / English） | `--language zh|en` |
| 自动更新 | Toggle，无 Git 信息时禁用并提示「当前仓库没有 Git 信息，不支持自动更新」 | 插件定时任务（每日/手动）驱动 `--update` |
| 自动导出 | Toggle（默认开） | openwiki code 模式天然落盘仓库 `openwiki/`；开关仅控制 UI 提示与「导出到」按钮可用性 |
| 引用 | Toggle（默认开） | 预留：控制知识资产注入 DSH Agent 上下文（后续版本接 DSH 记忆/检索） |
| 底部说明 | 「根据你的偏好设置生成 RepoWiki，建议使用主分支。」 | 文案 |
| [生成] 按钮 | 白色实心主按钮 → 确认弹窗「生成将消耗模型额度，是否继续？」→ [继续] 启动任务 | `host.call('openwiki/job/start', { workspaceId, mode: 'init', language, modelId? })` |

#### 4.2.5 进度卡片（对标 PRD §4）

```
┌─────────────────────────────────────────────────────────┐
│ ♻️ 生成文档中                                             │
│ ▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░  ← 绿色进度条          │
│ 正在生成中，已完成 9/35 (25.7%)，处理中: 3，失败: 0        │
│                              [取消]  [暂停]              │
└─────────────────────────────────────────────────────────┘
```

- **阶段状态机**（插件实现）：`等待中 → 初始化中 → 生成目录中 → 生成文档中 → 已完成 | 已暂停 | 已取消 | 失败/部分完成`。
  - 等待中：任务入队（子进程排队）。
  - 初始化中：子进程已启动，agent 扫描仓库。
  - 生成目录中：规划阶段（stdout 关键字 + `.run.json` 尚未出现 page 清单）。
  - 生成文档中：`.run.json` 出现 → 总数 = jobs 总数，已完成 = complete 数，失败 = skipped（终局回滚后为 failed）数；处理中 = pending 中正被 worker 处理的估计（openwiki 内部并发，插件以「pending 且最近有 stdout 活动」近似，首期可直接显示 openwiki 报告的并发）。
- **进度文案模板**：`{阶段标题} · 正在生成中，已完成 {X}/{总数} ({百分比}%)，处理中: {N}，失败: {M}`（PRD §4.2 原文格式）。
- **进度条映射**：填充长度 = 阶段加权映射（初始化≈20%，目录≈25–30%，文档阶段按完成比例线性至 100%）——对齐 PRD 实测的「进度条长度 ≠ 文件完成百分比」。
- **暂停**：`job/kill`（SIGTERM→grace→SIGKILL 由 subprocess 语义保证）→ 标题「已暂停」，处理中归零；`.run.json` 保证断点。
- **继续**：`job/start` 同参数重发 → openwiki 原生断点续跑。
- **取消**：终止子进程并清除任务态，回到配置页。
- **失败/部分完成**：黄色警告条展示 `.last-update.json` 错误摘要；已完成页面可读；失败页面显示「生成失败，请重试。」+ 重试（重试按钮 → `--update` 驱动，若为全局性错误则置灰并提示）。

#### 4.2.6 概览卡与文档阅读（对标 PRD §6）

- 概览卡字段：项目图标+名称、语言标签（zh/en）、生成状态（✓ 已完成 / 部分完成）、`X/Y 完成, Z 失败`、更新时间、Commit ID（git 读取）；操作区：**重新生成**（绿色主按钮 → 确认弹窗「重新生成整个 Repo Wiki 和知识卡片？…可能需要几分钟时间。」→ `--init`）、**⋯ 更多**菜单（导出到 / 导入自 / 语言 / 自动更新 / 自动导出 / 引用）。
- 文档阅读：多文档 Tab（Tab 名 `项目名 / 文件名`，可关闭，超宽滚动）；三视图按钮：**预览**（Markdown 渲染：标题/表格/代码块高亮/Mermaid（前端轻量渲染，失败降级为 text 围栏——openwiki 产物已保证合法或已降级）、**代码**（原始 Markdown）、**目录**（TOC 悬浮面板，锚点滚动）；文末「章节来源」（`sources` frontmatter）→ 点击调用 `host.call('openwiki/fs/reveal', { path, line? })`（打开资源管理器并选中/复制路径；DSH 未来接入编辑器后改为跳转行区间）。

#### 4.2.7 搜索与筛选（对标 PRD §9）

- 搜索：对左侧目录树实时过滤；父级命中→保留该分组及全部祖先与同组兄弟（向上冒泡）；项目整体无命中→隐藏（向下剪枝）；输入保留直至清空。
- 筛选：漏斗按钮 → 「选择仓库」单选下拉（选项 = 全部 workspace）；与搜索正交叠加。

#### 4.2.8 知识卡片 / 记忆 Tab

- **知识卡片**：标题 + 「开启自动生成后，知识卡片将在您使用 openwiki 的过程中逐步积累。」（PRD 文案）+ 搜索/筛选；左侧按项目分组的卡片列表（可折叠）；右侧详情（空态：「选择一个知识卡片查看详情」）。数据 = Claims（§4.2.3）。
- **记忆**：首期占位页（标题 + 「从左侧选择记忆」空态 + 说明文案「记忆功能将在后续版本中接入 DSH 会话记忆」）；预留自动生成/记忆检索开关 UI。

### 4.3 设置页（`settings.section`）

**Slot 事实（已核实）**：`settings.section` 是 root 级 list Slot，「One settings page per list entry」，注册项 `{ id, order, label }`，owner props `{ close }`；`id` 驱动设置面板左侧导航（`only` 过滤）。现占用者：general(0)/models(10)/plugins(15)/agent-presets(20)/market(40)/better-sidebar(100)。

**注册参数**：`{ name: 'settings.section', id: 'openwiki', order: 30, label: () => 'openwiki' }`。

**页面结构**（左导航出现「openwiki」入口，内容列渲染设置页）：

#### 4.3.1 模型配置（重点设计）

**目标**：让 openwiki 直接使用 DSH 已配置的模型，用户零重复配置。

**DSH 侧事实（已核实）**：
- 默认模型选择：`agentDefaultModel.currentSelection()` → `{ provider, model, reasoningEffort }`（实测本机：`provider: deepseek-official, model: deepseek-v4-flash`）；存储于 settings 命名空间 `agent-default-model`（`packages/core/agent-default-model/src/index.ts`）。
- Provider 路由配置：settings 命名空间 `llm-pi-ai`（`providers: { <route>: { apiKeyEnv, baseURL, api, models, ... } }`）与 `llm-deepseek`（原生 DeepSeek：`apiKeyEnv: DEEPSEEK_API_KEY`，`baseURL`）——`packages/llm/llm-pi-ai/src/config.ts`、`llm-deepseek/src/index.ts`。
- 凭证解析：`credentials.resolve(credentialRef('<ENV_NAME>'))` → `{ value, source }`（来源：进程环境 / `~/.dsh/.credentials.yaml` / user-env / project-env）——`packages/credentials/*`。
- 模型探测：`llm.listProviders()` / `llm.resolveModelInfo(provider, model)`（可做连通性与能力校验）。

**openwiki 侧事实（已核实）**：凭证与模型配置读取 `~/.openwiki/.env`，关键键：`OPENWIKI_PROVIDER`（13 种）、`OPENWIKI_MODEL_ID`、各 Provider Key（`OPENAI_API_KEY`、`ANTHROPIC_API_KEY`、`OPENAI_COMPATIBLE_API_KEY`、`GEMINI_API_KEY`、`OPENROUTER_API_KEY`…）、`OPENAI_COMPATIBLE_BASE_URL` 等（`src/config/constants.ts`）；`.env` 文件格式 `KEY="value"`（`src/config/env.ts::formatEnv`），写入需原子替换（openwiki 自带 `.env` 解析，插件按其格式写出即可）。

**设计：双模式模型配置**

| 模式 | 行为 | UI |
| --- | --- | --- |
| **跟随 DSH 默认模型**（默认，推荐） | 每次运行任务前，ModelBridge 读取 `agentDefaultModel.currentSelection()` + `settings.get('llm-pi-ai'/'llm-deepseek')` + `credentials.resolve(...)`，按映射表生成 `~/.openwiki/.env`；DSH 模型变更后无需任何操作 | 单选「使用 DSH 当前默认模型」，只读展示 `provider / model` 与解析结果（Key 掩码），提供「立即同步」按钮 |
| **手动配置** | 用户在设置页选择 openwiki Provider、模型 ID、API Key、Base URL 等，插件写入 `~/.openwiki/.env` 的对应键 | 13 种 Provider 下拉（对齐 openwiki `SELECTABLE_OPENWIKI_PROVIDERS`）、模型 ID 输入（含 Provider 预设模型下拉）、API Key 输入（掩码）、Base URL、高级项 |

**DSH → openwiki Provider 映射表**（ModelBridge 核心逻辑）：

| DSH Provider 路由（示例） | 判定依据 | openwiki Provider | 写入 `.env` |
| --- | --- | --- | --- |
| `deepseek-official`（llm-deepseek） | settings.get('llm-deepseek') 存在 | `openai-compatible` | `OPENWIKI_PROVIDER=openai-compatible`、`OPENAI_COMPATIBLE_BASE_URL=https://api.deepseek.com`（取 llm-deepseek baseURL 或默认）、`OPENAI_COMPATIBLE_API_KEY=<credentials.resolve('DEEPSEEK_API_KEY')>`、`OPENWIKI_MODEL_ID=<model>` |
| pi-ai 路由 `api: openai`/`responses`（如 openai/copilot/deepseek-via-pi） | settings.get('llm-pi-ai').providers[route].api | `openai-compatible` | `OPENAI_COMPATIBLE_BASE_URL=<profile.baseURL>`、`OPENAI_COMPATIBLE_API_KEY=<credentials.resolve(profile.apiKeyEnv)>`、`OPENWIKI_MODEL_ID=<model>` |
| pi-ai 路由 `api: anthropic` | 同上 | `anthropic` | `ANTHROPIC_API_KEY=<…>`、`ANTHROPIC_BASE_URL=<profile.baseURL>`、`OPENWIKI_MODEL_ID=<model>` |
| pi-ai 路由 `api: gemini` | 同上 | `gemini` | `GEMINI_API_KEY=<…>`、`OPENWIKI_MODEL_ID=<model>` |
| 其他 pi-ai 路由 | 按 api 协议分派；无法映射时提示手动配置 | 手动 | — |

**关键实现细节**：
1. `.env` 写入只增改本插件管理的键，不覆盖用户手动配置的其他键（读-改-写，保留 `MANAGED_ENV_KEYS` 之外的键）。
2. **凭证不回传 Client**：解析出的 Key 只存在于 Host 内存与 `.env` 文件，RPC 返回仅含掩码/存在性。
3. 每次 `job/start` 前调用 `ModelBridge.sync()`（跟随模式下），保证「DSH 改了模型 → 下次生成即生效」。
4. 模型有效性校验：写入前用 `llm.resolveModelInfo(provider, model)`（跟随模式）或 openwiki `isValidModelId` 等价规则（手动模式）校验，失败给出明确错误。
5. 跟随模式解析失败（如 DSH 路由无法映射）→ 降级提示用户切手动模式，并给出建议的 openwiki Provider。

#### 4.3.2 忽略文件配置（`.openwikiignore`）

**openwiki 事实（已核实）**：仓库根 `.openwikiignore`，gitignore 语法（注释/空行/`*`/`**`/目录规则/`!` 取反；大小写不敏感；last-match-wins；作为「读边界」，被忽略路径绝不读取/扫描/出现在文档中）（`src/agent/openwiki-ignore.ts`）。

**UI 设计**：
- 当前仓库（当前 workspace）的 `.openwikiignore` 编辑区（textarea + 语法高亮基础版）；
- 规则列表视图：每条规则一行，带删除按钮；「添加规则」输入框 + 模板下拉（`node_modules/`、`dist/`、`build/`、`*.log`、`secrets/`…）；
- 语法说明浮层（注释/`*`/`**`/`!` 取反示例，直接引用 openwiki 文档语义）；
- 保存 → `host.call('openwiki/ignore/save', { workspaceId, content })`（原子写）；
- 未生成过该文件时提供「创建 .openwikiignore」按钮；读取缺失视为空规则集（与 openwiki 行为一致）。

#### 4.3.3 运行时管理（安装 / 启动 / 版本 / 更新 / 自启动）

| 区块 | 内容 |
| --- | --- |
| 运行时状态卡 | 图标 + 版本号（已装）+ 状态（未安装/已安装未运行/运行中 + PID/端口）+ 刷新按钮 |
| 安装 | 「安装 openwiki 运行时」按钮 → `host.call('openwiki/runtime/install')`（npm 全局安装 `openwiki`，校验 Node ≥ 22）；安装失败展示错误与解决指引（Windows 下提示用 npm/pnpm 而非 bun，避免 better-sqlite3 编译问题） |
| 启动 / 停止 | 启动 = `RuntimeManager.ensure()` 校验已装后常驻（无任务时不驻留子进程，仅提供「启动可视化服务器」时启动 visualize 进程）；停止 = 终止相关子进程 |
| 版本 | 已装版本（读 openwiki package.json / `openwiki --version`）+ 最新版本（`web.fetch('https://registry.npmjs.org/openwiki/latest')` 或 `npm view`）；版本比较（semver 字符串比较） |
| 更新 | 「检查更新」→ 有新版本时显示「升级到 vX.Y.Z」按钮 → `npm install -g openwiki@latest`；更新后校验版本并提示重启任务 |
| 自启动 | Toggle「DSH 启动时自动检测并运行 openwiki」（默认开）：插件 apply 时执行 `RuntimeManager.ensure()`；关闭时插件加载仅做状态检测不拉起进程 |
| 日志 | 最近 N 条运行日志（stdout/stderr 环形缓冲，存 `~/.dsh/logs/openwiki-*.log`），设置页内折叠展示 + 「打开日志目录」 |

#### 4.3.4 其他功能设置（从 openwiki 枚举，已核实）

| 设置项 | 默认 | 落点 |
| --- | --- | --- |
| 生成语言 | 简体中文 | `--language zh` |
| `OPENWIKI_CONFIG_DIR` | `~/.openwiki` | 显示与可改（高级），改后所有路径随之切换 |
| 遥测开关 | 关（插件默认写入 `OPENWIKI_TELEMETRY_DISABLED=1`） | `.env` 键 |
| 最大输出 Token（`OPENWIKI_MAX_OUTPUT_TOKENS`） | 不设 | `.env` 键（高级） |
| Provider 重试次数（`OPENWIKI_PROVIDER_RETRY_ATTEMPTS`） | 3 | `.env` 键（高级） |
| OpenAI-compatible 流式开关（`OPENWIKI_OPENAI_COMPATIBLE_STREAMING`） | 不设 | `.env` 键（高级；仅流式网关需要） |
| OpenRouter Max Tokens（`OPENWIKI_OPENROUTER_MAX_TOKENS`） | 不设 | `.env` 键（高级） |
| 计划任务：自动更新频率 | 每周 | 插件 `timer` 定时 + Git 检测；仓库有 Git 且「自动更新」开时执行 `--update` |
| 知识库视图内图谱（visualizer） | 关 | 「打开图谱」→ 启动 `openwiki visualize <wiki> --port 4xxx --no-open`，视图内 iframe 嵌入（P0 验证 CSP 与端口可用性；不可用则新窗口打开） |

> 设置持久化：所有插件自身设置存 DSH settings 命名空间 `openwiki`（schema 见 §7.1）；openwiki 侧配置（模型/凭证/高级项）写 `~/.openwiki/.env`；忽略文件写仓库 `.openwikiignore`。

### 4.4 任务驱动（JobDriver）

```
job/start { workspaceId, mode: init|update, language, modelId? }
  → ModelBridge.sync()（跟随模式）
  → 校验凭证（getCredentialDiagnostics 等价检查：provider/model/key 是否齐备）
  → spawn(openwiki, ['--init'|'--update', '-p', '-l', language, '--telemetry-file', log], {
       cwd: workspaceRoot, env: 继承 + 插件注入的键 })
  → 轮询 .run.json + 采集 stdout → 进度事件推给 Client（poll 或 SSE）
  → 进程退出 → 读 .last-update.json → 终态（complete / interrupted / failed）
job/kill { jobId }        → subprocess.terminate（SIGTERM→grace→SIGKILL，树级）
job/status { jobId }      → { phase, total, done, pending, skipped, failed, message }
```

**多任务隔离**：每个 workspace 最多一个运行中任务；不同 workspace 可并行（各自子进程）；`jobs` 表为 `Map<workspaceId, JobRecord>`（Host 内存）。

**进度轮询**：`timer.interval(2000)` 读取 `.run.json`（文件不存在 = 尚未进入文档阶段）；`.run.json` 删除 = 终局完成（finish 成功）；配合 stdout 关键字（`生成目录`、`page` 完成等）细分阶段。进度数据通过 `host.call` 拉取（Client 每 2s 拉取）或 `harness.handle` 事件订阅（Client 轮询拉取即可，实现简单可靠）。

---

## 5. Host RPC 契约（`harness.handle` 方法集）

> 全部方法参数/返回值为 JSON 兼容；凭证类返回只含掩码与存在性。

| method | 入参 | 返回 | 说明 |
| --- | --- | --- | --- |
| `openwiki/runtime/status` | `{}` | `{ installed, version, latestVersion?, running, pids[], visualizerPort? }` | 状态快照 |
| `openwiki/runtime/ensure` | `{}` | `{ ready, version, installedThisCall, error? }` | 幂等：未装则安装；装好校验可执行；返回就绪 |
| `openwiki/runtime/install` | `{}` | `{ ok, version, error? }` | npm 全局安装 openwiki |
| `openwiki/runtime/uninstall` | `{}` | `{ ok }` | 卸载（高级，二次确认） |
| `openwiki/runtime/checkUpdate` | `{}` | `{ current, latest, hasUpdate }` | 版本检查 |
| `openwiki/runtime/update` | `{}` | `{ ok, from, to, error? }` | 升级到最新 |
| `openwiki/runtime/startVisualizer` | `{ workspaceId, port? }` | `{ port, url, error? }` | 启动 visualize 子进程（127.0.0.1） |
| `openwiki/runtime/stopVisualizer` | `{}` | `{ ok }` | 停止 |
| `openwiki/job/start` | `{ workspaceId, mode, language?, modelId? }` | `{ jobId, phase }` | 启动 init/update 任务 |
| `openwiki/job/kill` | `{ jobId }` | `{ ok, reason }` | 暂停/取消 |
| `openwiki/job/status` | `{ jobId? }` | `{ jobs: JobStatus[] }` | 全量/单任务状态（含进度字段） |
| `openwiki/wiki/tree` | `{ workspaceId }` | `{ tree, generatedAt, totalPages, donePages, failedPages }` | 目录树（manifest + frontmatter 解析） |
| `openwiki/wiki/page` | `{ workspaceId, relPath }` | `{ content, frontmatter, sources }` | 单页原始 Markdown |
| `openwiki/wiki/overview` | `{ workspaceId }` | `{ status, language, lastUpdate, commitId, counts, error? }` | 概览卡数据 |
| `openwiki/wiki/claims` | `{ workspaceId }` | `{ claims: [{ id, proposition, type, evidence, verified }] }` | 知识卡片数据 |
| `openwiki/ignore/get` | `{ workspaceId }` | `{ content, exists }` | 读 `.openwikiignore` |
| `openwiki/ignore/save` | `{ workspaceId, content }` | `{ ok, error? }` | 原子写 `.openwikiignore` |
| `openwiki/model/status` | `{}` | `{ mode, dshSelection, resolved: [{ key, configured, masked }], warnings[] }` | 模型桥接状态（掩码） |
| `openwiki/model/sync` | `{}` | `{ ok, warnings[] }` | 立即按 DSH 模型同步 `.env` |
| `openwiki/settings/get` | `{}` | `SettingsDoc` | 插件设置（settings 命名空间） |
| `openwiki/settings/set` | `{ patch }` | `{ ok }` | 更新插件设置 |
| `openwiki/fs/reveal` | `{ path }` | `{ ok }` | 打开资源管理器定位文件（Windows `explorer /select,`） |
| `openwiki/logs/tail` | `{ lines? }` | `{ entries: [{ ts, level, text }] }` | 运行日志尾 |

---

## 6. 生命周期与自启动设计

### 6.1 状态机（RuntimeManager）

```
[未安装] --install/ensure--> [已安装] --ensure/start--> [就绪(可执行)] 
   ↑                          │                            │
   └----- uninstall ----------┘   [可视化服务器: 独立子进程]
```

- **自启动**：插件 apply（包插件随 DSH 启动加载）→ 若设置 `autoStart=true`（默认）→ `ensure()`：检测 `openwiki` 可执行（`subprocess.resolveExecutable`）→ 未装则 npm 安装（异步、失败仅告警不阻塞插件加载）→ 校验版本。**不做**常驻守护进程（无任务不跑 openwiki，节省资源；「启动」仅指可视化服务器与任务子进程）。
- **幂等**：`ensure()` 可并发调用安全（内部 promise 去重）。
- **故障降级**：安装失败/网络不可用 → runtime 状态卡显示错误与重试；知识库视图显示「运行时未就绪」引导条（指向设置页）。
- **更新后**：杀掉旧版可能残留的子进程；提示重新生成任务（`.run.json` 兼容性由 openwiki 保证，升级后 `--update` 续跑）。
- **插件卸载/停用**：终止本插件管理的全部子进程（subprocess 服务 dispose 语义 + 插件 Fiber disposer），保留 `~/.openwiki` 与仓库 `openwiki/` 数据（用户资产）。

### 6.2 Windows 注意事项（已核实 README）

- 安装使用 npm/pnpm（**不要**用 bun，可能触发 better-sqlite3 原生编译、需要 VS Build Tools）。
- `openwiki` 依赖 Node ≥ 22；DSH 运行于 Node 22（nvm 路径），一般满足。
- 可视化服务器 `127.0.0.1` 端口冲突自动自增；插件请求指定端口（如 4321→尝试，失败递增），并记录实际端口供 iframe/新窗口使用。

---

## 7. 数据与存储设计

### 7.1 插件设置命名空间（`settings.register('openwiki', schema)`）

```ts
z.object({
  autoStart: z.boolean().default(true),          // DSH 启动时自动检测/安装/运行
  modelMode: z.union(['follow', 'manual']).default('follow'),
  manualModel: z.object({                        // 手动模式
    provider: z.string(),                        // openwiki provider id
    modelId: z.string(),
    apiKey: z.string(),                          // 仅存 openwiki .env，不在 settings 明文持久化
    baseUrl: z.string(),
  }).optional(),
  defaultLanguage: z.string().default('zh'),
  autoUpdate: z.boolean().default(false),        // 定时 --update
  autoUpdateFrequencyDays: z.number().default(7),
  autoExport: z.boolean().default(true),
  reference: z.boolean().default(true),          // 引用开关（预留）
  telemetryDisabled: z.boolean().default(true),
  advanced: z.object({                           // 高级 .env 键（可选）
    maxOutputTokens: z.string().optional(),
    providerRetryAttempts: z.string().optional(),
    openaiCompatibleStreaming: z.boolean().optional(),
    openrouterMaxTokens: z.string().optional(),
    configDir: z.string().optional(),            // OPENWIKI_CONFIG_DIR
  }).optional(),
})
```

> 安全：API Key 等秘密只写 `~/.openwiki/.env`（openwiki 原生 0600 权限 + Windows ACL 限制），settings 命名空间不落明文秘密。

### 7.2 openwiki 数据资产（插件只读/只写约定）

| 路径 | 归属 | 插件行为 |
| --- | --- | --- |
| `{repo}/openwiki/**` | openwiki 生成 | 只读展示；不手改生成页（`INSTRUCTIONS.md` 除外——用户自定义） |
| `{repo}/openwiki/INSTRUCTIONS.md` | 用户 | 提供「编辑生成简报」入口（编辑器或文本输入） |
| `{repo}/.openwikiignore` | 用户 | 设置页读写 |
| `~/.openwiki/.env` | openwiki/插件 | 插件按 ModelBridge 规则读改写（保留未知键） |
| `~/.dsh/logs/openwiki-*.log` | 插件 | 运行日志 |

### 7.3 日志

- 任务子进程 stdout/stderr 追加写 `~/.dsh/logs/openwiki-<workspace>-<ts>.log`；
- 环形内存缓冲（最近 500 行）供设置页「日志」折叠区与 `openwiki/logs/tail`；
- 插件自身 console 日志（host/client）带 `dsh-openwiki` 前缀。

---

## 8. 开发计划

### 8.1 里程碑总览

| 里程碑 | 周期 | 目标 | 验收标准 |
| --- | --- | --- | --- |
| **M0 技术预研** | 0.5 周 | 验证三个 P0 风险 | ① headless `--init` 全流程跑通（预写 .env + `-p`）；② `conversation.view` 直达 vs `shell.overlay` 决策落地；③ iframe 嵌入 visualize 的 CSP/端口可用性 |
| **M1 骨架与运行时** | 1 周 | Host 插件骨架 + RuntimeManager + 设置页框架 | 侧边栏入口出现；设置页出现；runtime 状态卡正确显示安装/版本/更新；自启动 ensure() 幂等 |
| **M2 模型桥接** | 1 周 | ModelBridge 完整实现 | 跟随模式：DSH `deepseek-official/deepseek-v4-flash` → `.env` 正确生成；手动模式 13 Provider 可选；掩码展示；同步后 headless init 直接可用 |
| **M3 知识库页面** | 1.5 周 | KbView 全量页面（Repo Wiki Tab） | 项目列表/四种状态/配置页/进度卡/暂停继续取消/目录树/文档阅读三视图/多 Tab/搜索筛选/概览卡/重新生成/失败态 |
| **M4 完善与交付** | 1 周 | 知识卡片 Tab、设置页余项、日志、文档、包插件化 | 知识卡片（Claims）展示；忽略文件编辑器；导入/导出；M0 决策项全部落地；`code/plugin/dsh-openwiki` 可安装；README/实施文档更新 |

### 8.2 M0 预研任务（先行）

1. **headless init 验证**：手工在 `D:\dsh-openwiki\openwiki-main\openwiki-main` 预写 `~/.openwiki/.env`（`OPENWIKI_PROVIDER=openai-compatible` + key + model），执行 `node dist/cli/cli.js --init -p -l zh`（需构建 dist：`pnpm install && pnpm build`），确认跳过向导、产出 `openwiki/`、退出码 0；再执行 `--update -p` 确认增量与 no-op 行为；中断后重跑确认断点续跑。
2. **视图直达验证**：动态插件原型注册 `conversation.view` + `sidebar.footer.action`，验证：页头 Tab 出现与切换；owner prop `openView` 在视图内调用是否生效；侧边栏入口能否程序化切换（若不能 → 切 `shell.overlay` 兜底并记录）。
3. **iframe 验证**：`openwiki visualize <wiki> --port 4421 --no-open` 起服务，知识库视图内 `<iframe src="http://127.0.0.1:4421">` 加载是否正常（DSH 页面为 `http://127.0.0.1:3080`，同 scheme loopback，预期无 X-Frame-Options 阻碍）。

### 8.3 任务分解（M1–M4 卡片级）

| # | 任务 | 里程碑 | 依赖 |
| --- | --- | --- | --- |
| T01 | 插件包骨架（package.json/tsconfig/入口/README） | M1 | — |
| T02 | Host RuntimeManager（detect/install/version/update/ensure） | M1 | M0-① |
| T03 | Client 三处 slots 注册骨架（入口/视图/设置页占位） | M1 | — |
| T04 | 插件 settings 命名空间 + RPC get/set | M1 | — |
| T05 | ModelBridge：DSH 模型读取 + 映射表 + `.env` 读写 | M2 | M0-① |
| T06 | 模型配置 UI（跟随/手动/掩码/校验/同步） | M2 | T05 |
| T07 | JobDriver：spawn/轮询/进度/暂停继续取消 | M3 | T02, M0-① |
| T08 | WikiReader + 项目状态推导 | M3 | T07 |
| T09 | 配置页 + 进度卡 UI | M3 | T07, T08 |
| T10 | 目录树 + 搜索筛选 + 多 Tab + 三视图阅读 | M3 | T08 |
| T11 | 概览卡 + 重新生成 + 失败态 + 导入导出 | M3 | T07, T08 |
| T12 | 知识卡片 Tab（Claims 浏览） | M4 | T08 |
| T13 | 忽略文件编辑器 | M4 | — |
| T14 | 日志系统与设置页日志区 | M4 | T02 |
| T15 | 包插件化（`dsh plugin add` + cordis.patch.yml）与安装验证 | M4 | T01–T14 |
| T16 | 文档收尾（插件 README + 实施文档 v1.1 更新） | M4 | 全部 |

### 8.4 验证策略

- **每任务**：对应单元/组件测试 + 手工冒烟。
- **M2 完成**：一次「跟随 DSH 模型 → 设置页一键同步 → headless init 真实生成」全链路演示（用本仓库或示例仓库）。
- **M3 完成**：PRD 对照走查（§2.1 清单逐项打勾），生成/暂停/继续/取消/失败注入（伪造 `.run.json` 或 kill 进程）全过。
- **M4 完成**：新装 DSH profile 上从零安装插件 → 自启动安装 openwiki → 生成 → 阅读全流程。

---

## 9. 开发规范

### 9.1 代码规范

1. **语言与风格**：TypeScript（交付包）/ 纯 JavaScript（动态插件原型）；ESM；`strict` 类型；注释用中文（团队文档语言）或英文（代码注释遵循 DSH 仓库惯例为英文——本插件独立仓库可中文，**须全仓统一**）。
2. **Cordis 插件纪律**（对齐 `cordis-plugin-development` Skill）：
   - Host 能力一律 `ctx.get(name)` 判空；确为硬依赖才 `inject`；
   - 全部副作用挂在插件 Fiber：`ctx.on` / `ctx.effect` / 注册返回的 disposer 必须保留并随 stop/update 清理（子进程、timer、轮询、slot 注册、RPC handler 均属此类）；
   - Client 只用 `React.createElement`，禁 JSX/TS 语法；样式用 `styles.insert` + `--dsw-*` token；
   - 不 `JSON.stringify` 会话/Slot 等活对象；只取叶子字段；
   - RPC 只传 JSON 兼容数据；秘密永不出 Host。
3. **目录与命名**：按 §3.4；文件职责单一；`runtime.ts` 不掺 UI 逻辑，`kb-view.ts` 不掺进程逻辑。
4. **错误处理**：所有 RPC handler 捕获异常返回 `{ ok:false, error }` 结构；任务失败原因分层（项目级详情 / 单文件级统一文案，对齐 PRD §7.2）。
5. **无魔法数字**：端口、轮询间隔、超时、并发等常量集中 `src/host/constants.ts` 并注释依据（openwiki 默认端口 4321、轮询 2s、进度条阶段权重等）。
6. **版本与兼容**：openwiki 命令参数变化以 `openwiki --help` 实际输出为准（开发期锁定 v0.4.3，升级时先跑 help 回归）；DSH 侧 Slot 契约以 Inspect Provider 实时查询为准（本文件 §4 契约在开发前重新查询确认一次）。

### 9.2 开发流程规范

1. **先查后写**：使用 `cordis_inspect_list/query` 核实 Slot/Service 契约（尤其 `settings.section`/`conversation.view`/`sidebar.footer.action` 的 props 与注册项），不凭本文件快照猜 API。
2. **动态插件迭代**：开发期在「插件开发模式」会话用 `cordis_define → cordis_run → inspect_self 诊断 → 新 Package 修复`循环；改动落到 `code/plugin/dsh-openwiki/src/` 后再做包插件验证。
3. **提交规范**：Git 提交信息 `feat|fix|docs|refactor|test(scope): 描述`（scope: runtime/model/kb/settings/ignore/log）；一个提交一件事；提交前跑类型检查与相关测试。
4. **测试规范**：
   - Host 纯逻辑（ModelBridge 映射、.env 解析、状态推导）必须有单元测试（vitest）；
   - Client 组件用真实 props 驱动 + jsdom；
   - 端到端冒烟脚本 `code/plugin/dsh-openwiki/scripts/smoke.mjs`：安装→同步→init→读树→update，一键跑通。
5. **文档规范**：每个模块 JSDoc 说明契约；PRD 对齐的功能在代码注释标注 PRD 章节号（如 `// PRD §4.2 进度文案格式`）；实施文档随实现修订（v1.x）。

### 9.3 安全规范

1. **凭证最小化**：API Key 只写 `~/.openwiki/.env`（0600）；RPC 与日志掩码；settings 命名空间不存秘密；`.env` 写入保留未知键并原子替换（临时文件 + rename）。
2. **路径边界**：所有子进程 cwd 严格等于 workspace 根；`--telemetry-file` 等参数不拼接用户输入中的可执行内容；wiki 读取路径做 `resolve` + 前缀校验（防 `..` 逃逸）。
3. **网络边界**：visualize 仅 127.0.0.1；插件不做公网端口暴露；更新/安装只操作 npm 官方 registry。
4. **隐私**：默认写入 `OPENWIKI_TELEMETRY_DISABLED=1`（插件场景非必要不向 openwiki 上报遥测）；日志不记录凭证与对话内容。

### 9.4 兼容性规范

- 支持 Windows（主目标，DSH 当前环境）与 macOS/Linux（同一代码路径，路径用 `node:path`，命令用 `resolveExecutable`）。
- openwiki 未安装 / Node 版本不足 / 网络不可用 / 端口占用 均需优雅降级并有 UI 提示。

---

## 10. 风险与对策

| # | 风险 | 等级 | 对策 |
| --- | --- | --- | --- |
| R1 | headless `--init` 在预写 .env 后仍进入交互向导 | 高 | M0-① 提前验证；失败则回退「首次生成需在终端跑一次向导」并在设置页提供「打开终端引导」；openwiki 源码 `use-init-setup.ts` 已确认「已满足步骤自动跳过」，预期可控 |
| R2 | 侧边栏入口无法程序化切换会话视图 | 中 | 已备 `shell.overlay` 兜底（§4.2.1 决策标准）；两种方案均不依赖 DSH 内部私有 API |
| R3 | openwiki 版本升级导致命令/产物格式变化 | 中 | 锁 v0.4.3 基线；升级前跑 `--help` 与冒烟脚本回归；`.run.json`/manifest 解析容错（字段缺失降级） |
| R4 | 生成耗时长（大型仓库 10–30 分钟）被误认为卡死 | 低 | 进度卡实时展示阶段与完成数；无进度变化超时（15 分钟）给出提示与「查看日志」 |
| R5 | iframe 嵌入 visualize 被 CSP/混合内容拦截 | 低 | P0 验证；失败即「新窗口打开」回退，图谱入口体验不受影响 |
| R6 | 多 workspace 并行任务资源竞争（模型限流） | 低 | 每仓库独立任务；设置页提供「全局并发任务数」（默认 2）；失败归因到任务级 |
| R7 | DSH settings 命名空间冲突 | 低 | 命名空间 `openwiki` 唯一；注册失败（重复）时降级为内存配置并告警 |
| R8 | 凭证解析路径复杂（env > credentials.yaml > user-env）导致跟随模式解析失败 | 中 | 模型状态卡展示解析链（source 字段）；失败引导手动模式并预填建议值 |

---

## 11. 附录

### 11.1 关键界面文案（对齐 PRD §14，落地到插件字典）

| 场景 | 文案 |
| --- | --- |
| 未生成主标题 | 生成你的 Repo Wiki |
| 全局提示条 | Repo Wiki（为您准备）和知识卡片（为 Agent 准备）将基于您的代码库一起生成和更新。 |
| 自动更新禁用说明 | 当前仓库没有 Git 信息，不支持自动更新 |
| 自动导出说明 | 开启后，生成的 RepoWiki 将自动导出至项目的 openwiki 目录下。 |
| 引用说明 | 开启后，可被 Agent 引用。 |
| 配置页底部 | 根据你的偏好设置生成 RepoWiki，建议使用主分支。 |
| 生成确认 | 生成 Repo Wiki？/ 生成将消耗模型额度，是否继续？ |
| 等待阶段 | 等待中 · 等待开始分析 |
| 初始化阶段 | 初始化中 · 正在初始化分析 |
| 目录阶段 | 生成目录中 · 正在生成文档目录结构 |
| 文档阶段 | 生成文档中 · 正在生成中，已完成 X/Y (Z%)，处理中: N，失败: M |
| 生成中占位 | Wiki 将在生成完成后显示在这里 |
| 单文件生成中 | 渲染中... |
| 单文件失败 | Repo Wiki 生成失败，请重试。 |
| 暂停态 | 已暂停 |
| 重新生成确认 | 重新生成整个 Repo Wiki 和知识卡片？/ 触发操作后，整个仓库的 Repo Wiki 和知识卡片将被重新生成。这可能需要几分钟时间。 |
| 完成态 | 已完成 / X/Y 完成, Z 失败 |
| 知识卡片简介 | 开启自动生成后，知识卡片将在您使用 openwiki 的过程中逐步积累。 |
| 知识卡片空态 | 选择一个知识卡片查看详情 |
| 记忆空态 | 从左侧选择记忆 |
| 未生成项目按钮 | 去生成 |

### 11.2 openwiki 命令速查（v0.4.3）

```
openwiki --init [-p] [-l zh|en] [--modelId <id>] [--language <locale>] [--telemetry-file <path>]
openwiki --update [-p] [-l zh|en] [--modelId <id>]
openwiki visualize [path] [--port <port>] [--no-open] [--export <dir>]
openwiki auth <provider> | openwiki ingest <source|all> | openwiki cron list|pause|resume|delete
openwiki integrations install|list|uninstall <codex|claude|opencode|cursor>
环境：OPENWIKI_PROVIDER / OPENWIKI_MODEL_ID / <PROVIDER>_API_KEY / OPENAI_COMPATIBLE_BASE_URL /
      OPENWIKI_MAX_OUTPUT_TOKENS / OPENWIKI_PROVIDER_RETRY_ATTEMPTS / OPENWIKI_TELEMETRY_DISABLED /
      OPENWIKI_CONFIG_DIR / OPENWIKI_OPENROUTER_MAX_TOKENS / OPENWIKI_OPENAI_COMPATIBLE_STREAMING
忽略文件：仓库根 .openwikiignore（gitignore 语法）
产物：{repo}/openwiki/{index.md, log.md, <dir>/<page>.md, .page-manifest.json, .claims/, .run.json, .last-update.json, INSTRUCTIONS.md}
```

### 11.3 DSH Slot / 服务速查（本文撰写时实测）

| 项 | 值 |
| --- | --- |
| 侧边栏脚部入口 | `sidebar.footer.action`（list, root, owner `{wide}`） |
| 设置页 | `settings.section`（list, root, owner `{close}`；id 驱动左导航） |
| 中间区域视图 | `conversation.view`（list, session, owner `{viewRequest, openView, completeViewRequest}`；标准 props 含 `sessionId/useSession/useProjection/useInput/inputActions`） |
| 全屏浮层（兜底） | `shell.overlay`（list, root） |
| Host 关键服务 | `subprocess`、`fs`、`settings`、`credentials`、`agentDefaultModel`、`llm`、`timer`、`web`、`webServer` |
| 模型配置存储 | `agent-default-model`{provider,model,reasoningEffort}；`llm-pi-ai`{providers:{route:{apiKeyEnv,baseURL,api,…}}}；`llm-deepseek`；凭证 `credentials.resolve(credentialRef('<ENV>'))` |
| 实测样例 | 本机 `agent-default-model`: `deepseek-official / deepseek-v4-flash / max` |

---

## 12. M4 改版：交互与体验优化（7 项）

> 应用户反馈对知识库页面做一轮交互改版，全部在 `code/plugin/dsh-openwiki` 内实现并经 Playwright 自检（`tests/redesign-verify.mjs` 等，全部通过）。

| # | 需求 | 实现 | 验证 |
| --- | --- | --- | --- |
| 1 | 知识库改为**可拖拽 / 可自由缩放**的浮动窗口 | 弃用全屏 `shell.overlay` 的 `.owk-overlay`，改为 `.owk-win` 定位于 `shell.overlay` 槽：header 拖动（`mousedown`→document `mousemove/mouseup`），右下角 `.owk-win-resize` 手柄缩放（东南角锚定），`□/▣` 最大化切换。几何存于 `kb.win {x,y,w,h,max}`。 | `floating .owk-win present` / `NOT fullscreen (w=862,h=622)` / `drag header` / `resize handle` / `maximize` / `no .owk-overlay` 均 PASS |
| 2 | wiki / 知识卡片切换改为**两个常驻 tab 按钮**（选中高亮 + 图标，置于搜索框后一行） | 删除单一切换按钮，新增 `.owk-tabs`（`.owk-tab` 两个：`📄 Repo Wiki` / `🗂️ 知识卡片`），`snap.tab` 驱动高亮（`.sel`），图标区分避免文字过长。 | `two mode tabs (2)` / `Repo Wiki tab selected by default` PASS |
| 3 | 左侧目录改为**可折叠 / 展开树列表** | 目录节点改为可点击折叠（`▾/▸`），展开状态存于 `kb.expandedDirs`（key 为目录路径），`buildTree` 给目录节点附 `path`，加载时 `expandAllDirs` 默认全展开。 | `collapsible dir nodes (6)` / `collapse dir reduces items (30->22)` PASS |
| 4 | 修复 md 内链**点击不能正确跳转** | ①`renderInline` 内部链接渲染为 `.owk-wiki-link`（`onClick+preventDefault` 拦截），外部 scheme 仍新窗口。②`openWikiLink` 解析：剥离 `/openwiki/` 前缀、绝对链接不再拼当前页面目录、相对链接拼当前目录。③host `readWikiPage` 对无 `.md` 后缀输入做 `.md` 兜底；`openPage` 保持 path 原样（disk-scan 返回带 `.md`）。 | `clicking in-doc link keeps page in-app` / `target doc renders` / `not "页面不存在"` PASS |
| 5 | 设置页：注册 dsh-better-sidebar 侧边页面按钮 + 未安装检测 + 入口显隐开关 | 新增`侧边栏页面插件（dsh-better-sidebar）`卡片：`检测`按钮读 `ctx.get('betterSidebar')`→`已连接/未检测到`；`注册侧边页面到 dsh-better-sidebar`调用 `service.registerTab({id:'openwiki',title,icon,order,single,component})`（幂等，注册后变`已注册侧边页`）；未安装时橙色提示 + 项目地址。`入口显示`卡片：`toggleShowEntry` 写 `localStorage('dsh-openwiki:showEntry')`，footer 入口按 `snap.showEntry` 显隐（默认开）。 | `better-sidebar detected` / `register succeeded (已注册侧边页)` / `entry switch toggles` / `sidebar entry present (default ON)` PASS |
| 6 | 移除文档右上角**「更新」按钮**（其为整项目重生成） | 删除 `wikiReady` 时渲染的 `startJob('update')` 按钮；仅在 wiki 不存在（`!wikiReady`）时才渲染一次性的`生成`（`init`）。 | `no "更新" regenerate button` PASS |
| 7 | 项目选择下拉改为**左侧工作区列表** | 删除 `<select>`，新增 `.owk-wslist`（逐个 `.owk-wsitem` 按钮，选中高亮 `sel`）；顶部 `infoLines`（来自 overview：`N 个文档`/`更新于…`/`语言·状态`）展示选中工作区生成信息；点击工作区后同一左栏显示其文档树，点击文档显示内容。 | `workspace list items (2)` / `no select dropdown` / `workspace info shown` PASS |

### 12.1 关键改动点（源码位置）

- `src/client/index.js`
  - state：`win`/`expandedDirs`/`sidebar`/`sidebarRegistered`/`showEntry` 增补。
  - `refreshSidebar`：读 `ctx.get('betterSidebar')` 做检测。
  - `openWikiLink` / `renderInline` / `renderDoc`（`currentWikiPath`）：md 内链应用内导航。
  - `buildTree`（目录 `path`）/`toggleDir`/`expandAllDirs`/`renderTree`（折叠）。
  - `renderKb`：工作区列表 + 双 tab + 移除更新按钮。
  - `registerSidebarTab`/`SidebarKbView`/`toggleShowEntry`：better-sidebar 接入与入口开关。
  - `shell.overlay`：浮动窗口（拖拽/缩放/最大化）。
  - `settings.section`：better-sidebar 卡片 + 入口显示卡片。
  - CSS：`.owk-win*`、`.owk-ws*`、`.owk-tabs/.owk-tab`、`.owk-wiki-link`、`.owk-tree-dir` 交互。
- `src/host/index.js`
  - `readWikiPage`：`.md` 兜底（无扩展名输入→尝试 `safeRel.md`）。
- `scripts/build-client.mjs` / `build-host.mjs`：无需改动（仅生成 bundle）。

### 12.2 验证脚本

| 脚本 | 覆盖 |
| --- | --- |
| `tests/redesign-verify.mjs` | 7 项主流程（23 项断言全 PASS，无 console error） |
| `tests/link-nav-verify.mjs` | #4 链接跳转专项（4 项 PASS） |
| `tests/sidebar-reg-verify.mjs` | #5 better-sidebar 注册专项（4 项 PASS，无 pageerror） |

### 12.3 已知非阻塞项

- `settings` 命名空间注册依赖 `@deepseek-ai/schemastery`，从 profile node_modules 动态 import 可能失败（`settings namespace skipped`）——运行时管理/模型同步不受影响，仍以内存配置工作。
- `readLatest` 依赖 `web.fetch`，当 web 服务未注入时 `latestVersion` 为 `null`（`registry query failed: no usable web provider`）——不影响功能，仅"最新版本"提示为空。

---

## 13. M5 改版：交互优化与能力调研（用户反馈第二轮）

> 针对用户第二轮反馈做 8 项改动与能力确认，全部在 `code/plugin/dsh-openwiki` 内实现并经 Playwright 自检（`tests/round2-verify.mjs`、`tests/autoreg-verify.mjs`，全部通过）。

| # | 需求 | 实现 / 结论 | 验证 |
| --- | --- | --- | --- |
| 1 | settings 命名空间持久化未启用的影响 | **结论**：DSH settings 服务把各命名空间读写到 `~/.dsh/settings.yaml`（顶层键即命名空间）。本插件 `openwiki` 命名空间因 `@deepseek-ai/schemastery` 动态 import 失败而未注册（`settings namespace skipped`），因此 `openwiki:` 段不会写入 settings.yaml——`autoStart/modelMode/autoUpdate` 等 schema 虽声明但**未实际生效**。当前插件实际配置走**内存态 + localStorage**（入口显隐开关用 localStorage）。影响：这些声明字段无 UI 读写、无效；核心功能（运行时/模型/生成）不依赖它。 | 调研记录 |
| 2 | better-sidebar 注册刷新后消失 → 自动注册 + 持久化 | 客户端服务注册表每次页面加载重建，故刷新后需重新注册。改为**自动注册**：`apply` 尾部用 `timer.interval`（≤12 次）轮询 `ctx.get('betterSidebar')`，一旦服务可用即调 `service.registerTab(...)`。刷新后自动重新注册 → "持久化"。 | `auto-registered on first load` / `still registered after refresh (已注册侧边页)` PASS |
| 3 | Repo Wiki 改名 Open Wiki，按钮顺序 Open Wiki/知识卡片/忽略文件/刷新，删图标 | `modeTabs` 两个 tab 改为纯文本 `Open Wiki`/`知识卡片`（删除 📄/🗂️ emoji），按钮顺序调整为 `modeTabs → 忽略文件 → 刷新`；搜索框 placeholder 同步改 `搜索 Open Wiki`。 | `mode tabs renamed (Open Wiki/知识卡片)` / `no emoji icon` / `button order Open Wiki<忽略文件<刷新` PASS |
| 4 | 知识卡片是否 openwiki 自带 | **结论**：openwiki **自带 Grounded Claims**（`dist/claims/` 模块 + `openwiki/.claims/*.json` 侧车，每条 claim 含 statement + evidence 溯源）。本插件"知识卡片"视图即展示这些 claims，**属于 openwiki 自带能力，保留**。注意其形态是"事实溯源点"（非 PRD 所述"短摘要+snake_case标签"），但来源一致。 | 源码调研（`dist/claims/` + README "Grounded Claims"） |
| 5 | index 目录链接点击：文件夹→展示文件列表，文件→跳转展示 | `openWikiLink` 识别尾 `/` 的文件夹链接 → `browseDirectory(dir)`（新增 `browseDir` 状态），右侧 `renderDoc` 展示该目录文件列表（来自 tree.pages 过滤），点击文件 `openPage`；打开页面时清空 `browseDir`。普通 `.md` 链接继续走 openPage。 | `clicking folder link shows folder browse` PASS |
| 6 | 左侧不再显示"生成中/更新于"，右侧展示完整生成状态 | 左侧 `.wsinfo` 改为仅显示 workspace 路径；右侧新增"Open Wiki 状态"卡片：文件数/成功/失败/更新时间/文档位置(`openwiki/`)/**重新生成**按钮(`startJob('update')`)。host `readWikiOverview` 增强：manifest 缺失时递归扫描得到精确 `pageCount`、`successCount`、`failedCount`，并输出 `wikiDirRelative`。 | `right shows file count/success/failure/update time/doc location/regenerate` / `left wsinfo does NOT show 生成中/更新于` PASS |
| 7 | index/quickstart 文档默认展示首位 | `renderTree` 顶层把 root.pages（含 index.md/quickstart.md）**渲染在目录节点之前**，且 pageWeight 把 `index`/`quickstart` 排最前。树顶级现为 `✓ index → ✓ 快速开始(quickstart) → 📁 architecture …` | `index/quickstart present in tree` / `appear before dirs` PASS |
| 8 | 自动更新设置（dsh 钩子？先确认 openwiki 支持） | **调研结论**：① openwiki **无 git 提交触发**（无 hook/无 fs.watch/无轮询），仅每日 CI cron（`.github/workflows/openwiki-update.yml`，`openwiki code --update --print`）；但它有增量更新引擎（`lastUpdate.gitHead` + `git diff` 只重生成变更页）。② dsh **无 git 钩子/无 git 服务/无文件监听**，但有 `subprocess`（跑 git）、`timer.interval`、`settings`、`fs`。**实现**：采用"外部适配"——host 加自动更新守护 `autoUpdate`：轮询所选工作区 `git rev-parse HEAD`，变化时复用 `startJob({mode:'update', language:'zh'})` 增量更新；新增 RPC `openwiki/autoupdate/set|status`；设置页新增"自动更新"开关卡片（含说明文案）。 | `settings has auto-update card` / `auto-update note` PASS |

### 13.1 关键改动点（源码位置）

- `src/client/index.js`
  - state：`browseDir`、`autoUpdate` 增补。
  - `openWikiLink`：识别文件夹链接（尾 `/`）→ `browseDirectory`。
  - `browseDirectory` / `renderDoc`（`browseDir` 分支）：文件夹浏览。
  - `renderTree`：根页面渲染在目录之前 + `pageWeight` 排序（index/quickstart 最前）。
  - `renderKb`：按钮改名/去图标/重排、左侧 `.wsinfo` 精简、右侧"Open Wiki 状态"卡片。
  - `autoRegisterSidebar` + `apply` 尾部轮询：better-sidebar 自动注册。
  - 设置页：自动更新卡片、`fetchAutoUpdate`/`toggleAutoUpdate`。
- `src/host/index.js`
  - `readWikiOverview`：递归扫描精确 `pageCount`/`successCount`/`failedCount`/`wikiDirRelative`。
  - 新增 `resolveGit`/`readGitHead`/`startAutoUpdate`/`stopAutoUpdate` + `openwiki/autoupdate/set|status` RPC。
- `scripts/build-host.mjs` / `build-client.mjs`：无需改动。

### 13.2 验证脚本

| 脚本 | 覆盖 |
| --- | --- |
| `tests/round2-verify.mjs` | 按钮改名/顺序/去图标、index/quickstart 首位、右侧状态卡、左侧精简、文件夹浏览、自动更新卡（16 项全 PASS） |
| `tests/autoreg-verify.mjs` | better-sidebar 自动注册 + 刷新后仍注册（3 项全 PASS） |

### 13.3 M5 反馈修复（用户实测后）

| 问题 | 根因 | 修复 |
| --- | --- | --- |
| `.page-manifest.json not found` 报错刷屏/疑似卡死 | `readText` 对可选状态文件（`.page-manifest.json`/`.run.json`/`.last-update.json`）不存在（ENOENT）时也 `console.error`；这些文件在 disk-scan fallback 场景本就缺失，被 3 秒轮询 + 全量扫描反复触发。 | `readText` 对错误信息含 `not found\|ENOENT\|no such file` 的**静默返回 null**（不报错）；仅真正读取错误才 `console.error`。 |
| 状态误判"生成中" | `readWikiOverview` 的 `runActive = run !== null` 用**磁盘残留的 `.run.json`**（上一次 interrupted 的 planning 残留）判定，导致空闲也显示"生成中"。 | `runActive` 改为**宿主内存 jobs map 是否有 running 任务**；磁盘 `.run.json` 仅作历史展示（`runPhase`/`runProgress` 兜底），不影响"运行中"标签。 |
| 左侧下方显示工作区路径 | `.wsinfo` 区域渲染了所选工作区路径。 | 移除左侧 `.wsinfo` 区域（不再显示路径）；生成状态只保留在右侧状态卡。 |
| 空闲时全量扫描 | client `timer.interval` 每 3 秒在窗口打开时 `refreshWorkspace`（读到 overview+tree 递归扫描+逐文件读 head）。 | 空闲时只 `refreshJobs` + 刷新 `overview`；**仅当存在 running 任务时**才 `refreshWorkspace`（避免每 3 秒全量磁盘扫描拖慢 UI）。 |

---

## 14. M6 改版：文档目录/按钮/自检/trae 生成（用户第三轮反馈）

> 针对用户第三轮反馈做 5 项改动，全部在 `code/plugin/dsh-openwiki` 内实现并经 Playwright 自检（`tests/round3-verify.mjs`，全部通过）。

| # | 需求 | 实现 | 验证 |
| --- | --- | --- | --- |
| 1 | 文档右侧目录改为弹窗：目录放预览前，点击目录在下方弹窗显示内容，点击目录项预览并正确跳转 | 视图切换顺序改为 **目录/预览/代码**；`目录` 按钮 toggle `tocOpen`，在按钮下方弹出 `.owk-toc-pop` 浮窗（绝对定位，可滚动）；点击目录项调用 `goToHeading(i)` → 关闭弹窗、切到预览、`scrollIntoView('owk-h-i')` 平滑滚动到对应标题。删除原独立 `docView='toc'` 视图。 | `目录 button present` / `toc popover opens` / `toc entries (9)` / `closed after entry click` / `preview view active` PASS |
| 2 | trae 工作区点击生成失败且无任何提示 | 根因：trae **不是 git 仓库**（无 `.git`，仅 openwiki 元数据），openwiki 的 code 模式依赖 git 差异（`git diff HEAD..lastUpdate`），无 git 会静默退出；client 对 job 快速 running→error 无提示。 | ①host `startJob` 在启动前 `readGitHead(ws.path)`，**非 git 仓库时返回明确错误**`该工作目录不是 git 仓库…`；②client `timer` 轮询检测所选工作区 `status==='error'` 的 job，把错误写到 `kb.error`（醒目红字）。 | `trae gen shows clear error` PASS（文案：`该工作目录不是 git 仓库，openwiki 的仓库 Wiki 生成需要 git 历史…`） |
| 3 | 忽略文件/刷新按钮单独一行 | 左栏按钮拆为两行：第一行 `Open Wiki \| 知识卡片`，第二行 `忽略文件 \| 刷新`。 | `mode tabs row (Open Wiki,知识卡片)` / `ignore+refresh share a row` PASS |
| 4 | 设置页自检（openwiki --help）点击无效果 | 根因：`runAction` 在设置 `lastOutput` 后调用 `refreshRuntime()`，而 `refreshRuntime` 开头 `kb.set({busy:true, lastOutput:''})` **清空了自检输出**；且 ok 且 output 为空时不显示任何内容。 | `runAction` 改为**先刷新、最后发布 lastOutput**；成功且输出为空时显示 `命令执行成功（无输出）。`。 | 自检后 `.owk-pre` 出现 `openwiki --help` 600 字符输出 |
| 5 | 删除"M4：改版"文字 | 移除设置页末尾展示的 `M4：改版（弹窗/双侧页/折叠树/…）` muted 行。 | 截图确认无此文字 |

### 14.1 关键改动点（源码位置）

- `src/client/index.js`
  - state：`tocOpen` 增补。
  - `renderDoc`：视图切换改为 `目录/预览/代码`，`目录` 弹 `.owk-toc-pop` 浮窗，`goToHeading` 跳转；删除独立 toc 视图分支。
  - `renderKb`：左栏按钮拆两行（modeTabs 行 + 忽略/刷新行）。
  - `runAction`：先刷新后发布 lastOutput，成功无输出时给默认反馈。
  - `timer` 轮询：检测 error job 写入 `kb.error`。
  - CSS：`.owk-toc-pop` 弹窗样式。
- `src/host/index.js`
  - `startJob`：启动前 `readGitHead` 检查，非 git 仓库返回明确错误。
- `scripts/build-*.mjs`：无需改动。

### 14.2 验证脚本

| 脚本 | 覆盖 |
| --- | --- |
| `tests/round3-verify.mjs` | 目录弹窗、按钮两行、trae 生成错误提示（8 项全 PASS，无 pageerror） |

---

## 15. M6.1 卡死与日志刷屏修复（用户实测后）

> 用户点开"工具系统与执行沙箱"文档时页面卡死，且终端反复出现 scan/registry 报错。定位后修复两处根因。

| 问题 | 根因 | 修复 |
| --- | --- | --- |
| **点击文档卡死**（如"工具系统与执行沙箱"） | `renderMarkdown` 的 **fenced code block 检测正则 `/^```(\S*)\s*$/`** 不接受带空格的语言行（如 ` ```ts type-equiv`，`\S*` 匹配不到空格后的 `type-equiv`），该行识别失败落入 paragraph 分支；而 paragraph 的推进条件 `!/^```/` 又把它排除成"代码块开头"，**`i` 永不推进 → 无限循环**，主线程挂死。该文档含大量 ` ```lang xxx` 信息字符串，必触发。 | fence 检测改为 `line.startsWith('```')` 即视为代码块开始（忽略语言/信息串），段落循环不再触达 ` ``` ` 起始行。实测该文档渲染从"死循环"变为 **~562ms** 完成，无 pageerror。 |
| **终端 `tree/overview scan failed` 刷屏** | `readWikiTree`/`readWikiOverview` 的 `fs.listDir` 对不存在的 `openwiki` 目录（未生成的 workspace，如 trae）抛错，每次都 `console.error`，被轮询反复触发。 | scan catch 里错误含 `not found\|ENOENT\|no such file` 时**静默**，仅真正读取错误才打印。 |
| **终端 `registry query failed` 刷屏** | `readLatest` 的 `web.fetch` 在无 web provider 的实例上失败，每次 `runtimeStatus` 都打印。 | `readLatest` 失败只记录一次（`latestWarned` 标志），不影响功能（`latestVersion` 为 null）。 |

### 15.1 关键改动点（源码位置）

- `src/client/index.js` → `renderMarkdown`：fenced code block 检测改为 `line.startsWith('```')`。
- `src/host/index.js`：
  - `readWikiTree` scan catch：not found 静默。
  - `readWikiOverview` scan catch：not found 静默。
  - `readLatest`：失败只报一次（`latestWarned`）。

---

*本文档为 dsh-openwiki 插件的实施依据；实现过程中对 Slot/服务契约的确认以 Cordis Inspect Provider 实时查询结果为准。*
