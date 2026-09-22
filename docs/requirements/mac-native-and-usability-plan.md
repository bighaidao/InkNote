# InkNote macOS 原生体验与易用性提升方案

> 阶段：需求对齐稿 v2（未确认，未进入编码）
> 范围：桌面端（重点 macOS），兼顾 Windows/Linux 不退化
> 日期：2026-06（v2：并入用户决策与性能专项）

## v2 变更记录

- **已决策（不做）**：A2 预览标签页（保持"单击文件=固定 tab"现状）、A4 命令面板（暂缓，非否决）、C3 侧栏 Vibrancy 材质、C5 右键菜单原生化。
- **新增**：§5 性能专项设计（用户新要求）；B3 因 C3 取消而不再有冲突，保留为可选增强。
- 路线图随之收缩为：A1 / C1 / C4 → A3 / C2 → B1+B2 →（可选 B3、A3.3）。
- **2026-06 补充（真机反馈）**：多根工作区对齐 VSCode——「打开文件夹…」改为**替换**当前窗口项目；新增「添加文件夹到工作区…」「在新窗口打开文件夹…」菜单项；侧栏项目头视觉分组（根名大写缩小 + 项目间分隔线间距）。

---

## 1. 背景与问题定义

用户反馈两个核心不满：

1. **macOS 原生感不足**：与 Mac 原生软件（Bear、Craft、Xcode、Finder）相比"缺少点什么"。
2. **易用性与 VSCode 有明显差距**：
   - 文件树目录需要**双击**才展开（期望单击展开）；
   - **不能新建窗口打开其他项目**（目前所有项目只能作为根挂在同一个侧栏里）。

### 1.1 XY 问题检查

- "缺少点什么"已拆解为可验收差距项：窗口状态记忆、侧栏顶通布局、菜单完整性、细节动效四类（材质/右键菜单原生化经决策不做）。
- "不能新增窗口"背后有两种诉求：**同时对照两个项目/文档** 或 **项目隔离**。两者都指向多窗口基建，验收标准见 §4-B。

---

## 2. 技术栈与窗口架构现状（代码事实）

| 事实 | 代码依据 |
| --- | --- |
| Tauri 2 + React + Zustand + CodeMirror 6 | `InkNote/src-tauri/Cargo.toml:22`、`InkNote/src/store/useTabsStore.ts` |
| 单一 `main` 窗口；single-instance，二次启动/文件打开都路由回主窗口 | `InkNote/src-tauri/src/lib.rs:1576-1582`、`lib.rs:276-295` |
| Windows/Linux：`decorations: false` 自绘标题栏 + 自绘菜单 | `InkNote/src-tauri/tauri.conf.json:21`、`InkNote/src/components/Titlebar.tsx:198-217` |
| macOS：`titleBarStyle: "Overlay"` + `hiddenTitle`，保留原生交通灯与原生菜单栏 | `InkNote/src-tauri/tauri.macos.conf.json:11-13`、`InkNote/src/lib/nativeMenu.ts:20-161` |
| macOS 标题栏是横贯窗口顶部的独立 header，侧栏从标题栏下方开始（非顶通布局） | `InkNote/src/components/Titlebar.tsx:183-196` |
| 无窗口位置/尺寸记忆（无 window-state 插件） | `InkNote/src-tauri/Cargo.toml`（依赖清单） |
| 多根工作区：多个文件夹作为根挂在同一侧栏 | `InkNote/src/lib/workspace.ts:23-44` |
| 标签页：窗口内多 tab；**无** Ctrl/Cmd+Tab 切换、无中键关闭、无拖拽排序；有"重新打开已关闭标签" | `InkNote/src/store/useTabsStore.ts:41-43`、全局 grep 无 nextTab/prevTab/onAuxClick |
| 文件树：目录行单击=仅选中，双击才展开；文件行单击=打开固定 tab（经决策保持现状） | `InkNote/src/components/FileTree.tsx:856-863`、`FileTree.tsx:916-920` |
| **树展开状态每次变更触发一次全量设置持久化**（structuredClone 整个设置对象 + `save_app_settings` IPC 往返），读取路径每次 JSON.parse | `InkNote/src/lib/settingsStore.ts:61-68,142-150`、`treeState.ts` |
| **文件树递归渲染整棵可见树，无虚拟化**；展开/收起触发整树重渲 | `InkNote/src/components/FileTree.tsx:828-936` |
| 侧栏过滤走全量递归扫描，有 5 秒结果缓存 | `InkNote/src/lib/workspaceSearch.ts:13-14,43-51` |
| 外部文件拖入窗口已支持 | `InkNote/src/App.tsx:1373` |
| 文件关联、Dock/Finder 打开已支持 | `InkNote/src-tauri/tauri.conf.json:38-46`、`lib.rs:1638-1645` |
| 额外窗口先例：visual_preview、PDF 导出已用 `WebviewWindowBuilder` 动态开窗 | `InkNote/src-tauri/src/visual_preview.rs:44`、`lib.rs:573,674` |
| 前端持久化统一走 `settingsStore`（内存 JSON + IPC 落盘 `save_app_settings`，进程内单份，localStorage 仅作一次性迁移来源），**所有窗口共享** | `InkNote/src/lib/settingsStore.ts`、`workspace.ts`、`preferences.ts` |
| 文件监听：Rust 侧 AppState 持单个 watcher + 目录列表（进程级单份） | `InkNote/src-tauri/src/lib.rs:48-54` |
| 原生菜单动作用 `window.dispatchEvent(CustomEvent)` 派发（绑定在创建菜单的 webview） | `InkNote/src/lib/nativeMenu.ts:8-9` |

---

## 3. 参照基准

### 3.1 VSCode（易用性基准，用户点名参照）

- **文件树单击展开目录**：`workbench.tree.expandMode` 默认 `singleClick`（1.54 曾改默认为双击，因用户强烈反对回滚，microsoft/vscode#115873、#117167）。
- **单击文件=固定 tab**：InkNote 现状已与用户期望一致，不改。
- **多窗口**：`File > New Window`；`Open Folder` 可选"在新窗口打开"；每窗口独立工作区与标签集合；macOS 菜单动作作用于当前 key window。
- 标签页：Ctrl/Cmd+Tab 切换、中键关闭、拖拽排序。

### 3.2 macOS HIG（原生感基准）

- 侧栏顶通（sidebar 全高、交通灯悬浮在侧栏内）是 Xcode/Finder/Music/Notes 标准布局。
- Window 菜单应有：最小化、缩放、全部置于前、循环显示窗口（Cmd+`）。
- 系统窗口标签是系统级能力，App 只需设 `tabbingIdentifier`。

### 3.3 Tauri 2 能力核查（已查证一手来源）

| 能力 | 结论 | 依据 |
| --- | --- | --- |
| 窗口状态持久化 | 官方插件 `tauri-plugin-window-state`（v2），一行接入 | v2.tauri.app/plugin/window-state |
| 交通灯位置 | 原生支持 `trafficLightPosition`；已知 bug：生产构建中 AppKit 布局回合会重置位置（wry#1747），社区有成熟补偿模块（在 Resized/Focused/ThemeChanged 事件里重设，需节流） | github.com/tauri-apps/wry/issues/1747 |
| macOS 原生窗口标签 | wry 支持 `tabbingIdentifier`；窗口透明/无装饰时禁用。InkNote macOS 窗口带装饰且不做透明（C3 已否决），可用 | tauri-runtime-wry v0.12.0 release notes |
| 多窗口 | `WebviewWindowBuilder`，项目已有两个先例 | `visual_preview.rs:44` |
| 原生菜单动作跨窗口派发 | **未解决**：JS action 回调绑定在创建菜单的 webview，多窗口时需改 Rust 侧 `on_menu_event` + `emit_to(key window)` | `nativeMenu.ts` 现状 |

---

## 4. 推荐功能清单（v2 收缩后）

成本分级：S（局部小改）/ M（跨模块需回归）/ L（跨模块+状态持久化变更）/ XL（架构级、单向门）。

### A 组：易用性

#### A1. 文件树单击展开目录 【P0 · 成本 S+（含性能配套则 M）】

- **现状**：目录行单击仅选中（`FileTree.tsx:856-859`），双击才 toggle（`FileTree.tsx:860-863`）。
- **推荐**：单击目录行 = 选中 + 展开目录（已展开时单击保持选中不收起；收起仍用箭头或双击）。设置项 `tree.expandMode: singleClick | doubleClick`，默认 `singleClick`。
- **理由**：VSCode 默认行为即单击展开，社区曾因改双击强烈反弹；Obsidian/Finder 同为单击。用户点名的第一痛点。
- **实现要点**：目录行 onClick 调用 `toggle`；`preferences.ts` 加偏好；i18n 补文案。
- **性能配套（必做，见 §5.1）**：
  - `treeState.ts` 写入去抖（300ms）；
  - 展开高频化后评估整树重渲（见 §5.2），超阈值再做子树 memo。
- **风险**：低。
- **验收**：单击未展开目录即展开并选中；设置切回 doubleClick 恢复旧行为；快速连续点击 10 个目录无可感知卡顿（触发条件见 §5.2 阈值）。

#### A3. 标签页操作补全 【P1 · 成本 S→M】

- **推荐**：
  1. Cmd/Ctrl+Tab、Cmd/Ctrl+Shift+Tab 循环切换（macOS 另配 Cmd+Alt+←→）；
  2. 鼠标中键点击 tab 关闭；
  3. tab 拖拽排序（P2，成本最高）。
- **理由**：VSCode 肌肉记忆；tab 体系已存在，缺的只是事件接线。
- **实现要点**：1、2 为快捷键注册（`shortcuts.ts`）+ `DocumentTabs.tsx` 加 `onAuxClick`；3 用 pointer 事件 + transform 位移，**拖动过程不触发 React 重渲**，仅在 drop 时提交 store（见 §5.4）。
- **风险**：低（1、2）；中（3）。
- **验收**：快捷键在编辑器聚焦与失焦两种状态下都生效；中键关闭触发未保存确认；拖拽 50 个 tab 场景流畅。

#### ~~A2 预览标签页~~ / ~~A4 命令面板~~ 【已决策：不做 / 暂缓】

- A2：保持"单击文件=固定 tab"现状。记录理由：预览 tab 是易用性争议项，现状符合用户习惯，砍掉后 A3 与关闭确认逻辑的回归面同步缩小。
- A4：暂缓。将来若做，复用 `QuickOpenDialog` 骨架 + `menus.ts` 动作清单即可，架构无需预留。

### B 组：多窗口（用户点名）

#### B1. 新建窗口（多窗口基建）【P0（用户核心诉求）· 成本 XL】

- **现状**：单 `main` 窗口 + single-instance 路由回主窗口；多项目只能同侧栏挂多根。
- **推荐**：VSCode 式多窗口——
  - `File > New Window`（Cmd/Ctrl+Shift+N）：新开空白窗口（欢迎页）；
  - `Open Folder…` 增加"在新窗口打开"修饰（按住 Alt/Option 或二级按钮）；
  - 文件树根目录右键"在新窗口打开该项目"；
  - 最近项目右键"在新窗口打开"。
- **实现要点（按序）**：
  1. **Rust 开窗**：`WebviewWindowBuilder` 复刻主窗口配置（macOS Overlay/hiddenTitle、尺寸、CSP），label 用 `main-{n}`；先例 `visual_preview.rs:44`。
  2. **菜单事件路由（关键风险）**：`nativeMenu.ts` 的 action 绑定在创建菜单的 webview，多窗口时菜单动作会全落第一个窗口。改为菜单项只带 id，Rust `on_menu_event` → `emit_to(当前 key window)`；各窗口前端监听自己的事件。
  3. **持久化按窗口拆分（单向门）**：`mdnote.workspaceFolders`、tabs 快照、侧栏状态加窗口槽位（`mdnote.windows.<label>.*`）；退出时各窗口各存；启动恢复窗口数与各自数据；旧 key 一次性迁移 + 失败回退（参照 `workspace.ts:22-37` 已有 legacy 迁移先例）。
  4. **single-instance 路由重设计**：二次启动文件 → 最近活动窗口而非固定 `main`（`lib.rs:289-295` 现写死）。
  5. **窗口关闭语义**：关闭单窗口不退出 App（mac 惯例，全部关完留驻 Dock）；`lib.rs:1635-1637` 的 Destroyed 清理按 label 泛化。
  6. **文件监听重构**：现状 AppState 单 watcher 单目录列表（`lib.rs:48-54`），多窗口需按路径引用计数共享，事件分发给挂载该根的窗口（见 §5.3）。
- **性能专项约束（见 §5.3）**：恢复窗口数上限；每窗口 WebView 内存预算；watcher 不随窗口数线性翻倍。
- **风险**：高。单向门（持久化 schema + 全局状态归属），建议单独出 `docs/architecture/multi-window.md` 后动工。
- **验收**：两个窗口各挂不同项目，A 窗编辑不影响 B 窗侧栏/标签；重启各窗口恢复各自项目与 tab；菜单动作始终作用于聚焦窗口；双击 .md 进入最近窗口；恢复 3 个窗口的启动时间与冷启动单窗口相比无倍数级劣化（预算见 §5.3）。

#### B2. "在新窗口打开"入口（依赖 B1）【P1 · 成本 S（在 B1 之上）】

- 打开文件夹对话框选项、最近文件右键项、树根右键项。B1 完成后为纯接线。

#### B3. macOS 原生窗口标签（可选增强，依赖 B1）【P2 · 成本 M】

- 多窗口落地后给 macOS 窗口统一设 `tabbingIdentifier: "inknote-main"`，免费获得系统"合并所有窗口 / tab 总览"。
- v2 注：C3（整窗透明）已否决，B3 与其的冲突不复存在；但 Overlay 标题栏下系统 tab bar 的视觉整合仍需 POC 验证。
- **风险**：低-中（视觉整合未验证点）。

### C 组：macOS 精致度

#### C1. 窗口状态记忆 【P0 · 成本 S】

- **现状**：每次启动居中 1080×720（`tauri.conf.json:16-20`），不记忆位置/尺寸/全屏。
- **推荐**：官方 `tauri-plugin-window-state`（`pnpm tauri add window-state` + capabilities 授权）。多窗口后天然按 label 记忆。
- **性能**：插件仅在窗口关闭/手动保存时写盘一次，无运行时开销。
- **风险**：极低。
- **验收**：移动/缩放/全屏后重启恢复原状。

#### C2. 侧栏顶通布局（交通灯下沉到侧栏）【P1 · 成本 M】

- **现状**：标题栏横贯顶部、侧栏不顶通（`Titlebar.tsx:183-196`），与 Xcode/Finder/VSCode 不一致——"缺少点什么"观感的主要来源（材质项已否决后，布局成为唯一观感大项）。
- **推荐**：macOS 下改为侧栏全高 + 交通灯在侧栏内；文件树 tab 栏/搜索框上移；中央标题并入内容区顶部。
- **原型**：
```
┌────────────────────────────────────────────────────────────────┐
│ ● ● ●   [文件][大纲][最近]  🔍[过滤______]        ⬒ 更新进度  │  ← 侧栏区(全高,含交通灯)
├────────┬───────────────────────────────────────────────────────┤
│ ▸ 项目A │  文档A.md ✕ │ 文档B.md ✕ │＋          ← 标签栏      │
│ ▾ 项目B │                                                       │
│   ▾ 笔记│              编辑器 / 预览区                          │
│     a.md│                                                       │
├────────┴───────────────────────────────────────────────────────┤
│ 状态栏：字数 · 行列 · 模式                                       │
└────────────────────────────────────────────────────────────────┘
```
- **实现要点**：`trafficLightPosition: { x: 16, y: ~20 }`；mac 分支重构 Titlebar/Sidebar 布局（Windows/Linux 不动）；针对 wry#1747 引入补偿模块。
- **性能配套（见 §5.5）**：交通灯重设必须节流，不能跟随每个 resize 事件帧执行。
- **风险**：中（CSS 布局回归 + 交通灯补偿时序）。
- **验收**：dev 与打包构建中交通灯位置一致不漂移；拖拽调整窗口大小的全程帧率无可感知下降；全屏无多余间隙；侧栏交互不与交通灯冲突。

#### C4. Window 菜单补全 【P0 · 成本 S】

- **现状**：macOS Window 菜单只有 Minimize、BringAllToFront（`nativeMenu.ts:139-146`）。
- **推荐**：补 `Cycle Windows`（Cmd+`，随 B1 落地才有实义）、`Zoom`；B3 落地后系统自动注入 tab 菜单项。
- **风险**：极低。

#### C6. 细节打磨清单 【P1-P2 · 成本 S×N】

- 全屏过渡与 `acceptFirstMouse`（首次点击未聚焦窗口即生效，mac 惯例；wry 支持，需确认当前未开）；
- 侧栏/树 hover 与选中态过渡曲线统一；
- 标签栏滚动条 macOS overlay 样式；
- About 对话框 mac 惯例居中（低优先）。

#### ~~C3 侧栏 Vibrancy 材质~~ / ~~C5 右键菜单原生化~~ 【已决策：不做】

- C3：不做。副作用记录：无需 `macOSPrivateApi`，MAS 上架可能性保留；窗口不做透明，B3 系统窗口 tab 不受影响。
- C5：不做，保持自绘右键菜单（与 VSCode 同路线）。

### 已达标项（无需改动）

- 原生菜单栏（含 Services/Hide/Quit 预置项）；窗口标题随文档更新；文件关联 + Dock/Finder 唤起；字体渲染与 thin 滚动条；外部文件拖入打开。

---

## 5. 性能专项设计（v2 新增）

> 原则：先测量再优化；每项功能给出触发阈值，未达阈值不做优化（避免过度设计）。验收用"可感知"标准（60fps 无卡顿）而非微基准。

### 5.1 树展开持久化的 IPC 放大（随 A1 必做，已实现）

- **问题**：设置持久化链路为「内存 JSON → 每次 setStoredValue 都 structuredClone 全量快照 + `save_app_settings` IPC 往返」（`settingsStore.ts:61-68`）；树展开状态每次 toggle 都触发一次全量持久化，读取路径还要重复 JSON.parse。单击展开使 toggle 频率提高约一个数量级。
- **措施（已随 A1 落地）**：
  1. `treeState.ts` 增加模块级内存缓存（读路径零解析）+ 300ms 去抖合并写入（高频连点只触发一次持久化）；
  2. 退出/关窗路径调用 `flushTreeExpansionPersist()` 强制落盘，`pagehide` 兜底。
- **成本**：S（已含在 A1）。**验收**：连续展开 10 个目录，设置持久化 IPC 仅在去抖窗口结束时发生；关窗/退出不丢树展开状态。

### 5.2 文件树渲染规模（随 A1 评估、超阈值才做）

- **问题**：`FileTree.tsx:828-936` 递归渲染整棵可见树且无虚拟化，任何 `setCache`/`setExpanded` 都全树重渲。单击展开 + 大目录（单目录上千条目）时 React reconciliation 成本线性放大。
- **措施（分级）**：
  - 阈值内（可见节点 < ~2000）：不动，保持现状简单性；
  - 超阈值：子树按目录节点 `React.memo`（props 为 path/depth/expanded/selected），把重渲范围从整树收缩到受影响分支；仍不够再评估虚拟化（react-window 类方案，成本 L，默认不做）。
- **测量方法**：React DevTools Profiler 记录单击展开一层的 commit 耗时。
- **成本**：评估 S；memo 化 M。**验收**：5000 文件项目单击展开任一目录，Profiler commit < 50ms，交互无可感知卡顿。

### 5.3 多窗口的资源预算（B1 设计约束，写入其架构文档）

- **内存**：每个 Tauri WebviewWindow 是独立 WKWebView 实例，开销约百 MB 级/窗口。约束：
  1. 恢复窗口数上限（建议默认 5，超出提示合并或丢弃最旧）；
  2. 欢迎页窗口不预载重型资源（mermaid/katex 按现有懒加载策略执行，不因开窗提前触发）。
- **文件监听**：现状单 watcher 单目录列表（`lib.rs:48-54`）。两窗口挂同一目录时若各建 watcher，notify 事件与前端缓存失效会翻倍。重构为**按路径引用计数的共享 watcher 注册表**，事件按"哪些窗口挂载了该根"分发；某根被所有窗口移除时才 unwatch。
- **启动恢复**：恢复 N 个窗口 = N 个 WebView 冷启动。措施：串行恢复（先主窗口可交互，其余窗口依次创建，避免同时抢占 CPU/IO）；窗口创建用 `visible: false` + 恢复完成后显示（window-state 插件官方建议，兼防白屏闪烁）。
- **更新检查**：updater 全进程一份，仅在一个窗口（主窗口）执行与展示，其余窗口只接收结果事件，避免 N 份下载。
- **IPC**：树加载（`listDir`）本就按目录单层调用，天然增量，多窗口不放大单窗口 IPC 量；但需确认 `watch_dirs` 汇总的 `dir-changed` 事件不被广播到所有窗口（用 `emit_to` 定向，见 B1-2 的同一条改造）。
- **成本**：包含在 B1 的 XL 内，不单独计。**验收**：3 窗口同挂同一 5000 文件目录，文件在外部修改，仅挂载窗口收到一次刷新事件；总内存相对单窗口增幅 < 2.5×单窗口 WebView 开销。

### 5.4 标签页拖拽排序的渲染策略（A3.3）

- 拖动过程中只用 pointer capture + CSS transform 移动 ghost 元素，不更新 store；pointerup 时一次性提交新顺序。避免拖动每帧触发 zustand 更新 → 全 tab 栏重渲。
- 中键关闭与快捷键切换为纯事件接线，无性能考量。

### 5.5 交通灯补偿的节流（C2）

- 针对 wry#1747 的重设逻辑挂在 Resized/Focused/ThemeChanged 事件上。macOS 拖拽改窗口大小的过程中 Resized 事件逐帧触发，若每次都跑 objc 消息 + setFrame 会造成布局抖动。措施：重设逻辑去抖 100ms（拖动结束后应用一次）；Resized 期间跳过。
- **验收**：连续拖拽窗口边缘 5 秒，帧率无下降，松手后交通灯位置正确。

### 5.6 全局性能回归清单（每个功能合入前过一遍）

- 启动到可交互时间：不劣化超过 +10%（对照基线：单窗口冷启动）；
- 主线程：常规交互（展开、切 tab、开文件）无 >16ms 长任务（DevTools Performance）;
- 内存：常规操作（开 20 个 tab、展开 500 节点）后无泄漏趋势（连续重复 10 次，堆内存回落）；
- 打包构建（非 dev）下验证：交通灯位置、窗口恢复、菜单路由三处是 dev/生产行为差异高发区。

---

## 6. 架构影响评估（B1 专项）

```
┌──────────────────────────────────────────────────────────────┐
│ Window 1 (label: main)      │ Window 2 (label: main-2)        │
│  React + zustand(进程内独立) │  React + zustand(进程内独立)     │
│  tabs / editor / sidebar    │  tabs / editor / sidebar        │
├─────────────────────────────┴────────────────────────────────┤
│ 共享层（冲突风险所在）                                          │
│  settingsStore: settings / workspaceFolders / treeExpansion   │
│  （内存 JSON + IPC 落盘，进程内单份；localStorage 仅迁移来源）  │
│  → workspace/tabs/侧栏状态 per-window 槽位化；设置保持全局      │
├──────────────────────────────────────────────────────────────┤
│ Rust 层（进程级单例）                                           │
│  single-instance 路由 / 原生菜单事件 / watcher / updater       │
│  → 菜单 emit_to(key window)；watcher 引用计数共享（§5.3）       │
└──────────────────────────────────────────────────────────────┘
```

- **状态归属**：每窗口 tabs = 窗口私有（zustand 每 webview 一份，天然满足）；工作区根、侧栏状态 = 窗口私有（需改造）；应用设置（语言/主题/快捷键/AI key）= 全局共享（保持）。
- **爆炸半径**：B1 影响启动恢复与数据迁移，迁移必须带旧数据自动接管 + 失败回退。
- **回滚路径**：窗口槽位 key 迁移失败时回读旧全局 key，降级单窗口模式。

---

## 7. 决策记录（2026-06，已拍板）

1. **B1**：按 VSCode 式独立窗口 + 每窗口独立工作区实施。✔
2. **B3**：要 macOS 系统窗口 tab，随 B1 落地（先做视觉 POC 验证 Overlay 标题栏整合）。✔
3. **A3.3**：tab 拖拽排序放 P2 末尾。✔
4. **恢复窗口数上限**：默认 5。✔
5. 此前已拍板：A2 不做（保持单击=固定 tab）、A4 暂缓、C3 不做、C5 不做、性能为硬约束（§5）。
6. 实施顺序：P0（A1/C1/C4）→ P1（A3.1、A3.2、C2）→ P2（B1+B2，先出 `docs/architecture/multi-window.md` 并经确认）→ P3（B3、A3.3、C6）。

---

## 8. 建议路线图（v2）

| 阶段 | 内容 | 特征 |
| --- | --- | --- |
| P0 速赢 | A1（单击展开 + §5.1 持久化去抖）、C1（窗口状态记忆）、C4（Window 菜单补全）——**已于 2026-06 实施并通过 tsc/vitest/cargo check** | 小改动、立刻可感知，A1 带性能配套 |
| P1 易用性 | A3.1/A3.2（快捷键 + 中键关 tab）、C2（侧栏顶通 + 交通灯，含 §5.5 节流） | 中等改造，回归集中在标签/布局 |
| P2 大项 | B1+B2（多窗口）——**已实施**，设计见 `docs/architecture/multi-window.md`（含实施偏差记录），待真机验证 | 架构级、单向门，已按 PR 序列完成 |
| P3 可选 | B3（系统窗口 tab）、A3.3（tab 拖拽排序）、C6 细节项 | 视 P2 后的体验反馈决定 |

依赖关系：B2、C4 的 Cycle Windows、B3 均依赖 B1；A1 的 §5.2 memo 化仅在超阈值时触发。

---

## 9. 附：VSCode 行为对照速查（v2 更新）

| 行为 | VSCode | InkNote 现状 | 本方案 |
| --- | --- | --- | --- |
| 目录单击展开 | 是（默认 singleClick） | 否（双击） | A1（P0） |
| 单击文件 | 预览 tab | 固定 tab | **保持现状（已决策）** |
| Ctrl/Cmd+Tab 切 tab | 是 | 否 | A3.1 |
| 中键关 tab | 是 | 否 | A3.2 |
| tab 拖拽排序 | 是 | 否 | A3.3（P2） |
| 命令面板 | 是 | 否 | 暂缓（已决策） |
| 新窗口/新窗口打开项目 | 是 | 否（单窗口多根） | B1/B2 |
| 窗口位置记忆 | 是 | 否 | C1（P0） |
| 侧栏顶通+交通灯下沉 | 是 | 否 | C2 |
| 侧栏材质 | 部分 | 否 | **不做（已决策）** |
| 右键菜单 | 自绘 | 自绘 | 保持 |
