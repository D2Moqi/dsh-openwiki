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
    // Display languages (static option list). Shared by the "界面语言"
    // (interface language) select and the "文档内容语言" (document content
    // language) select. Only languages that have a built-in UI dictionary
    // (UI_DICTS.zh / en / ja / ko) are exposed; labels are fixed native
    // names, values are BCP-47 codes.
    // ------------------------------------------------------------------
    const LANGS = [
      { code: 'zh', label: '中文' },
      { code: 'en', label: 'English' },
      { code: 'ja', label: '日本語' },
      { code: 'ko', label: '한국어' },
    ]

    // UI string dictionaries. Keys are the Chinese source strings (the zh
    // locale renders keys directly); values may contain {0}/{1}… placeholders
    // that t(key, params) fills in. Full dictionaries: zh / en / ja / ko;
    // selecting any other UI language falls back exact code → primary subtag →
    // en.
    const UI_DICTS = {
      en: {
        '界面语言': 'Interface language',
        '界面显示语言：完整支持 中文 / English / 日本語 / 한국어，其余语言界面自动回退为 English；文档生成语言请在下方「文档内容语言」中单独设置。': 'Interface display language: fully supports 中文 / English / 日本語 / 한국어; any other language falls back to English. The document content language is configured separately in the “Document content language” card below.',
        '运行时': 'Runtime',
        '刷新': 'Refresh',
        '检测中…': 'Detecting…',
        '未检测（点刷新）': 'Not checked (click Refresh)',
        '已安装': 'Installed',
        '未安装': 'Not installed',
        '版本：': 'Version: ',
        '有新版本 v{0}': 'Update available: v{0}',
        '最新': 'Up to date',
        '可执行：': 'Executable: ',
        '脚本：': 'Script: ',
        '安装 openwiki 运行时': 'Install openwiki runtime',
        '升级到 v{0}': 'Upgrade to v{0}',
        '已是最新版本': 'Already up to date',
        '自检（openwiki --help）': 'Self-check (openwiki --help)',
        '正在安装（npm install -g openwiki）…': 'Installing (npm install -g openwiki)…',
        '正在升级…': 'Upgrading…',
        '正在自检…': 'Running self-check…',
        '模型（DSH 复用 → openwiki）': 'Model (DSH reuse → openwiki)',
        '读取中…': 'Loading…',
        '未读取（点刷新）': 'Not loaded (click Refresh)',
        'DSH 默认模型：': 'DSH default model: ',
        '映射到 openwiki：': 'Mapped to openwiki: ',
        '无法自动映射': 'Cannot auto-map',
        'Key 已解析': 'Key resolved',
        'Key 未解析': 'Key not resolved',
        '凭证引用：': 'Credential ref: ',
        '来源：{0}': 'Source: {0}',
        '~/.openwiki/.env：': '~/.openwiki/.env: ',
        '已存在（provider={0}，model={1}）': 'Exists (provider={0}, model={1})',
        '不存在': 'Does not exist',
        '同步到 openwiki (.env)': 'Sync to openwiki (.env)',
        '模型 ID 无效：{0}': 'Invalid model ID: {0}',
        '保存生成模型': 'Save generation model',
        '生成模型（可选）：留空跟随 DSH 模型，如 deepseek-chat': 'Generation model (optional): leave empty to follow the DSH model, e.g. deepseek-chat',
        'openwiki 支持 --modelId 覆盖生成模型：填一个更快的模型（如 deepseek-chat）可显著提升生成速度；留空则跟随 DSH 模型。': 'openwiki supports overriding the generation model via --modelId: a faster model (e.g. deepseek-chat) significantly speeds up generation; leave empty to follow the DSH model.',
        '复制命令': 'Copy command',
        '在终端执行后重新点击同步（命令包含 API Key，请勿泄露）': 'Run it in a terminal, then click Sync again (the command contains an API key — do not leak it)',
        '文档内容语言': 'Document content language',
        '保存': 'Save',
        '生成 / 重新生成 / 更新文档时传给 openwiki 的 -l/--language（BCP-47）语言代码。': 'Language code (BCP-47) passed to openwiki via -l/--language when generating / regenerating / updating documents.',
        '注意：切换语言后「重新生成」会按 openwiki 的语言变更逻辑重写全部文档；下一次运行以设置的文档内容语言为准。': 'Note: after switching the language, “Regenerate” rewrites all documents following openwiki\'s language-change logic; the next run uses the configured document content language.',
        '侧边栏页面插件（dsh-better-sidebar）': 'Sidebar page plugin (dsh-better-sidebar)',
        '检测': 'Check',
        '已连接 dsh-better-sidebar': 'Connected to dsh-better-sidebar',
        '未检测到 dsh-better-sidebar': 'dsh-better-sidebar not detected',
        '（openwiki 页面已注册）': '(openwiki page registered)',
        '（尚未注册）': '(not registered yet)',
        '已注册侧边页': 'Sidebar page registered',
        '注册侧边页面到 dsh-better-sidebar': 'Register sidebar page to dsh-better-sidebar',
        '把 openwiki 知识库注册为 dsh-better-sidebar 的一个侧边栏 Tab（新侧边页面），可直接在侧边栏查看。需要先安装并启用 dsh-better-sidebar 插件。': 'Registers the openwiki knowledge base as a sidebar tab (a new side page) of dsh-better-sidebar so you can view it directly in the sidebar. The dsh-better-sidebar plugin must be installed and enabled first.',
        'dsh-better-sidebar 地址：https://github.com/omdsh-dev/DSH-better-sidebar（已安装时可从侧边栏文件预览访问）。': 'dsh-better-sidebar repo: https://github.com/omdsh-dev/DSH-better-sidebar (once installed, it is reachable from the sidebar file preview).',
        '未检测到 dsh-better-sidebar：请先在 DSH 设置/插件中安装并启用该插件，然后刷新页面，再点击「注册侧边页面到 dsh-better-sidebar」。': 'dsh-better-sidebar was not detected: install and enable it in DSH settings/plugins first, then refresh the page and click “Register sidebar page to dsh-better-sidebar”.',
        '入口显示': 'Show entry',
        '展示知识库入口 ✔': 'Show knowledge-base entry ✔',
        '隐藏知识库入口': 'Hide knowledge-base entry',
        '控制是否在 DSH 主界面左下角「设置」按钮上方显示「openwiki知识库」入口。默认展示，可关闭。': 'Controls whether the “openwiki Knowledge Base” entry is shown above the “Settings” button in the bottom-left of the DSH main UI. Shown by default; can be hidden.',
        '请先选择一个工作区': 'Please select a workspace first',
        '自动更新切换失败：{0}': 'Failed to toggle auto-update: {0}',
        '运行时状态查询失败': 'Failed to query runtime status',
        '错误：': 'Error: ',
        '命令执行成功（无输出）。': 'Command executed successfully (no output).',
        '调用失败：{0}': 'Call failed: {0}',
        '（经 node 子进程写入，绕过工作区沙箱限制）': '(written via a node subprocess, bypassing the workspace sandbox restriction)',
        '（经 DSH fs 服务写入）': '(written via the DSH fs service)',
        '同步成功{0}：\n{1}\n写入：{2}': 'Sync succeeded{0}:\n{1}\nWritten to: {2}',
        '同步失败：{0}': 'Sync failed: {0}',
        '未知错误': 'Unknown error',
        '同步调用失败：{0}': 'Sync call failed: {0}',
        '部分文件导入失败：{0}': 'Some files failed to import: {0}',
        '导入失败：{0}': 'Import failed: {0}',
        '删除失败：{0}': 'Delete failed: {0}',
        '文档语言设置无效：{0}': 'Invalid document language setting: {0}',
        '任务启动失败：{0}': 'Failed to start the task: {0}',
        '保存失败': 'Save failed',
        '保存失败：{0}': 'Save failed: {0}',
        '无法识别的语言 "{0}"：openwiki 使用 BCP-47 语言代码（如 zh / en / zh-CN），或常见语言名（如 English、中文）': 'Unrecognized language "{0}": openwiki uses BCP-47 language codes (e.g. zh / en / zh-CN) or common language names (e.g. English, Chinese)',
        '增量更新': 'Incremental update',
        '初始化': 'Initial generation',
        '检测到之前未完成的生成任务（已保存断点），openwiki 将从断点继续（{0} · 语言 {1}{2}）': 'An unfinished generation task was found (checkpoint saved); openwiki will resume from the checkpoint ({0} · language {1}{2})',
        '暂停失败：{0}': 'Pause failed: {0}',
        '继续失败：{0}': 'Resume failed: {0}',
        '已放弃暂停中的任务（openwiki 的 .run.json 保留，下次生成会从断点恢复；如需全新生成请先完成该次任务）': 'The paused task was abandoned (openwiki .run.json is kept; the next generation resumes from the checkpoint. To regenerate from scratch, finish that task first)',
        '生成失败：{0}': 'Generation failed: {0}',
        '已暂停': 'Paused',
        '暂停中…': 'Pausing…',
        '已取消': 'Cancelled',
        '继续': 'Resume',
        '放弃': 'Abandon',
        '暂停': 'Pause',
        '取消': 'Cancel',
        '生成中': 'Generating',
        '已生成': 'Generated',
        '未生成': 'Not generated',
        '加载中…': 'Loading…',
        '删除': 'Delete',
        '关闭': 'Close',
        '目录：{0}': 'Folder: {0}',
        '根目录': 'Root',
        '返回': 'Back',
        '该目录下暂无文档': 'No documents in this folder yet',
        'Wiki 将在生成完成后显示在这里': 'The Wiki will appear here once generation completes',
        '渲染中...': 'Rendering…',
        'Repo Wiki 生成失败，请重试。': 'Repo Wiki generation failed; please retry.',
        '本文档无二级及以上标题': 'This document has no H2+ headings',
        '目录': 'Outline',
        '预览': 'Preview',
        '代码': 'Code',
        '章节来源：{0}': 'Section source: {0}',
        '{0} 条证据{1}': '{0} evidence items{1}',
        '本地文件': 'Local files',
        '导入中…': 'Importing…',
        '📁 上传文件': '📁 Upload files',
        '支持文本格式（.md / .txt / .csv / .json 等）；PDF / DOCX 等二进制请先转为文本再上传': 'Text formats are supported (.md / .txt / .csv / .json …); convert binaries such as PDF / DOCX to text before uploading',
        '支持文本格式（.md / .txt / .csv / .json 等）；PDF / DOCX 等请先转为文本再上传。': 'Text formats are supported (.md / .txt / .csv / .json …); convert formats such as PDF / DOCX to text before uploading.',
        '保存至 {0}/': 'Saved to {0}/',
        '暂无文件。上传后点击「生成知识库」。': 'No files yet. Upload files, then click “Generate Knowledge Base”.',
        '尚未生成知识库，点击右上「生成知识库」': 'Knowledge base not generated yet — click “Generate Knowledge Base” in the top right',
        '尚未生成 Wiki，点击右上「生成」': 'Wiki not generated yet — click “Generate” in the top right',
        '知识卡片': 'Knowledge Cards',
        '知识库': 'Knowledge Base',
        '忽略文件': 'Ignore file',
        '自动更新 ✔': 'Auto-update ✔',
        '自动更新': 'Auto-update',
        '已开启自动更新（当前工作区）：每 15 秒轮询 git HEAD，检测到新提交自动增量更新 Open Wiki': 'Auto-update is on (current workspace): polls git HEAD every 15 seconds and runs an incremental Open Wiki update on new commits',
        '开启自动更新（当前工作区）：每 15 秒轮询 git HEAD，检测到新提交自动增量更新 Open Wiki': 'Turn on auto-update (current workspace): polls git HEAD every 15 seconds and runs an incremental Open Wiki update on new commits',
        '🔍 搜索 Open Wiki': '🔍 Search Open Wiki',
        '.openwikiignore（gitignore 语法）': '.openwikiignore (gitignore syntax)',
        'Open Wiki 状态': 'Open Wiki status',
        '文件数：': 'Files: ',
        '文件：': 'Files: ',
        '成功：': 'Succeeded: ',
        '失败：': 'Failed: ',
        '更新时间：{0} · {1} · {2} · 模型 {3}': 'Updated: {0} · {1} · {2} · model {3}',
        '文档位置：项目根目录/{0}': 'Docs location: project root/{0}',
        '重新生成': 'Regenerate',
        '根据仓库新增/修改的原始并更新 wiki 文档（任务进行/暂停时由任务卡控制）': 'Updates the wiki documents from sources added/modified in the repo (the task card takes over while a task is running/paused)',
        '生成你的 Open Wiki': 'Generate your Open Wiki',
        '生成': 'Generate',
        'Open Wiki（为您准备）和知识卡片（为 Agent 准备）将基于您的代码库一起生成和更新。': 'Open Wiki (for you) and Knowledge Cards (for agents) are generated and updated together from your codebase.',
        '知识库状态': 'Knowledge base status',
        '页面：': 'Pages: ',
        '输出位置：{0}': 'Output location: {0}',
        '生成知识库': 'Generate Knowledge Base',
        '用 openwiki personal 模式分析来源并生成/更新知识库（任务进行/暂停时由任务卡控制）': 'Analyzes the sources with openwiki personal mode to generate/update the knowledge base (the task card takes over while a task is running/paused)',
        '生成逻辑：每次点击会执行完整分析——AI 读取「上传的本地文件」与「现有知识库」，在保留未变化页面的前提下增量生成/更新知识库页面；内容无变化时不重复记录更新时间。每次生成均消耗模型额度。': 'How it works: every click runs a full analysis — the AI reads the “uploaded local files” and the “existing knowledge base”, incrementally generating/updating pages while keeping unchanged ones; unchanged content does not refresh the update time. Every generation consumes model quota.',
        '• 新增文件：上传后点击「生成知识库」，AI 会将其整理进知识库（新增或并入对应来源/主题页面）。': '• New files: after uploading, click “Generate Knowledge Base” and the AI organizes them into the knowledge base (new page or merged into the matching source/topic page).',
        '• 删除文件：已删除的上传文件，知识库中对应的旧内容暂不会自动清除；如需完全重来，可删除 openwiki-kb/wiki/ 下内容后重新生成。': '• Deleted files: content already generated for removed uploads is not purged automatically; to start over, delete the contents under openwiki-kb/wiki/ and regenerate.',
        '• 与 Open Wiki（代码库）和知识卡片相互独立。': '• Fully independent from Open Wiki (codebase) and Knowledge Cards.',
        '从左侧知识库树选择页面阅读': 'Select a page from the knowledge-base tree on the left to read',
        '页面不存在': 'Page not found',
        'openwiki 知识库': 'openwiki Knowledge Base',
        'openwiki知识库': 'openwiki Knowledge Base',
        '最大化/还原': 'Maximize / Restore',
        '运行时 v{0}{1}': 'Runtime v{0}{1}',
        '（可升级到 v{0}）': ' (upgrade available: v{0})',
        '运行时未安装': 'Runtime not installed',
        '运行时状态未知': 'Runtime status unknown',
        '拖动缩放': 'Drag to resize',
        '弹窗': 'Window',
        '注册失败：{0}': 'Registration failed: {0}',
        '未检测到 dsh-better-sidebar 插件。请先安装并启用该插件，然后刷新页面。': 'The dsh-better-sidebar plugin was not detected. Install and enable it first, then refresh the page.',
        '、模型 {0}': ', model {0}',
        '拖动调整左栏宽度': 'Drag to resize the left column',
      }, // I18N-EN-END
      ja: {
        '界面语言': '表示言語',
        '界面显示语言：完整支持 中文 / English / 日本語 / 한국어，其余语言界面自动回退为 English；文档生成语言请在下方「文档内容语言」中单独设置。': '画面の表示言語：中文 / English / 日本語 / 한국어 を完全サポート。その他の言語は英語に自動フォールバックします。ドキュメントの生成言語は下の「ドキュメントの内容言語」で個別に設定してください。',
        '运行时': 'ランタイム',
        '刷新': '更新',
        '检测中…': '検出中…',
        '未检测（点刷新）': '未検出（「更新」をクリック）',
        '已安装': 'インストール済み',
        '未安装': '未インストール',
        '版本：': 'バージョン：',
        '有新版本 v{0}': '新しいバージョン v{0} があります',
        '最新': '最新',
        '可执行：': '実行ファイル：',
        '脚本：': 'スクリプト：',
        '安装 openwiki 运行时': 'openwiki ランタイムをインストール',
        '升级到 v{0}': 'v{0} へアップグレード',
        '已是最新版本': 'すでに最新バージョンです',
        '自检（openwiki --help）': 'セルフチェック（openwiki --help）',
        '正在安装（npm install -g openwiki）…': 'インストール中（npm install -g openwiki）…',
        '正在升级…': 'アップグレード中…',
        '正在自检…': 'セルフチェック中…',
        '模型（DSH 复用 → openwiki）': 'モデル（DSH 再利用 → openwiki）',
        '读取中…': '読み込み中…',
        '未读取（点刷新）': '未読み込み（「更新」をクリック）',
        'DSH 默认模型：': 'DSH デフォルトモデル：',
        '映射到 openwiki：': 'openwiki へのマッピング：',
        '无法自动映射': '自動マッピング不可',
        'Key 已解析': 'Key 解決済み',
        'Key 未解析': 'Key 未解決',
        '凭证引用：': '資格情報の参照：',
        '来源：{0}': '出典：{0}',
        '~/.openwiki/.env：': '~/.openwiki/.env：',
        '已存在（provider={0}，model={1}）': '存在（provider={0}、model={1}）',
        '不存在': '存在しません',
        '同步到 openwiki (.env)': 'openwiki (.env) へ同期',
        '模型 ID 无效：{0}': 'モデル ID が無効です：{0}',
        '保存生成模型': '生成モデルを保存',
        '生成模型（可选）：留空跟随 DSH 模型，如 deepseek-chat': '生成モデル（任意）：空欄なら DSH モデルに従います。例：deepseek-chat',
        'openwiki 支持 --modelId 覆盖生成模型：填一个更快的模型（如 deepseek-chat）可显著提升生成速度；留空则跟随 DSH 模型。': 'openwiki は --modelId で生成モデルの上書きに対応：より高速なモデル（例：deepseek-chat）を指定すると生成が大幅に速くなります。空欄なら DSH モデルに従います。',
        '复制命令': 'コマンドをコピー',
        '在终端执行后重新点击同步（命令包含 API Key，请勿泄露）': 'ターミナルで実行後に再度「同期」をクリックしてください（コマンドに API Key が含まれるため、漏洩しないよう注意）',
        '文档内容语言': 'ドキュメントの内容言語',
        '保存': '保存',
        '生成 / 重新生成 / 更新文档时传给 openwiki 的 -l/--language（BCP-47）语言代码。': 'ドキュメントの生成・再生成・更新時に openwiki へ渡す -l/--language（BCP-47）の言語コード。',
        '注意：切换语言后「重新生成」会按 openwiki 的语言变更逻辑重写全部文档；下一次运行以设置的文档内容语言为准。': '注意：言語を変更して「再生成」すると、openwiki の言語変更ロジックに従って全ドキュメントが書き直されます。次回の実行では設定したドキュメントの内容言語が使われます。',
        '侧边栏页面插件（dsh-better-sidebar）': 'サイドバーページプラグイン（dsh-better-sidebar）',
        '检测': '検出',
        '已连接 dsh-better-sidebar': 'dsh-better-sidebar に接続済み',
        '未检测到 dsh-better-sidebar': 'dsh-better-sidebar を検出できません',
        '（openwiki 页面已注册）': '（openwiki ページ登録済み）',
        '（尚未注册）': '（未登録）',
        '已注册侧边页': 'サイドバーページを登録済み',
        '注册侧边页面到 dsh-better-sidebar': 'dsh-better-sidebar にサイドバーページを登録',
        '把 openwiki 知识库注册为 dsh-better-sidebar 的一个侧边栏 Tab（新侧边页面），可直接在侧边栏查看。需要先安装并启用 dsh-better-sidebar 插件。': 'openwiki ナレッジベースを dsh-better-sidebar のサイドバータブ（新しいサイドページ）として登録し、サイドバーで直接表示できます。事前に dsh-better-sidebar プラグインのインストールと有効化が必要です。',
        'dsh-better-sidebar 地址：https://github.com/omdsh-dev/DSH-better-sidebar（已安装时可从侧边栏文件预览访问）。': 'dsh-better-sidebar のリポジトリ：https://github.com/omdsh-dev/DSH-better-sidebar（インストール済みならサイドバーのファイルプレビューからアクセスできます）。',
        '未检测到 dsh-better-sidebar：请先在 DSH 设置/插件中安装并启用该插件，然后刷新页面，再点击「注册侧边页面到 dsh-better-sidebar」。': 'dsh-better-sidebar が検出されません：DSH 設定/プラグインで先にこのプラグインをインストールして有効化し、ページを更新してから「dsh-better-sidebar にサイドバーページを登録」をクリックしてください。',
        '入口显示': 'エントリ表示',
        '展示知识库入口 ✔': 'ナレッジベースエントリを表示 ✔',
        '隐藏知识库入口': 'ナレッジベースエントリを非表示',
        '控制是否在 DSH 主界面左下角「设置」按钮上方显示「openwiki知识库」入口。默认展示，可关闭。': 'DSH メイン画面の左下「設定」ボタンの上に「openwiki ナレッジベース」エントリを表示するかどうかを制御します。初期状態は表示で、非表示にできます。',
        '请先选择一个工作区': '先にワークスペースを選択してください',
        '自动更新切换失败：{0}': '自動更新の切り替えに失敗：{0}',
        '运行时状态查询失败': 'ランタイム状態の取得に失敗しました',
        '错误：': 'エラー：',
        '命令执行成功（无输出）。': 'コマンドは正常に実行されました（出力なし）。',
        '调用失败：{0}': '呼び出しに失敗：{0}',
        '（经 node 子进程写入，绕过工作区沙箱限制）': '（node サブプロセスで書き込み、ワークスペースのサンドボックス制限を回避）',
        '（经 DSH fs 服务写入）': '（DSH fs サービスで書き込み）',
        '同步成功{0}：\n{1}\n写入：{2}': '同期成功{0}：\n{1}\n書き込み先：{2}',
        '同步失败：{0}': '同期に失敗：{0}',
        '未知错误': '不明なエラー',
        '同步调用失败：{0}': '同期呼び出しに失敗：{0}',
        '部分文件导入失败：{0}': '一部のファイルのインポートに失敗：{0}',
        '导入失败：{0}': 'インポートに失敗：{0}',
        '删除失败：{0}': '削除に失敗：{0}',
        '文档语言设置无效：{0}': 'ドキュメント言語の設定が無効です：{0}',
        '任务启动失败：{0}': 'タスクの起動に失敗：{0}',
        '保存失败': '保存に失敗しました',
        '保存失败：{0}': '保存に失敗：{0}',
        '无法识别的语言 "{0}"：openwiki 使用 BCP-47 语言代码（如 zh / en / zh-CN），或常见语言名（如 English、中文）': '認識できない言語「{0}」：openwiki は BCP-47 言語コード（例：zh / en / zh-CN）または一般的な言語名（例：English、Chinese）を使用します',
        '增量更新': '増分更新',
        '初始化': '初期生成',
        '检测到之前未完成的生成任务（已保存断点），openwiki 将从断点继续（{0} · 语言 {1}{2}）': '未完了の生成タスクを検出しました（チェックポイント保存済み）。openwiki はチェックポイントから再開します（{0}・言語 {1}{2}）',
        '暂停失败：{0}': '一時停止に失敗：{0}',
        '继续失败：{0}': '再開に失敗：{0}',
        '已放弃暂停中的任务（openwiki 的 .run.json 保留，下次生成会从断点恢复；如需全新生成请先完成该次任务）': '一時停止中のタスクを破棄しました（openwiki の .run.json は保持され、次回の生成はチェックポイントから再開します。完全に作り直す場合は先にそのタスクを完了してください）',
        '生成失败：{0}': '生成に失敗：{0}',
        '已暂停': '一時停止中',
        '暂停中…': '一時停止中…',
        '已取消': 'キャンセル済み',
        '继续': '再開',
        '放弃': '破棄',
        '暂停': '一時停止',
        '取消': 'キャンセル',
        '生成中': '生成中',
        '已生成': '生成済み',
        '未生成': '未生成',
        '加载中…': '読み込み中…',
        '删除': '削除',
        '关闭': '閉じる',
        '目录：{0}': 'フォルダ：{0}',
        '根目录': 'ルート',
        '返回': '戻る',
        '该目录下暂无文档': 'このフォルダにはまだドキュメントがありません',
        'Wiki 将在生成完成后显示在这里': 'Wiki は生成完了後にここに表示されます',
        '渲染中...': 'レンダリング中…',
        'Repo Wiki 生成失败，请重试。': 'Repo Wiki の生成に失敗しました。もう一度お試しください。',
        '本文档无二级及以上标题': 'このドキュメントには H2 以上の見出しがありません',
        '目录': '目次',
        '预览': 'プレビュー',
        '代码': 'コード',
        '章节来源：{0}': 'セクションの出典：{0}',
        '{0} 条证据{1}': 'エビデンス {0} 件{1}',
        '本地文件': 'ローカルファイル',
        '导入中…': 'インポート中…',
        '📁 上传文件': '📁 ファイルをアップロード',
        '支持文本格式（.md / .txt / .csv / .json 等）；PDF / DOCX 等二进制请先转为文本再上传': 'テキスト形式に対応（.md / .txt / .csv / .json など）。PDF / DOCX などのバイナリは先にテキストへ変換してからアップロードしてください',
        '支持文本格式（.md / .txt / .csv / .json 等）；PDF / DOCX 等请先转为文本再上传。': 'テキスト形式に対応（.md / .txt / .csv / .json など）。PDF / DOCX などは先にテキストへ変換してからアップロードしてください。',
        '保存至 {0}/': '保存先：{0}/',
        '暂无文件。上传后点击「生成知识库」。': 'ファイルはまだありません。アップロード後に「ナレッジベースを生成」をクリックしてください。',
        '尚未生成知识库，点击右上「生成知识库」': 'ナレッジベースは未生成です。右上の「ナレッジベースを生成」をクリックしてください',
        '尚未生成 Wiki，点击右上「生成」': 'Wiki は未生成です。右上の「生成」をクリックしてください',
        '知识卡片': 'ナレッジカード',
        '知识库': 'ナレッジベース',
        '忽略文件': '無視ファイル',
        '自动更新 ✔': '自動更新 ✔',
        '自动更新': '自動更新',
        '已开启自动更新（当前工作区）：每 15 秒轮询 git HEAD，检测到新提交自动增量更新 Open Wiki': '自動更新オン（現在のワークスペース）：15 秒ごとに git HEAD をポーリングし、新しいコミットを検出すると Open Wiki を自動的に増分更新します',
        '开启自动更新（当前工作区）：每 15 秒轮询 git HEAD，检测到新提交自动增量更新 Open Wiki': '自動更新をオン（現在のワークスペース）：15 秒ごとに git HEAD をポーリングし、新しいコミットを検出すると Open Wiki を自動的に増分更新します',
        '🔍 搜索 Open Wiki': '🔍 Open Wiki を検索',
        '.openwikiignore（gitignore 语法）': '.openwikiignore（gitignore 構文）',
        'Open Wiki 状态': 'Open Wiki の状態',
        '文件数：': 'ファイル数：',
        '文件：': 'ファイル：',
        '成功：': '成功：',
        '失败：': '失敗：',
        '更新时间：{0} · {1} · {2} · 模型 {3}': '更新日時：{0} · {1} · {2} · モデル {3}',
        '文档位置：项目根目录/{0}': 'ドキュメントの場所：プロジェクトルート/{0}',
        '重新生成': '再生成',
        '根据仓库新增/修改的原始并更新 wiki 文档（任务进行/暂停时由任务卡控制）': 'リポジトリで追加/変更されたソースをもとに wiki ドキュメントを更新します（タスク実行中/一時停止中はタスクカードが操作を受け持ちます）',
        '生成你的 Open Wiki': 'Open Wiki を生成する',
        '生成': '生成',
        'Open Wiki（为您准备）和知识卡片（为 Agent 准备）将基于您的代码库一起生成和更新。': 'Open Wiki（あなた向け）とナレッジカード（Agent 向け）は、コードベースからまとめて生成・更新されます。',
        '知识库状态': 'ナレッジベースの状態',
        '页面：': 'ページ：',
        '输出位置：{0}': '出力先：{0}',
        '生成知识库': 'ナレッジベースを生成',
        '用 openwiki personal 模式分析来源并生成/更新知识库（任务进行/暂停时由任务卡控制）': 'openwiki personal モードでソースを分析し、ナレッジベースを生成/更新します（タスク実行中/一時停止中はタスクカードが操作を受け持ちます）',
        '生成逻辑：每次点击会执行完整分析——AI 读取「上传的本地文件」与「现有知识库」，在保留未变化页面的前提下增量生成/更新知识库页面；内容无变化时不重复记录更新时间。每次生成均消耗模型额度。': '仕組み：クリックのたびに完全な分析を実行します——AI は「アップロードしたローカルファイル」と「既存のナレッジベース」を読み取り、変更のないページを維持したままナレッジベースのページを増分的に生成/更新します。内容に変化がなければ更新時刻は更新されません。生成のたびにモデル利用枠を消費します。',
        '• 新增文件：上传后点击「生成知识库」，AI 会将其整理进知识库（新增或并入对应来源/主题页面）。': '• 新規ファイル：アップロード後に「ナレッジベースを生成」をクリックすると、AI がナレッジベースに整理します（新規ページ化、または対応するソース/トピックページへ統合）。',
        '• 删除文件：已删除的上传文件，知识库中对应的旧内容暂不会自动清除；如需完全重来，可删除 openwiki-kb/wiki/ 下内容后重新生成。': '• 削除したファイル：アップロードを削除してもナレッジベース内の対応する旧内容は自動では消去されません。完全に作り直す場合は openwiki-kb/wiki/ の内容を削除して再生成してください。',
        '• 与 Open Wiki（代码库）和知识卡片相互独立。': '• Open Wiki（コードベース）やナレッジカードとは独立しています。',
        '从左侧知识库树选择页面阅读': '左のナレッジベースツリーからページを選択して閲覧',
        '页面不存在': 'ページが存在しません',
        'openwiki 知识库': 'openwiki ナレッジベース',
        'openwiki知识库': 'openwiki ナレッジベース',
        '最大化/还原': '最大化 / 元に戻す',
        '运行时 v{0}{1}': 'ランタイム v{0}{1}',
        '（可升级到 v{0}）': '（v{0} にアップグレード可能）',
        '运行时未安装': 'ランタイム未インストール',
        '运行时状态未知': 'ランタイムの状態が不明です',
        '拖动缩放': 'ドラッグでリサイズ',
        '弹窗': 'ウィンドウ',
        '注册失败：{0}': '登録に失敗：{0}',
        '未检测到 dsh-better-sidebar 插件。请先安装并启用该插件，然后刷新页面。': 'dsh-better-sidebar プラグインが検出されません。先にこのプラグインをインストールして有効化し、ページを更新してください。',
        '、模型 {0}': '・モデル {0}',
        '拖动调整左栏宽度': 'ドラッグで左欄の幅を調整',
      }, // I18N-JA-END
      ko: {
        '界面语言': '인터페이스 언어',
        '界面显示语言：完整支持 中文 / English / 日本語 / 한국어，其余语言界面自动回退为 English；文档生成语言请在下方「文档内容语言」中单独设置。': '화면 표시 언어: 中文 / English / 日本語 / 한국어 완전 지원. 그 외 언어는 영어로 자동 폴백됩니다. 문서 생성 언어는 아래 “문서 내용 언어” 카드에서 별도로 설정하세요.',
        '运行时': '런타임',
        '刷新': '새로고침',
        '检测中…': '확인 중…',
        '未检测（点刷新）': '미확인(새로고침 클릭)',
        '已安装': '설치됨',
        '未安装': '미설치',
        '版本：': '버전: ',
        '有新版本 v{0}': '새 버전 v{0} 사용 가능',
        '最新': '최신',
        '可执行：': '실행 파일: ',
        '脚本：': '스크립트: ',
        '安装 openwiki 运行时': 'openwiki 런타임 설치',
        '升级到 v{0}': 'v{0}(으)로 업그레이드',
        '已是最新版本': '이미 최신 버전입니다',
        '自检（openwiki --help）': '자가 점검(openwiki --help)',
        '正在安装（npm install -g openwiki）…': '설치 중(npm install -g openwiki)…',
        '正在升级…': '업그레이드 중…',
        '正在自检…': '자가 점검 중…',
       '模型（DSH 复用 → openwiki）': '모델(DSH 재사용 → openwiki)',
        '读取中…': '불러오는 중…',
        '未读取（点刷新）': '로드 안 됨(새로고침 클릭)',
        'DSH 默认模型：': 'DSH 기본 모델: ',
        '映射到 openwiki：': 'openwiki 매핑: ',
        '无法自动映射': '자동 매핑 불가',
        'Key 已解析': 'Key 확인됨',
        'Key 未解析': 'Key 미확인',
        '凭证引用：': '자격 증명 참조: ',
        '来源：{0}': '출처: {0}',
        '~/.openwiki/.env：': '~/.openwiki/.env: ',
        '已存在（provider={0}，model={1}）': '존재함(provider={0}, model={1})',
        '不存在': '존재하지 않음',
        '同步到 openwiki (.env)': 'openwiki(.env)에 동기화',
        '模型 ID 无效：{0}': '모델 ID가 잘못되었습니다: {0}',
        '保存生成模型': '생성 모델 저장',
        '生成模型（可选）：留空跟随 DSH 模型，如 deepseek-chat': '생성 모델(선택): 비워 두면 DSH 모델을 따릅니다. 예: deepseek-chat',
        'openwiki 支持 --modelId 覆盖生成模型：填一个更快的模型（如 deepseek-chat）可显著提升生成速度；留空则跟随 DSH 模型。': 'openwiki는 --modelId로 생성 모델을 재정의할 수 있습니다: 더 빠른 모델(예: deepseek-chat)을 지정하면 생성 속도가 크게 빨라집니다. 비워 두면 DSH 모델을 따릅니다.',
        '复制命令': '명령 복사',
        '在终端执行后重新点击同步（命令包含 API Key，请勿泄露）': '터미널에서 실행한 후 다시 동기화를 클릭하세요(명령에 API Key가 포함되어 있으니 유출하지 마세요)',
        '文档内容语言': '문서 내용 언어',
        '保存': '저장',
        '生成 / 重新生成 / 更新文档时传给 openwiki 的 -l/--language（BCP-47）语言代码。': '문서 생성/재생성/업데이트 시 openwiki에 전달되는 -l/--language(BCP-47) 언어 코드.',
        '注意：切换语言后「重新生成」会按 openwiki 的语言变更逻辑重写全部文档；下一次运行以设置的文档内容语言为准。': '참고: 언어를 변경한 후 "다시 생성"을 실행하면 openwiki의 언어 변경 로직에 따라 모든 문서가 다시 작성됩니다. 다음 실행부터는 설정된 문서 내용 언어가 적용됩니다.',
        '侧边栏页面插件（dsh-better-sidebar）': '사이드바 페이지 플러그인(dsh-better-sidebar)',
        '检测': '감지',
        '已连接 dsh-better-sidebar': 'dsh-better-sidebar 연결됨',
        '未检测到 dsh-better-sidebar': 'dsh-better-sidebar를 감지하지 못함',
        '（openwiki 页面已注册）': '(openwiki 페이지 등록됨)',
        '（尚未注册）': '(아직 등록되지 않음)',
        '已注册侧边页': '사이드바 페이지 등록됨',
        '注册侧边页面到 dsh-better-sidebar': 'dsh-better-sidebar에 사이드바 페이지 등록',
        '把 openwiki 知识库注册为 dsh-better-sidebar 的一个侧边栏 Tab（新侧边页面），可直接在侧边栏查看。需要先安装并启用 dsh-better-sidebar 插件。': 'openwiki 지식 베이스를 dsh-better-sidebar의 사이드바 탭(새 사이드 페이지)으로 등록하여 사이드바에서 바로 볼 수 있습니다. dsh-better-sidebar 플러그인을 먼저 설치하고 활성화해야 합니다.',
        'dsh-better-sidebar 地址：https://github.com/omdsh-dev/DSH-better-sidebar（已安装时可从侧边栏文件预览访问）。': 'dsh-better-sidebar 저장소: https://github.com/omdsh-dev/DSH-better-sidebar(설치되어 있으면 사이드바 파일 미리보기에서 접근 가능).',
        '未检测到 dsh-better-sidebar：请先在 DSH 设置/插件中安装并启用该插件，然后刷新页面，再点击「注册侧边页面到 dsh-better-sidebar」。': 'dsh-better-sidebar가 감지되지 않았습니다: 먼저 DSH 설정/플러그인에서 해당 플러그인을 설치·활성화한 다음 페이지를 새로고침하고 “dsh-better-sidebar에 사이드바 페이지 등록”을 클릭하세요.',
        '入口显示': '진입 표시',
        '展示知识库入口 ✔': '지식 베이스 진입 표시 ✔',
        '隐藏知识库入口': '지식 베이스 진입 숨기기',
        '控制是否在 DSH 主界面左下角「设置」按钮上方显示「openwiki知识库」入口。默认展示，可关闭。': 'DSH 메인 화면 왼쪽 하단 “설정” 버튼 위에 “openwiki 지식 베이스” 진입을 표시할지 제어합니다. 기본은 표시이며 끌 수 있습니다.',
        '请先选择一个工作区': '먼저 워크스페이스를 선택하세요',
        '自动更新切换失败：{0}': '자동 업데이트 전환 실패: {0}',
        '运行时状态查询失败': '런타임 상태 조회 실패',
        '错误：': '오류: ',
        '命令执行成功（无输出）。': '명령이 성공적으로 실행되었습니다(출력 없음).',
        '调用失败：{0}': '호출 실패: {0}',
        '（经 node 子进程写入，绕过工作区沙箱限制）': '(node 하위 프로세스로 기록, 워크스페이스 샌드박스 제한 우회)',
        '（经 DSH fs 服务写入）': '(DSH fs 서비스로 기록)',
        '同步成功{0}：\n{1}\n写入：{2}': '동기화 성공{0}:\n{1}\n기록 위치: {2}',
        '同步失败：{0}': '동기화 실패: {0}',
        '未知错误': '알 수 없는 오류',
        '同步调用失败：{0}': '동기화 호출 실패: {0}',
        '部分文件导入失败：{0}': '일부 파일 가져오기 실패: {0}',
        '导入失败：{0}': '가져오기 실패: {0}',
        '删除失败：{0}': '삭제 실패: {0}',
        '文档语言设置无效：{0}': '문서 언어 설정이 잘못되었습니다: {0}',
        '任务启动失败：{0}': '작업 시작 실패: {0}',
        '保存失败': '저장 실패',
        '保存失败：{0}': '저장 실패: {0}',
        '无法识别的语言 "{0}"：openwiki 使用 BCP-47 语言代码（如 zh / en / zh-CN），或常见语言名（如 English、中文）': '인식할 수 없는 언어 "{0}": openwiki는 BCP-47 언어 코드(예: zh / en / zh-CN) 또는 일반적인 언어 이름(예: English, Chinese)을 사용합니다',
        '增量更新': '증분 업데이트',
        '初始化': '초기 생성',
        '检测到之前未完成的生成任务（已保存断点），openwiki 将从断点继续（{0} · 语言 {1}{2}）': '완료되지 않은 생성 작업이 감지되었습니다(체크포인트 저장됨). openwiki가 체크포인트에서 재개합니다({0} · 언어 {1}{2})',
        '暂停失败：{0}': '일시 중지 실패: {0}',
        '继续失败：{0}': '재개 실패: {0}',
        '已放弃暂停中的任务（openwiki 的 .run.json 保留，下次生成会从断点恢复；如需全新生成请先完成该次任务）': '일시 중지된 작업을 포기했습니다(openwiki .run.json은 유지되며 다음 생성 시 체크포인트에서 재개됩니다. 완전히 새로 생성하려면 먼저 해당 작업을 완료하세요)',
        '生成失败：{0}': '생성 실패: {0}',
        '已暂停': '일시 중지됨',
        '暂停中…': '일시 중지 중…',
        '已取消': '취소됨',
        '继续': '재개',
        '放弃': '포기',
        '暂停': '일시 중지',
        '取消': '취소',
        '生成中': '생성 중',
        '已生成': '생성됨',
        '未生成': '미생성',
        '加载中…': '불러오는 중…',
        '删除': '삭제',
        '关闭': '닫기',
        '目录：{0}': '폴더: {0}',
        '根目录': '루트',
        '返回': '돌아가기',
        '该目录下暂无文档': '이 폴더에는 아직 문서가 없습니다',
        'Wiki 将在生成完成后显示在这里': 'Wiki는 생성이 완료되면 여기에 표시됩니다',
        '渲染中...': '렌더링 중…',
        'Repo Wiki 生成失败，请重试。': 'Repo Wiki 생성에 실패했습니다. 다시 시도하세요.',
        '本文档无二级及以上标题': '이 문서에는 H2 이상 제목이 없습니다',
        '目录': '목차',
        '预览': '미리보기',
        '代码': '코드',
        '章节来源：{0}': '섹션 출처: {0}',
        '{0} 条证据{1}': '증거 {0}건{1}',
        '本地文件': '로컬 파일',
        '导入中…': '가져오는 중…',
        '📁 上传文件': '📁 파일 업로드',
        '支持文本格式（.md / .txt / .csv / .json 等）；PDF / DOCX 等二进制请先转为文本再上传': '텍스트 형식 지원(.md / .txt / .csv / .json 등). PDF / DOCX 등 바이너리는 먼저 텍스트로 변환한 후 업로드하세요',
        '支持文本格式（.md / .txt / .csv / .json 等）；PDF / DOCX 等请先转为文本再上传。': '텍스트 형식 지원(.md / .txt / .csv / .json 등). PDF / DOCX 등은 먼저 텍스트로 변환한 후 업로드하세요.',
        '保存至 {0}/': '저장 위치: {0}/',
        '暂无文件。上传后点击「生成知识库」。': '파일이 아직 없습니다. 업로드 후 “지식 베이스 생성”을 클릭하세요.',
        '尚未生成知识库，点击右上「生成知识库」': '지식 베이스가 아직 생성되지 않았습니다 — 오른쪽 위 “지식 베이스 생성”을 클릭하세요',
        '尚未生成 Wiki，点击右上「生成」': 'Wiki가 아직 생성되지 않았습니다 — 오른쪽 위 “생성”을 클릭하세요',
        '知识卡片': '지식 카드',
        '知识库': '지식 베이스',
        '忽略文件': '무시 파일',
        '自动更新 ✔': '자동 업데이트 ✔',
        '自动更新': '자동 업데이트',
        '已开启自动更新（当前工作区）：每 15 秒轮询 git HEAD，检测到新提交自动增量更新 Open Wiki': '자동 업데이트 켜짐(현재 워크스페이스): 15초마다 git HEAD를 폴링하고 새 커밋이 감지되면 Open Wiki를 자동으로 증분 업데이트합니다',
        '开启自动更新（当前工作区）：每 15 秒轮询 git HEAD，检测到新提交自动增量更新 Open Wiki': '자동 업데이트 켜기(현재 워크스페이스): 15초마다 git HEAD를 폴링하고 새 커밋이 감지되면 Open Wiki를 자동으로 증분 업데이트합니다',
        '🔍 搜索 Open Wiki': '🔍 Open Wiki 검색',
        '.openwikiignore（gitignore 语法）': '.openwikiignore(gitignore 구문)',
        'Open Wiki 状态': 'Open Wiki 상태',
        '文件数：': '파일 수: ',
        '文件：': '파일: ',
        '成功：': '성공: ',
        '失败：': '실패: ',
        '更新时间：{0} · {1} · {2} · 模型 {3}': '업데이트 시각: {0} · {1} · {2} · 모델 {3}',
        '文档位置：项目根目录/{0}': '문서 위치: 프로젝트 루트/{0}',
        '重新生成': '다시 생성',
        '根据仓库新增/修改的原始并更新 wiki 文档（任务进行/暂停时由任务卡控制）': '저장소에서 추가/수정된 소스를 기반으로 wiki 문서를 업데이트합니다(작업 실행/일시 중지 중에는 작업 카드가 제어)',
        '生成你的 Open Wiki': 'Open Wiki 생성',
        '生成': '생성',
        'Open Wiki（为您准备）和知识卡片（为 Agent 准备）将基于您的代码库一起生成和更新。': 'Open Wiki(사용자용)와 지식 카드(에이전트용)는 코드베이스를 기반으로 함께 생성·업데이트됩니다.',
        '知识库状态': '지식 베이스 상태',
        '页面：': '페이지: ',
        '输出位置：{0}': '출력 위치: {0}',
        '生成知识库': '지식 베이스 생성',
        '用 openwiki personal 模式分析来源并生成/更新知识库（任务进行/暂停时由任务卡控制）': 'openwiki personal 모드로 소스를 분석하여 지식 베이스를 생성/업데이트합니다(작업 실행/일시 중지 중에는 작업 카드가 제어)',
        '生成逻辑：每次点击会执行完整分析——AI 读取「上传的本地文件」与「现有知识库」，在保留未变化页面的前提下增量生成/更新知识库页面；内容无变化时不重复记录更新时间。每次生成均消耗模型额度。': '작동 방식: 클릭할 때마다 전체 분석이 실행됩니다 — AI가 “업로드한 로컬 파일”과 “기존 지식 베이스”를 읽고, 변경되지 않은 페이지는 유지하면서 지식 베이스 페이지를 증분 생성/업데이트합니다. 내용에 변화가 없으면 업데이트 시각을 갱신하지 않습니다. 생성할 때마다 모델 할당량을 사용합니다.',
        '• 新增文件：上传后点击「生成知识库」，AI 会将其整理进知识库（新增或并入对应来源/主题页面）。': '• 새 파일: 업로드 후 “지식 베이스 생성”을 클릭하면 AI가 지식 베이스에 정리합니다(새 페이지로 추가하거나 해당 소스/주제 페이지에 통합).',
        '• 删除文件：已删除的上传文件，知识库中对应的旧内容暂不会自动清除；如需完全重来，可删除 openwiki-kb/wiki/ 下内容后重新生成。': '• 삭제된 파일: 업로드를 삭제해도 지식 베이스의 기존 내용은 자동으로 지워지지 않습니다. 완전히 새로 하려면 openwiki-kb/wiki/ 내용을 삭제한 후 다시 생성하세요.',
        '• 与 Open Wiki（代码库）和知识卡片相互独立。': '• Open Wiki(코드베이스) 및 지식 카드와 완전히 독립적입니다.',
        '从左侧知识库树选择页面阅读': '왼쪽 지식 베이스 트리에서 페이지를 선택해 읽으세요',
        '页面不存在': '페이지가 존재하지 않습니다',
        'openwiki 知识库': 'openwiki 지식 베이스',
        'openwiki知识库': 'openwiki 지식 베이스',
        '最大化/还原': '최대화/복원',
        '运行时 v{0}{1}': '런타임 v{0}{1}',
        '（可升级到 v{0}）': '(v{0}(으)로 업그레이드 가능)',
        '运行时未安装': '런타임 미설치',
        '运行时状态未知': '런타임 상태를 알 수 없음',
        '拖动缩放': '드래그하여 크기 조정',
        '弹窗': '창',
        '注册失败：{0}': '등록 실패: {0}',
        '未检测到 dsh-better-sidebar 插件。请先安装并启用该插件，然后刷新页面。': 'dsh-better-sidebar 플러그인이 감지되지 않았습니다. 먼저 설치·활성화한 후 페이지를 새로고침하세요.',
        '、模型 {0}': ', 모델 {0}',
        '拖动调整左栏宽度': '드래그하여 왼쪽 열 너비 조정',
      }, // I18N-KO-END
    }

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
        // 知识库（personal 模式）状态（「知识库」Tab）。
        kbFiles: null,        // kb/files 结果（source/files 列表）
        kbTree: null,         // kb/tree 结果（wiki 输出树）
        kbPage: null,         // kb/page 结果（正在阅读的知识库页面）
        kbConfig: null,       // kb/config 结果（目录/提示词）
        kbOverview: null,     // kb/overview 结果（personal wiki 状态）
        importing: false,     // 文件导入中
        kbNotice: null,       // 知识库 Tab 的中性提示
        jobs: [],
        tab: 'wiki',           // 'wiki' | 'cards' | 'kb'
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
        // UI display language (interface language select). Independent of
        // `language` (the document content language); persisted in localStorage.
        uiLang: 'zh',
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
      const ui = window.localStorage.getItem('dsh-openwiki:uiLang')
      if (ui && LANGS.some((l) => l.code === ui)) kb.set({ uiLang: ui })
      const lang = window.localStorage.getItem('dsh-openwiki:language')
      if (lang) kb.set({ language: lang })
      const mdl = window.localStorage.getItem('dsh-openwiki:model')
      if (mdl) kb.set({ genModel: mdl })
    } catch { /* localStorage unavailable */ }

    // Resolve the selected UI-language code to a locale with a shipped
    // dictionary: exact code match → primary-subtag match → en. zh itself has
    // no dictionary entry because Chinese keys ARE the zh texts.
    const resolveUiLocale = (code) => {
      const c = String(code || '').trim()
      if (c === 'zh' || c === 'zh-TW') return 'zh'
      if (UI_DICTS[c]) return c
      const primary = c.split('-')[0].toLowerCase()
      if (primary === 'zh') return 'zh'
      if (UI_DICTS[primary]) return primary
      return 'en'
    }

    // Translate a UI string. Keys are the Chinese source strings; {0}/{1}…
    // placeholders are filled from `params` (array or single value). Lookup
    // order: current locale dictionary → en → the key itself (zh source).
    const t = (key, params) => {
      const want = String(key)
      const pick = (d) => (d && Object.prototype.hasOwnProperty.call(d, want) ? String(d[want]) : null)
      const locale = resolveUiLocale(kb.get().uiLang)
      let out = locale === 'zh' ? want : (pick(UI_DICTS[locale]) ?? pick(UI_DICTS.en) ?? want)
      if (params !== undefined && params !== null) {
        const ps = Array.isArray(params) ? params : [params]
        out = out.replace(/\{(\d+)\}/gu, (m, i) => (ps[Number(i)] !== undefined ? String(ps[Number(i)]) : m))
      }
      return out
    }

    // Best-effort translation for a mostly host-produced message (error texts,
    // job output …): only whole-message dictionary hits are translated, so any
    // unknown/unpredictable content passes through untouched.
    const msg = (text) => {
      const s = String(text ?? '')
      if (!s) return s
      const locale = resolveUiLocale(kb.get().uiLang)
      if (locale === 'zh') return s
      const hit = (d) => (d && Object.prototype.hasOwnProperty.call(d, s) ? String(d[s]) : null)
      return hit(UI_DICTS[locale]) ?? hit(UI_DICTS.en) ?? s
    }

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

    // Auto-update watcher: per-workspace state (工作区级别，与面板开关一致)。
    const fetchAutoUpdate = (workspaceId) => {
      const target = workspaceId || kb.get().selected
      if (!target) return
      call('openwiki/autoupdate/status', { workspaceId: target })
        .then((res) => { if (res && typeof res === 'object') kb.set({ autoUpdate: { enabled: Boolean(res.enabled), workspaceId: target } }) })
        .catch(() => {})
    }

    const toggleAutoUpdate = () => {
      const workspaceId = kb.get().selected
      if (!workspaceId) { kb.set({ error: t('请先选择一个工作区') }); return }
      const nextEnabled = !kb.get().autoUpdate.enabled
      call('openwiki/autoupdate/set', { workspaceId, enabled: nextEnabled })
        .then((res) => {
          if (res && res.ok === false) kb.set({ error: msg(res.error) })
          else kb.set({ autoUpdate: { enabled: nextEnabled, workspaceId } })
        })
        .catch((err) => kb.set({ error: t('自动更新切换失败：{0}', String(err && err.message ? err.message : err)) }))
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
              ? { installed: false, error: payload.error || t('运行时状态查询失败') }
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
            kb.set({ lastOutput: `${t('错误：')}${msg(res.error)}\n${res.output ?? ''}`, busy: false, action: null })
          } else {
            const out = (res && res.output ? res.output : '') || (res && res.error ? res.error : '')
            // Always leave a visible result so a probe/check that ran clean (no
            // stdout) still gives feedback instead of silently doing nothing.
            kb.set({ lastOutput: out || t('命令执行成功（无输出）。'), busy: false, action: null })
          }
        })
        .catch((err) => kb.set({
          busy: false,
          action: null,
          lastOutput: t('调用失败：{0}', String(err && err.message ? err.message : err)),
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
              ? t('（经 node 子进程写入，绕过工作区沙箱限制）')
              : t('（经 DSH fs 服务写入）')
            kb.set({
              modelOutput: t('同步成功{0}：\n{1}\n写入：{2}', [via, (payload.applied ?? []).join('、'), payload.envPath ?? '~/.openwiki/.env']),
              modelCommand: null,
              busy: false,
            })
          } else {
            kb.set({
              modelOutput: t('同步失败：{0}', payload.error ?? t('未知错误')),
              modelCommand: payload.command ?? null,
              busy: false,
            })
          }
          refreshModel()
        })
        .catch((err) => kb.set({
          busy: false,
          modelOutput: t('同步调用失败：{0}', String(err && err.message ? err.message : err)),
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
          // 默认开启自动更新（0.2.0）：首次拉取工作区后同步状态显示。
          fetchAutoUpdate()
        })
        .catch(() => {})
    }

    const selectWorkspace = (id) => {
      kb.set({ selected: id, tree: null, page: null, overview: null, claims: null, tabs: [], activeTab: null, browseDir: null, error: null, showIgnore: false, kbFiles: null, kbTree: null, kbPage: null, kbConfig: null, kbOverview: null, kbNotice: null })
      if (!id) return
      // 工作区级自动更新状态：切换工作区时按当前工作区刷新开关显示。
      fetchAutoUpdate(id)
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
      if (s.tab === 'kb') refreshKb(workspaceId)
      if (s.showIgnore) loadIgnore(workspaceId)
    }

    // ------------------------------------------------------------------
    // 知识库（personal 模式）动作：来源管理 / 文件导入 / 生成 / 阅读
    // ------------------------------------------------------------------
    const refreshKb = (id) => {
      const workspaceId = id || kb.get().selected
      if (!workspaceId) return
      call('openwiki/kb/config', { workspaceId })
        .then((res) => { if (res && res.ok) kb.set({ kbConfig: res }) })
        .catch(() => {})
      call('openwiki/kb/files', { workspaceId })
        .then((res) => { if (res && res.ok) kb.set({ kbFiles: res }) })
        .catch(() => {})
      call('openwiki/kb/tree', { workspaceId })
        .then((res) => {
          if (res && res.ok && Array.isArray(res.pages)) {
            const expanded = { ...(kb.get().expandedDirs || {}) }
            expandAllDirs(buildTree(res.pages), expanded)
            kb.set({ kbTree: res, expandedDirs: expanded })
          } else {
            kb.set({ kbTree: res })
          }
        })
        .catch(() => {})
      call('openwiki/kb/overview', { workspaceId })
        .then((res) => { if (res && res.ok) kb.set({ kbOverview: res }) })
        .catch(() => {})
    }

    // 导入本地文件（本地文件来源）→ openwiki-kb/source/files。
    const importKbFiles = (fileList) => {
      const workspaceId = kb.get().selected
      if (!workspaceId || !fileList || fileList.length === 0) return
      kb.set({ importing: true, error: null, kbNotice: null })
      const tasks = Array.from(fileList).map((file) =>
        file.arrayBuffer().then((buf) => {
          const bytes = new Uint8Array(buf)
          let binary = ''
          for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i])
          return { name: file.name, data: btoa(binary) }
        }))
      Promise.all(tasks)
        .then((files) => call('openwiki/kb/import', { workspaceId, files }))
        .then((res) => {
          const failed = (res && Array.isArray(res.failed) && res.failed.length > 0) ? res.failed : []
          kb.set({
            importing: false,
            error: failed.length > 0
              ? t('部分文件导入失败：{0}', failed.map((f) => `${f.name}（${msg(f.error)}）`).join('；'))
              : null,
          })
          refreshKb(workspaceId)
        })
        .catch((err) => kb.set({ importing: false, error: t('导入失败：{0}', String(err && err.message ? err.message : err)) }))
    }

    const deleteKbFile = (path) => {
      const workspaceId = kb.get().selected
      call('openwiki/kb/delete', { workspaceId, path })
        .then((res) => {
          if (res && res.ok === false) kb.set({ error: msg(res.error) })
          refreshKb(workspaceId)
        })
        .catch((err) => kb.set({ error: t('删除失败：{0}', String(err && err.message ? err.message : err)) }))
    }

    // 生成知识库：openwiki personal --update（读取 source/files 下的本地文件）。
    const startKbJob = () => {
      const workspaceId = kb.get().selected
      const raw = kb.get().language
      const normalized = normalizeLanguage(raw)
      if (normalized.error) {
        kb.set({ error: t('文档语言设置无效：{0}', normalized.error) })
        return
      }
      const language = normalized.code || 'zh'
      const model = String(kb.get().genModel || '').trim() || undefined
      const prompt = (kb.get().kbConfig && kb.get().kbConfig.prompt) || undefined
      kb.set({ error: null, kbNotice: null })
      call('openwiki/job/start', { workspaceId, kind: 'personal', mode: 'update', language, model, message: prompt })
        .then((res) => {
          if (res && res.ok === false) kb.set({ error: msg(res.error) })
          refreshJobs()
        })
        .catch((err) => kb.set({ error: t('任务启动失败：{0}', String(err && err.message ? err.message : err)) }))
    }

    // 阅读知识库页面（独立于 wiki 文档 tabs，避免混用）。
    const openKbPage = (path) => {
      const workspaceId = kb.get().selected
      if (!workspaceId) return
      const norm = String(path)
      kb.set({ kbPage: { loading: true, path: norm }, browseDir: null })
      call('openwiki/kb/page', { workspaceId, path: norm })
        .then((res) => kb.set({ kbPage: res }))
        .catch((err) => kb.set({ kbPage: { ok: false, error: String(err && err.message ? err.message : err) } }))
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
          kb.set({ error: res && res.ok ? null : ((res && res.error) ? msg(res.error) : t('保存失败')) })
          if (res && res.ok) kb.set({ showIgnore: false })
        })
        .catch((err) => kb.set({ error: t('保存失败：{0}', String(err && err.message ? err.message : err)) }))
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
      return { code: null, error: t('无法识别的语言 "{0}"：openwiki 使用 BCP-47 语言代码（如 zh / en / zh-CN），或常见语言名（如 English、中文）', input) }
    }

    const startJob = (mode) => {
      const workspaceId = kb.get().selected
      const overview = kb.get().overview
      const raw = kb.get().language
      const normalized = normalizeLanguage(raw)
      if (normalized.error) {
        kb.set({ error: t('文档语言设置无效：{0}', normalized.error) })
        return
      }
      const language = normalized.code || ((overview && overview.lastUpdate && overview.lastUpdate.language) || 'zh')
      const model = String(kb.get().genModel || '').trim() || undefined
      kb.set({ error: null })
      call('openwiki/job/start', { workspaceId, mode, language, model })
        .then((res) => {
          if (res && res.ok === false) {
            kb.set({ error: msg(res.error) })
          } else if (res && res.resumed) {
            const rmode = res.resumedMode === 'update' ? t('增量更新') : t('初始化')
            kb.set({ error: null, notice: t('检测到之前未完成的生成任务（已保存断点），openwiki 将从断点继续（{0} · 语言 {1}{2}）', [rmode, res.resumedLanguage || language, model ? t('、模型 {0}', model) : '']) })
          }
          refreshJobs()
        })
        .catch((err) => kb.set({ error: t('任务启动失败：{0}', String(err && err.message ? err.message : err)) }))
    }

    const pauseJob = () => {
      const workspaceId = kb.get().selected
      call('openwiki/job/pause', { workspaceId })
        .then((res) => {
          if (res && res.ok === false) kb.set({ error: msg(res.error) })
          refreshJobs()
        })
        .catch((err) => kb.set({ error: t('暂停失败：{0}', String(err && err.message ? err.message : err)) }))
    }

    const resumeJob = () => {
      const workspaceId = kb.get().selected
      kb.set({ error: null })
      call('openwiki/job/resume', { workspaceId })
        .then((res) => {
          if (res && res.ok === false) kb.set({ error: msg(res.error) })
          refreshJobs()
        })
        .catch((err) => kb.set({ error: t('继续失败：{0}', String(err && err.message ? err.message : err)) }))
    }

    const killJob = () => {
      const workspaceId = kb.get().selected
      call('openwiki/job/kill', { workspaceId })
        .then((res) => {
          if (res && res.abandoned) kb.set({ error: t('已放弃暂停中的任务（openwiki 的 .run.json 保留，下次生成会从断点恢复；如需全新生成请先完成该次任务）') })
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
          kb.set({ error: t('生成失败：{0}', errJob.message || errJob.phase || t('未知错误')) })
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
      const tagText = paused ? t('已暂停') : (pausing ? t('暂停中…') : (job.phase === 'cancelled' ? t('已取消') : job.phase))
      // 布局：第一行 = 状态标签 + 文案（可换行）；第二行 = 操作按钮，始终
      // 独立成行且不被长文案挤压（原先按钮与文案同行会被 Flex-wrap 挤走）。
      const buttons = paused
        ? [
            React.createElement('button', {
              key: 'resume',
              type: 'button',
              className: 'owk-btn owk-btn-primary',
              onClick: () => resumeJob(),
            }, t('继续')),
            React.createElement('button', {
              key: 'abandon',
              type: 'button',
              className: 'owk-btn',
              onClick: () => killJob(),
            }, t('放弃')),
          ]
        : [
            React.createElement('button', {
              key: 'pause',
              type: 'button',
              className: 'owk-btn',
              disabled: pausing,
              onClick: () => pauseJob(),
            }, pausing ? t('暂停中…') : t('暂停')),
            React.createElement('button', {
              key: 'cancel',
              type: 'button',
              className: 'owk-btn',
              disabled: pausing,
              onClick: () => killJob(),
            }, t('取消')),
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
            React.createElement('span', { style: { fontWeight: 600 } }, dir ? t('目录：{0}', dir) : t('根目录')),
            React.createElement('span', { className: 'owk-overlay-spacer' }),
            React.createElement('button', {
              type: 'button',
              className: 'owk-btn',
              onClick: () => kb.set({ browseDir: null }),
            }, t('返回'))),
          files.length === 0
            ? React.createElement('div', { className: 'owk-empty' }, t('该目录下暂无文档'))
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
      if (page === null) return React.createElement('div', { className: 'owk-empty' }, t('Wiki 将在生成完成后显示在这里'))
      if (page.loading) return React.createElement('div', { className: 'owk-empty' }, t('渲染中...'))
      if (page.ok === false) return React.createElement('div', { className: 'owk-empty' }, msg(page.error) || t('Repo Wiki 生成失败，请重试。'))
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
          ? React.createElement('div', { className: 'owk-muted', style: { padding: '8px 12px' } }, t('本文档无二级及以上标题'))
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
        }, t('目录')),
        React.createElement('button', {
          type: 'button',
          className: `owk-btn${snap.docView === 'preview' ? ' owk-btn-primary' : ''}`,
          onClick: () => kb.set({ docView: 'preview', tocOpen: false }),
        }, t('预览')),
        React.createElement('button', {
          type: 'button',
          className: `owk-btn${snap.docView === 'code' ? ' owk-btn-primary' : ''}`,
          onClick: () => kb.set({ docView: 'code', tocOpen: false }),
        }, t('代码')),
        React.createElement('span', { className: 'owk-overlay-spacer' }),
        React.createElement('span', { className: 'owk-muted' },
          sources.length > 0 ? t('章节来源：{0}', sources.join('，')) : ''),
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

    // ------------------------------------------------------------------
    // 知识库（personal 模式）面板：左栏（来源/文件/树）与右栏（状态/阅读）
    // ------------------------------------------------------------------
    const fmtSize = (bytes) => {
      if (bytes === null || bytes === undefined) return ''
      if (bytes < 1024) return `${bytes}B`
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
      return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
    }

    // 知识库左栏：本地文件上传 + 知识库树（仅保留本地文件来源）。
    const renderKbLeft = (snap) => {
      const kbFiles = (snap.kbFiles && snap.kbFiles.ok) ? snap.kbFiles.files : []
      const kbTree = snap.kbTree
      const cfg = snap.kbConfig

      const fileInput = React.createElement('input', {
        type: 'file', multiple: true, style: { display: 'none' },
        onChange: (e) => {
          const fl = e.target.files
          if (fl && fl.length > 0) importKbFiles(fl)
          e.target.value = ''
        },
      })

      const fileList = React.createElement('div', { className: 'owk-card', style: { marginBottom: 8 } },
        React.createElement('div', { className: 'owk-row' },
          React.createElement('span', { style: { fontWeight: 600 } }, t('本地文件')),
          React.createElement('span', { className: 'owk-overlay-spacer' }),
          React.createElement('label', { className: 'owk-btn', style: { display: 'inline-block', cursor: 'pointer', marginBottom: 0 }, title: t('支持文本格式（.md / .txt / .csv / .json 等）；PDF / DOCX 等二进制请先转为文本再上传') },
            snap.importing ? t('导入中…') : t('📁 上传文件'),
            fileInput)),
        // 文件类型提示：openwiki 的 agent 读取为纯文本（无类型显示/转换机制，
        // src/agent/docs-only-backend.js read → fs.readFile utf8）。
        React.createElement('div', { className: 'owk-muted', style: { marginTop: 4 } },
          t('支持文本格式（.md / .txt / .csv / .json 等）；PDF / DOCX 等请先转为文本再上传。')),
        cfg ? React.createElement('div', { className: 'owk-muted', style: { marginTop: 2 } }, t('保存至 {0}/', cfg.sourceRel)) : null,
        kbFiles.length === 0
          ? React.createElement('div', { className: 'owk-muted', style: { marginTop: 4 } }, t('暂无文件。上传后点击「生成知识库」。'))
          : kbFiles.map((f) =>
              React.createElement('div', { key: f.path, className: 'owk-row', style: { justifyContent: 'space-between', marginTop: 2 } },
                React.createElement('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
                  `📄 ${f.path}${f.size != null ? `（${fmtSize(f.size)}）` : ''}`),
                React.createElement('button', {
                  type: 'button', className: 'owk-btn', style: { padding: '1px 6px' },
                  onClick: () => deleteKbFile(f.path),
                }, t('删除')))),
      )

      const kbTreeView = React.createElement('div', null,
        kbTree === null
          ? React.createElement('div', { className: 'owk-muted' }, t('加载中…'))
          : kbTree.ok === false
            ? React.createElement('div', { className: 'owk-muted' }, kbTree.error)
            : React.createElement('div', null,
                renderTree(buildTree(kbTree.pages), 0, openKbPage, null, snap.expandedDirs),
                kbTree.pages.length === 0
                  ? React.createElement('div', { className: 'owk-empty', style: { padding: '12px 0' } },
                      t('尚未生成知识库，点击右上「生成知识库」'))
                  : null),
      )

      return React.createElement('div', null, fileList, kbTreeView)
    }

    const renderKb = (snap, workspaces) => {
      const sel = snap.selected
      // A paused job still occupies the workspace (resume continues it), so it
      // blocks starting a new run and shows the 暂停/继续 progress card.
      // 知识库 Tab 只关注 personal 任务；wiki/cards Tab 只关注 code 任务。
      const isKb = snap.tab === 'kb'
      const job = snap.jobs.find((j) => j.workspaceId === sel && (j.status === 'running' || j.status === 'paused') && (isKb ? j.kind === 'personal' : j.kind !== 'personal'))
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
      // Three persistent mode buttons (Open Wiki / 知识卡片 / 知识库) with selected state.
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
        }, t('知识卡片')),
        React.createElement('button', {
          type: 'button',
          className: `owk-tab${snap.tab === 'kb' ? ' sel' : ''}`,
          onClick: () => { kb.set({ tab: 'kb', showIgnore: false }); refreshKb() },
        }, t('知识库')),
      )

      const leftContent = snap.showIgnore
        ? React.createElement('div', null,
            React.createElement('div', { className: 'owk-muted', style: { marginBottom: 4 } }, t('.openwikiignore（gitignore 语法）')),
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
              }, t('保存')),
              React.createElement('button', {
                type: 'button',
                className: 'owk-btn',
                onClick: () => kb.set({ showIgnore: false }),
              }, t('取消'))))
        : (snap.tab === 'kb'
            ? renderKbLeft(snap)
            : (snap.tab === 'wiki'
            ? (tree === null
                ? React.createElement('div', { className: 'owk-muted' }, t('加载中…'))
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
                            t('尚未生成 Wiki，点击右上「生成」'))
                        : null))
            : (claims === null
                ? React.createElement('div', { className: 'owk-muted' }, t('加载中…'))
                : React.createElement('div', null,
                    (claims.claims || []).map((c) =>
                      React.createElement('div', { key: c.id, className: 'owk-claim' },
                        React.createElement('div', null, c.statement),
                        React.createElement('div', { className: 'owk-muted' },
                          t('{0} 条证据{1}', [c.evidenceCount, c.firstEvidence ? ` · ${c.firstEvidence}` : '']))))))))

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
            placeholder: t('🔍 搜索 Open Wiki'),
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
            }, t('忽略文件')),
            React.createElement('button', {
              type: 'button',
              className: 'owk-btn',
              onClick: () => {
                // Refresh reloads the workspace list too (workspaces may have
                // been added since the last open).
                fetchWorkspaces()
                if (sel) refreshWorkspace(sel)
              },
            }, t('刷新')),
            // 自动更新只作用于 Open Wiki（code 模式 git HEAD 轮询）：仅在该 Tab 显示，
            // 知识卡片 / 知识库不涉及自动更新。
            snap.tab === 'wiki'
              ? React.createElement('button', {
                  type: 'button',
                  className: `owk-btn${snap.autoUpdate.enabled ? ' owk-btn-primary' : ''}`,
                  title: snap.autoUpdate.enabled ? t('已开启自动更新（当前工作区）：每 15 秒轮询 git HEAD，检测到新提交自动增量更新 Open Wiki') : t('开启自动更新（当前工作区）：每 15 秒轮询 git HEAD，检测到新提交自动增量更新 Open Wiki'),
                  onClick: toggleAutoUpdate,
                }, snap.autoUpdate.enabled ? t('自动更新 ✔') : t('自动更新'))
              : null,
          ),
          React.createElement('div', { style: { marginTop: 8 } }, leftContent),
        ),
        React.createElement('div', {
          className: 'owk-kb-resizer',
          title: t('拖动调整左栏宽度'),
          onMouseDown: onColResize,
        }),
        React.createElement('div', { className: 'owk-kb-right' },
          isKb
            ? renderKbRight(snap, job, isRunning)
            : React.createElement('div', null,
          overview && overview.ok && (overview.wikiExists || overview.runActive)
            ? React.createElement('div', { className: 'owk-card' },
                // Wiki generation status (counts / time / location / regen).
                React.createElement('div', { className: 'owk-row' },
                  React.createElement('span', { style: { fontWeight: 600 } }, t('Open Wiki 状态')),
                  React.createElement('span', { className: 'owk-overlay-spacer' }),
                  overview.runActive
                    ? React.createElement('span', { className: 'owk-tag owk-tag-run' }, t('生成中'))
                    : React.createElement('span', { className: 'owk-tag owk-tag-ok' }, t('已生成'))),
                React.createElement('div', { className: 'owk-row' },
                  React.createElement('span', { className: 'owk-muted' }, t('文件数：')),
                  React.createElement('span', null, overview.pageCount ?? 0),
                  React.createElement('span', { className: 'owk-muted', style: { marginLeft: 12 } }, t('成功：')),
                  React.createElement('span', null, overview.successCount ?? overview.pageCount ?? 0),
                  React.createElement('span', { className: 'owk-muted', style: { marginLeft: 12 } }, t('失败：')),
                  React.createElement('span', null, overview.failedCount ?? 0),
                ),
                overview.lastUpdate
                  ? React.createElement('div', { className: 'owk-muted' },
                      t('更新时间：{0} · {1} · {2} · 模型 {3}', [String(overview.lastUpdate.updatedAt || '').slice(0, 16).replace('T', ' '), overview.lastUpdate.language, overview.lastUpdate.status, overview.lastUpdate.model || '—']))
                  : null,
                overview.wikiDirRelative
                  ? React.createElement('div', { className: 'owk-muted' }, t('文档位置：项目根目录/{0}', overview.wikiDirRelative))
                  : null,
                React.createElement('div', { className: 'owk-row', style: { marginTop: 8 } },
                  React.createElement('button', {
                    type: 'button',
                    className: 'owk-btn owk-btn-primary',
                    disabled: isRunning,
                    title: t('根据仓库新增/修改的原始并更新 wiki 文档（任务进行/暂停时由任务卡控制）'),
                    onClick: () => startJob('update'),
                  }, t('重新生成')),
                ),
              )
            : React.createElement('div', { className: 'owk-card' },
                React.createElement('div', { className: 'owk-row' },
                  React.createElement('span', null, t('生成你的 Open Wiki')),
                  React.createElement('span', { className: 'owk-overlay-spacer' }),
                  React.createElement('button', {
                    type: 'button',
                    className: 'owk-btn owk-btn-primary',
                    disabled: isRunning,
                    onClick: () => startJob('init'),
                  }, t('生成')),
                ),
                React.createElement('div', { className: 'owk-muted', style: { marginTop: 6 } },
                  t('Open Wiki（为您准备）和知识卡片（为 Agent 准备）将基于您的代码库一起生成和更新。')),
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
                snap.tabs.map((tab) =>
                  React.createElement('span', { key: tab.path, style: { display: 'inline-flex', alignItems: 'center', gap: 4 } },
                    React.createElement('button', {
                      type: 'button',
                      className: `owk-btn${snap.activeTab === tab.path ? ' owk-btn-primary' : ''}`,
                      onClick: () => openPage(tab.path),
                    }, tab.title),
                    React.createElement('button', {
                      type: 'button',
                      className: 'owk-btn',
                      style: { padding: '1px 6px' },
                      title: t('关闭'),
                      onClick: () => closeTab(tab.path),
                    }, '✕'))))
            : null,
          renderDoc(snap),
          ),
        ),
      )
    }

    // 知识库右栏：personal 状态卡 + 生成按钮 + 任务卡 + 页面阅读。
    const renderKbRight = (snap, job, isRunning) => {
      const cfg = snap.kbConfig
      const kbTree = snap.kbTree
      const kbOverview = snap.kbOverview
      const pageCount = (kbTree && kbTree.ok && Array.isArray(kbTree.pages)) ? kbTree.pages.length : 0
      const fileCount = (snap.kbFiles && snap.kbFiles.ok && Array.isArray(snap.kbFiles.files)) ? snap.kbFiles.files.length : 0
      const lastUpdate = kbOverview && kbOverview.ok ? kbOverview.lastUpdate : null
      const kbPage = snap.kbPage

      const statusCard = React.createElement('div', { className: 'owk-card' },
        React.createElement('div', { className: 'owk-row' },
          React.createElement('span', { style: { fontWeight: 600 } }, t('知识库状态')),
          React.createElement('span', { className: 'owk-overlay-spacer' }),
          job
            ? React.createElement('span', { className: 'owk-tag owk-tag-run' }, t('生成中'))
            : pageCount > 0
              ? React.createElement('span', { className: 'owk-tag owk-tag-ok' }, t('已生成'))
              : React.createElement('span', { className: 'owk-tag owk-tag-warn' }, t('未生成'))),
        React.createElement('div', { className: 'owk-row', style: { marginTop: 4 } },
          React.createElement('span', { className: 'owk-muted' }, t('页面：')),
          React.createElement('span', null, pageCount),
          React.createElement('span', { className: 'owk-muted', style: { marginLeft: 12 } }, t('文件：')),
          React.createElement('span', null, fileCount),
        ),
        lastUpdate
          ? React.createElement('div', { className: 'owk-muted', style: { marginTop: 4, whiteSpace: 'normal', wordBreak: 'break-all' } },
              t('更新时间：{0} · {1} · {2} · 模型 {3}', [String(lastUpdate.updatedAt || '').slice(0, 16).replace('T', ' '), lastUpdate.language || '—', lastUpdate.status || '—', lastUpdate.model || '—']))
          : null,
        cfg
          ? React.createElement('div', { className: 'owk-muted', style: { marginTop: 4 } },
              t('输出位置：{0}', cfg.wikiDir || '—'))
          : null,
        React.createElement('div', { className: 'owk-row', style: { marginTop: 8 } },
          React.createElement('button', {
            type: 'button',
            className: 'owk-btn owk-btn-primary',
            disabled: isRunning,
            title: t('用 openwiki personal 模式分析来源并生成/更新知识库（任务进行/暂停时由任务卡控制）'),
            onClick: () => startKbJob(),
          }, t('生成知识库')),
        ),
        React.createElement('div', { className: 'owk-muted', style: { marginTop: 6, lineHeight: 1.5 } },
          React.createElement('div', null,
            t('生成逻辑：每次点击会执行完整分析——AI 读取「上传的本地文件」与「现有知识库」，在保留未变化页面的前提下增量生成/更新知识库页面；内容无变化时不重复记录更新时间。每次生成均消耗模型额度。')),
          React.createElement('div', { style: { marginTop: 4 } },
            t('• 新增文件：上传后点击「生成知识库」，AI 会将其整理进知识库（新增或并入对应来源/主题页面）。')),
          React.createElement('div', { style: { marginTop: 2 } },
            t('• 删除文件：已删除的上传文件，知识库中对应的旧内容暂不会自动清除；如需完全重来，可删除 openwiki-kb/wiki/ 下内容后重新生成。')),
          React.createElement('div', { style: { marginTop: 2 } },
            t('• 与 Open Wiki（代码库）和知识卡片相互独立。')),
        ),
      )

      const kbDoc = kbPage === null
        ? React.createElement('div', { className: 'owk-empty', style: { padding: '24px 0' } },
            t('从左侧知识库树选择页面阅读'))
        : kbPage.loading
          ? React.createElement('div', { className: 'owk-muted' }, t('加载中…'))
          : kbPage.ok === false
            ? React.createElement('div', { className: 'owk-muted' }, msg(kbPage.error) || t('页面不存在'))
            : React.createElement('div', null,
                React.createElement('div', { className: 'owk-row', style: { borderBottom: '1px solid var(--dsw-border, #333)', paddingBottom: 6 } },
                  React.createElement('span', { className: 'owk-icon' }, '📄'),
                  React.createElement('span', { style: { fontWeight: 600 } }, kbPage.path || ''),
                ),
                React.createElement('div', { className: 'owk-doc', style: { marginTop: 8 } }, renderMarkdown(kbPage.content || '')),
              )

      return React.createElement('div', null,
        statusCard,
        snap.kbNotice
          ? React.createElement('div', { className: 'owk-row owk-muted', style: { color: '#27ae60', whiteSpace: 'pre-wrap' } }, snap.kbNotice)
          : null,
        renderProgress(job),
        kbDoc,
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
          React.createElement('span', null, t('openwiki 知识库')),
          React.createElement('span', { className: 'owk-overlay-spacer' }),
          React.createElement('button', {
            type: 'button',
            className: 'owk-btn',
            onClick: () => kb.set({ open: true }),
          }, t('弹窗')),
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
      if (!d.connected) return { ok: false, error: t('未检测到 dsh-better-sidebar 插件。请先安装并启用该插件，然后刷新页面。') }
      if (kb.get().sidebarRegistered) return { ok: true, error: null, already: true }
      try {
        const dispose = d.service.registerTab({
          id: 'openwiki',
          title: () => t('openwiki知识库'),
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
        return { ok: false, error: t('注册失败：{0}', String(err && err.message ? err.message : err)) }
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
      { name: 'sidebar.footer.action', id: 'openwiki', order: 10, label: () => t('openwiki知识库') },
      (props) => {
        const snap = useKb()
        const r = snap.runtime
        // "是否展示 openwiki 知识库入口" switch: hide the footer entry entirely
        // when the user turns it off.
        if (!snap.showEntry) return null
        return React.createElement('button', {
          type: 'button',
          className: 'owk-entry',
          title: t('openwiki 知识库'),
          onClick: () => {
            if (!snap.runtime) refreshRuntime()
            kb.set({ open: true })
          },
        },
          React.createElement('span', { className: 'owk-icon' }, '📚'),
          props.wide
            ? React.createElement('span', null,
                t('openwiki知识库'),
                React.createElement('span', { className: 'owk-muted', style: { marginLeft: 6 } },
                  r ? (r.installed ? `v${r.version ?? '?'}` : t('未安装')) : '')) : null,
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
            React.createElement('span', { className: 'owk-overlay-title' }, t('openwiki 知识库')),
            React.createElement('button', {
              type: 'button',
              className: 'owk-btn',
              style: { marginLeft: 8 },
              title: t('最大化/还原'),
              onClick: () => kb.set({ win: { ...kb.get().win, max: !win.max } }),
            }, win.max ? '▣' : '□'),
            React.createElement('span', { className: 'owk-overlay-spacer' }),
            React.createElement('span', { className: 'owk-muted' },
              r
                ? (r.installed
                    ? t('运行时 v{0}{1}', [r.version ?? '?', r.hasUpdate ? t('（可升级到 v{0}）', r.latestVersion) : ''])
                    : t('运行时未安装'))
                : t('运行时状态未知')),
            React.createElement('button', {
              type: 'button',
              className: 'owk-btn',
              style: { marginLeft: 8 },
              onClick: () => kb.set({ open: false }),
            }, t('关闭')),
          ),
          React.createElement('div', { className: 'owk-body', style: { display: 'flex', flexDirection: 'column', padding: 0 } },
            renderKb(snap, wsList),
          ),
          !win.max
            ? React.createElement('div', {
                className: 'owk-win-resize',
                onMouseDown: onResizeStart,
                title: t('拖动缩放'),
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
        // Document content language mapped onto the static LANGS option list
        // (older free-text values outside the list render as the zh default).
        const docLang = LANGS.some((l) => l.code === snap.language) ? snap.language : 'zh'
        return React.createElement('div', { style: { padding: '4px 2px' } },
          // 界面语言（第一行）：控制插件界面显示语言；与「文档内容语言」共用
          // LANGS 选项（默认 zh），选择即时生效并持久化到 localStorage。
          React.createElement('div', { className: 'owk-card' },
            React.createElement('div', { className: 'owk-row' },
              React.createElement('span', { style: { fontWeight: 600 } }, t('界面语言')),
              React.createElement('span', { className: 'owk-overlay-spacer' }),
              React.createElement('select', {
                className: 'owk-select',
                value: snap.uiLang,
                onChange: (e) => {
                  const code = e.target.value
                  kb.set({ uiLang: code })
                  try { window.localStorage.setItem('dsh-openwiki:uiLang', code) } catch { /* noop */ }
                },
              }, LANGS.map((l) =>
                React.createElement('option', { key: l.code, value: l.code }, `${l.label} (${l.code})`))),
            ),
            React.createElement('div', { className: 'owk-muted', style: { marginTop: 6 } },
              t('界面显示语言：完整支持 中文 / English / 日本語 / 한국어，其余语言界面自动回退为 English；文档生成语言请在下方「文档内容语言」中单独设置。')),
          ),
          React.createElement('div', { className: 'owk-card' },
            React.createElement('div', { className: 'owk-row' },
              React.createElement('span', { style: { fontWeight: 600 } }, t('运行时')),
              React.createElement('span', { className: 'owk-overlay-spacer' }),
              React.createElement('button', {
                type: 'button',
                className: 'owk-btn',
                disabled: snap.busy,
                onClick: refreshRuntime,
              }, t('刷新')),
            ),
            r === null
              ? React.createElement('div', { className: 'owk-muted' }, snap.busy ? t('检测中…') : t('未检测（点刷新）'))
              : React.createElement('div', null,
                  React.createElement('div', { className: 'owk-row' },
                    React.createElement('span', { className: `owk-dot ${r.installed ? 'owk-dot-ok' : 'owk-dot-err'}` }),
                    React.createElement('span', null, r.installed ? t('已安装') : t('未安装')),
                    r.error && !r.installed ? React.createElement('span', { className: 'owk-muted' }, `（${msg(r.error)}）`) : null,
                  ),
                  React.createElement('div', { className: 'owk-row' },
                    React.createElement('span', null, t('版本：')),
                    React.createElement('span', null, r.version ?? '—'),
                    r.hasUpdate
                      ? React.createElement('span', { className: 'owk-tag owk-tag-warn' }, t('有新版本 v{0}', r.latestVersion))
                      : React.createElement('span', { className: 'owk-tag owk-tag-ok' }, t('最新')),
                  ),
                  React.createElement('div', { className: 'owk-row' },
                    React.createElement('span', null, t('可执行：')),
                    React.createElement('span', { className: 'owk-muted' }, r.exePath ?? '—'),
                  ),
                  React.createElement('div', { className: 'owk-row' },
                    React.createElement('span', null, t('脚本：')),
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
                  }, t('安装 openwiki 运行时'))
                : React.createElement('button', {
                    type: 'button',
                    className: 'owk-btn',
                    disabled: snap.busy || !r.hasUpdate,
                    onClick: () => runAction('openwiki/runtime/update', 'updating', {}),
                  }, r.hasUpdate ? t('升级到 v{0}', r.latestVersion) : t('已是最新版本')),
              React.createElement('button', {
                type: 'button',
                className: 'owk-btn',
                disabled: snap.busy || !r || !r.installed,
                onClick: () => runAction('openwiki/runtime/probe', 'probing', {}),
              }, t('自检（openwiki --help）')),
            ),
            snap.action
              ? React.createElement('div', { className: 'owk-row owk-muted' },
                  snap.action === 'installing' ? t('正在安装（npm install -g openwiki）…') : snap.action === 'updating' ? t('正在升级…') : t('正在自检…'))
              : null,
            snap.lastOutput
              ? React.createElement('div', { className: 'owk-pre' }, snap.lastOutput)
              : null,
          ),
          React.createElement('div', { className: 'owk-card' },
            React.createElement('div', { className: 'owk-row' },
              React.createElement('span', { style: { fontWeight: 600 } }, t('模型（DSH 复用 → openwiki）')),
              React.createElement('span', { className: 'owk-overlay-spacer' }),
              React.createElement('button', {
                type: 'button',
                className: 'owk-btn',
                disabled: snap.busy,
                onClick: refreshModel,
              }, t('刷新')),
            ),
            m === null
              ? React.createElement('div', { className: 'owk-muted' }, snap.busy ? t('读取中…') : t('未读取（点刷新）'))
              : React.createElement('div', null,
                  React.createElement('div', { className: 'owk-row' },
                    React.createElement('span', null, t('DSH 默认模型：')),
                    React.createElement('span', null,
                      m.selection ? `${m.selection.provider} / ${m.selection.model}` : '—'),
                  ),
                  React.createElement('div', { className: 'owk-row' },
                    React.createElement('span', null, t('映射到 openwiki：')),
                    m.owProvider
                      ? React.createElement('span', { className: 'owk-tag owk-tag-ok' }, m.owProvider)
                      : React.createElement('span', { className: 'owk-tag owk-tag-warn' }, t('无法自动映射')),
                    m.keyConfigured
                      ? React.createElement('span', { className: 'owk-tag owk-tag-ok' }, t('Key 已解析'))
                      : React.createElement('span', { className: 'owk-tag owk-tag-warn' }, t('Key 未解析')),
                  ),
                  m.warnings && m.warnings.length > 0
                    ? React.createElement('div', { className: 'owk-row owk-muted' }, msg(m.warnings[0]))
                    : null,
                  React.createElement('div', { className: 'owk-row' },
                    React.createElement('span', null, t('凭证引用：')),
                    React.createElement('span', { className: 'owk-muted' }, m.apiKeyEnv ?? '—'),
                    m.keySource ? React.createElement('span', { className: 'owk-muted' }, t('来源：{0}', m.keySource)) : null,
                  ),
                  React.createElement('div', { className: 'owk-row' },
                    React.createElement('span', null, t('~/.openwiki/.env：')),
                    m.envExists
                      ? React.createElement('span', { className: 'owk-tag owk-tag-ok' }, t('已存在（provider={0}，model={1}）', [m.envProvider ?? '?', m.envModel ?? '?']))
                      : React.createElement('span', { className: 'owk-tag owk-tag-warn' }, t('不存在')),
                  ),
                  // 同步 + 可选生成模型（--modelId，留空跟随 DSH 模型）。
                  React.createElement('div', { className: 'owk-row', style: { marginTop: 8 } },
                    React.createElement('button', {
                      type: 'button',
                      className: 'owk-btn owk-btn-primary',
                      disabled: snap.busy || !m.keyConfigured,
                      onClick: syncModel,
                    }, t('同步到 openwiki (.env)')),
                    React.createElement('button', {
                      type: 'button',
                      className: 'owk-btn',
                      onClick: () => {
                        const v = String(kb.get().genModel || '').trim()
                        if (v && !/^[A-Za-z0-9][A-Za-z0-9._:/@+,-]*$/u.test(v)) {
                          kb.set({ error: t('模型 ID 无效：{0}', v) })
                          return
                        }
                        kb.set({ genModel: v, error: null })
                        try { window.localStorage.setItem('dsh-openwiki:model', v) } catch { /* noop */ }
                      },
                    }, t('保存生成模型')),
                    React.createElement('input', {
                      type: 'text',
                      className: 'owk-select',
                      style: { flex: 1, minWidth: 0, boxSizing: 'border-box' },
                      placeholder: t('生成模型（可选）：留空跟随 DSH 模型，如 deepseek-chat'),
                      value: snap.genModel,
                      onChange: (e) => kb.set({ genModel: e.target.value }),
                    }),
                  ),
                  React.createElement('div', { className: 'owk-muted', style: { marginTop: 4 } },
                    t('openwiki 支持 --modelId 覆盖生成模型：填一个更快的模型（如 deepseek-chat）可显著提升生成速度；留空则跟随 DSH 模型。')),
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
                        }, t('复制命令')),
                        React.createElement('span', { className: 'owk-muted' },
                          t('在终端执行后重新点击同步（命令包含 API Key，请勿泄露）')),
                      )
                    : null,
                  snap.modelCommand
                    ? React.createElement('pre', { className: 'owk-pre', style: { marginTop: 4 } }, snap.modelCommand)
                    : null,
                ),
          ),
          React.createElement('div', { className: 'owk-card' },
            React.createElement('div', { className: 'owk-row' },
              React.createElement('span', { style: { fontWeight: 600 } }, t('文档内容语言')),
            ),
            React.createElement('div', { className: 'owk-row', style: { marginTop: 6 } },
              React.createElement('select', {
                className: 'owk-select',
                style: { flex: 1, minWidth: 0, boxSizing: 'border-box' },
                value: docLang,
                onChange: (e) => kb.set({ language: e.target.value }),
              }, LANGS.map((l) =>
                React.createElement('option', { key: l.code, value: l.code }, `${l.label} (${l.code})`))),
              React.createElement('button', {
                type: 'button',
                className: 'owk-btn owk-btn-primary',
                onClick: () => {
                  const code = LANGS.some((l) => l.code === snap.language) ? snap.language : 'zh'
                  kb.set({ language: code, error: null })
                  try { window.localStorage.setItem('dsh-openwiki:language', code) } catch { /* noop */ }
                },
              }, t('保存')),
            ),
            React.createElement('div', { className: 'owk-muted', style: { marginTop: 6 } },
              t('生成 / 重新生成 / 更新文档时传给 openwiki 的 -l/--language（BCP-47）语言代码。')),
            React.createElement('div', { className: 'owk-muted', style: { marginTop: 4 } },
              t('注意：切换语言后「重新生成」会按 openwiki 的语言变更逻辑重写全部文档；下一次运行以设置的文档内容语言为准。')),
          ),
          // 自动更新开关已移至知识库面板左栏「刷新」旁（工作区级，每个工作区独立）。
          React.createElement('div', { className: 'owk-card' },
            React.createElement('div', { className: 'owk-row' },
              React.createElement('span', { style: { fontWeight: 600 } }, t('侧边栏页面插件（dsh-better-sidebar）')),
              React.createElement('span', { className: 'owk-overlay-spacer' }),
              React.createElement('button', {
                type: 'button',
                className: 'owk-btn',
                onClick: refreshSidebar,
              }, t('检测')),
            ),
            React.createElement('div', { className: 'owk-row', style: { marginTop: 6 } },
              snap.sidebar === null
                ? React.createElement('span', { className: 'owk-muted' }, t('检测中…'))
                : snap.sidebar.connected
                  ? React.createElement('span', { className: 'owk-tag owk-tag-ok' }, t('已连接 dsh-better-sidebar'))
                  : React.createElement('span', { className: 'owk-tag owk-tag-warn' }, t('未检测到 dsh-better-sidebar')),
              snap.sidebar && snap.sidebar.connected
                ? React.createElement('span', { className: 'owk-muted' },
                    snap.sidebarRegistered ? t('（openwiki 页面已注册）') : t('（尚未注册）'))
                : null,
            ),
            React.createElement('div', { className: 'owk-row', style: { marginTop: 8 } },
              React.createElement('button', {
                type: 'button',
                className: 'owk-btn owk-btn-primary',
                disabled: !(snap.sidebar && snap.sidebar.connected) || snap.sidebarRegistered,
                onClick: () => {
                  const res = registerSidebarTab()
                  if (!res.ok) kb.set({ error: msg(res.error) })
                },
              }, snap.sidebarRegistered ? t('已注册侧边页') : t('注册侧边页面到 dsh-better-sidebar')),
            ),
            React.createElement('div', { className: 'owk-muted', style: { marginTop: 6 } },
              t('把 openwiki 知识库注册为 dsh-better-sidebar 的一个侧边栏 Tab（新侧边页面），可直接在侧边栏查看。需要先安装并启用 dsh-better-sidebar 插件。')),
            React.createElement('div', { className: 'owk-muted', style: { marginTop: 4 } },
              t('dsh-better-sidebar 地址：https://github.com/omdsh-dev/DSH-better-sidebar（已安装时可从侧边栏文件预览访问）。')),
            !(snap.sidebar && snap.sidebar.connected)
              ? React.createElement('div', { className: 'owk-row', style: { marginTop: 6, color: '#e67e22' } },
                  t('未检测到 dsh-better-sidebar：请先在 DSH 设置/插件中安装并启用该插件，然后刷新页面，再点击「注册侧边页面到 dsh-better-sidebar」。'))
              : null,
          ),
          React.createElement('div', { className: 'owk-card' },
            React.createElement('div', { className: 'owk-row' },
              React.createElement('span', { style: { fontWeight: 600 } }, t('入口显示')),
              React.createElement('span', { className: 'owk-overlay-spacer' }),
              React.createElement('button', {
                type: 'button',
                className: `owk-btn${snap.showEntry ? ' owk-btn-primary' : ''}`,
                onClick: toggleShowEntry,
              }, snap.showEntry ? t('展示知识库入口 ✔') : t('隐藏知识库入口')),
            ),
            React.createElement('div', { className: 'owk-muted', style: { marginTop: 6 } },
              t('控制是否在 DSH 主界面左下角「设置」按钮上方显示「openwiki知识库」入口。默认展示，可关闭。')),
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
