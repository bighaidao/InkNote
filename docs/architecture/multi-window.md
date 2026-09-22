# 多窗口架构设计（B1 + B3）

> 状态：**已实施（2026-06）**，待真机验证清单见文末；对应需求方案 §4-B、§5.3、§6
> 范围：File > New Window、在新窗口打开项目、窗口状态按 label 持久化、macOS 系统窗口 tab（B3）
> 关联：`docs/requirements/mac-native-and-usability-plan.md`
>
> **实施偏差记录**（与初稿设计的差异，均向更简方向修正）：
> 1. 设置并发写入：除槽位化外，持久化从「整包快照覆写」改为「按路径增量合并写入」（新命令 `save_setting`，Rust 侧文件级读-改-写 + 进程互斥）。否则多窗口各自的全量快照会互相覆盖非本窗口键。原 `save_app_settings` 已删除。
> 2. watcher：采用**每窗口独立 watcher**（label 为键的 HashMap），替代原设计的"路径引用计数共享注册表"。语义等价（事件经 `emit_to` 定向到属主窗口，无广播），≤5 窗口时开销相同，实现显著更简单。

## 1. 目标与非目标

**目标**
- 多窗口：每个窗口 = 一个独立工作区（VSCode 式），独立标签页、独立侧栏状态。
- 新窗口入口：New Window / Open Folder（新窗口修饰）/ 树根右键 / 最近项目右键。
- 重启恢复：窗口数量与每窗口工作区恢复（上限 5）。
- macOS：最后关一扇窗不退出 App；Dock 重新点击可再开窗；B3 系统 tab。

**非目标**
- 窗口间拖拽标签（VSCode 也无）；分屏编辑器；窗口间复制粘贴文件（跨窗口文件操作仍走 Finder 或后续增强）。
- 预览标签、命令面板（已决策不做/暂缓）。

## 2. 业务状态矩阵

| 触发事件 | 前置状态 | 后置状态 | 副作用 | 异常/失败分支 |
| --- | --- | --- | --- | --- |
| File > New Window | N 个窗口 | N+1 | 新窗口空工作区（欢迎页），持久化建槽位 | 开窗失败 → 主窗口 toast 报错，数量不变 |
| Open Folder（按住 Alt/新窗口按钮） | 任意 | 目标窗口 N+1 | 新窗口挂载所选目录 | 目录不存在 → 打开对话框内报错 |
| 树根右键"在新窗口打开" | 该根已在窗口 A | 窗口 A 的根保留，新窗口 B 挂载同一根 | watcher 引用计数 +1 | 同上 |
| 关闭窗口 A（无未保存） | N≥2 | N-1 | A 的槽位持久化、watcher 引用计数-1 | — |
| 关闭最后一个窗口 (macOS) | 1 | 0 | App 留驻 Dock，状态已持久化 | Dock 点击 → RunEvent::Reopen 新开窗 |
| 关闭最后一个窗口 (Win/Linux) | 1 | 0 | 进程退出（保持现行为） | — |
| 退出并重启 | N 窗口 | 恢复 min(N,5) 窗口 | 各窗口恢复各自工作区/标签/树展开 | 槽位损坏 → 该窗口跳过恢复并移除槽位 |
| 双击 .md 文件（App 已运行） | N≥1 | 最近活动窗口打开该文件 | — | 无窗口 (macOS) → 新开主窗口 |
| 单实例二次启动 | N≥1 | 路由到最近活动窗口 | — | 同上 |

幂等性：New Window 快速连点 → 按序各建一窗（每次点击即一次明确意图，无需防重）；单实例路由是天然的合并点。

## 3. 总体拓扑

```
┌────────────────────────────── Rust 进程（单例） ──────────────────────────────┐
│                                                                              │
│  WindowManager（新增, AppState 扩展）                                          │
│   ├─ labels: Vec<Label>            // 存活窗口注册表                           │
│   ├─ last_focused: Label           // 菜单路由 / 单实例路由目标                 │
│   ├─ watcher_registry: Path→(watcher, refcount, subscribers) // §5.3 引用计数  │
│   └─ open_file slot（现 OpenFileState，路由改为 last_focused）                 │
│                                                                              │
│  菜单事件路由：JS action ──invoke──▶ route_menu_to_focused(id)                 │
│                                   ──emit_to(last_focused)──▶ 目标窗口前端      │
│                                                                              │
│  window-state 插件：按 label 自动保存/恢复位置尺寸                              │
│  updater：仅 main 窗口检查，结果 emit_to(all)                                  │
└──────────────┬───────────────────────────────┬───────────────────────────────┘
               ▼                               ▼
   ┌───────────────────────┐       ┌───────────────────────┐
   │ Window "main"          │       │ Window "main-2"        │
   │ React App（独立 JS 上下文）│      │ 同左                    │
   │ zustand / editor 独立   │       │                        │
   │ 存储命名空间 main        │       │ 存储命名空间 main-2      │
   └───────────────────────┘       └───────────────────────┘
```

分层不变：前端组件 → lib/store → settingsStore（IPC）→ Rust。多窗口不引入新的横向依赖；新增的 WindowManager 属于 Rust 层 AppState 的扩展，前端不直接依赖其内部结构。

## 4. 关键设计

### 4.1 窗口创建（Rust）

- 新增命令 `create_app_window(label: Option<String>) -> String`：复刻 `tauri.conf.json` 主窗口配置（macOS 读 `tauri.macos.conf.json` 的 Overlay/hiddenTitle 分支，用 `#[cfg(target_os = "macos")]` 按平台设置），label 缺省时按 `main-{n}` 顺延；返回实际 label。
- 前端启动参数：通过 `window.location` 的 label（`getCurrentWindow().label`）确定自己的存储命名空间（见 4.3），不依赖 URL 参数，避免 CSP/编码问题。
- 先例：`visual_preview.rs:44`（WebviewWindowBuilder）。

### 4.2 菜单事件路由（最高风险点）

- 现状：`nativeMenu.ts` 的 action 是 JS 回调，运行在**创建菜单的 webview**（`window.dispatchEvent`），多窗口时全部落到第一个窗口。
- **方案一（推荐）**：JS action 改为 `invoke("route_menu_to_focused_window", { id })`；Rust `emit_to(last_focused, NATIVE_MENU_EVENT, id)`；每个窗口前端监听自己的事件。不依赖 Tauri `on_menu_event` 与 JS action 的并存语义（该行为未验证，列为 POC 排除项）。
- 方案二：菜单整体迁移到 Rust 侧构建（删除 nativeMenu.ts 的 JS Menu API 用法，用 `Menu::with_items` + `on_menu_event`）。改动更大，i18n 文案需跨 IPC 传递；作为方案一不可行时的备选。
- 快捷键（`shortcuts.ts` 前端 keydown 监听）按窗口各自生效，不需改动。

### 4.3 持久化槽位化（单向门）

现状：`settingsStore` 进程内单份 JSON（`workspace.folders/lastFile/sidebarTab/treeExpansion/recentFiles` + `preferences.*`）。

- **窗口私有**（槽位化）：`workspace.folders`、`workspace.lastFile`、`workspace.sidebarTab`、`workspace.treeExpansion`。
  - 槽位 schema：`windows.main.workspace.folders`、`windows.main-2.workspace.treeExpansion`…（settingsStore 的 SETTINGS_PATHS 映射表扩展，前端 key 不变，映射时拼接 label）。
  - `settingsStore` 增加 window scope 概念：初始化时以 `getCurrentWindow().label` 构造路径前缀；App 其余代码零改动（这是把改动收敛在存储层的核心手段）。
- **全局保留**：`preferences.*`、`appearance.*`、`locale`、快捷键、AI 配置、`workspace.recentFiles`（最近文件列表全局一份）。
- **迁移与回滚（向前兼容）**：
  1. 启动时若存在旧路径（`workspace.*`）且当前窗口无槽位 → 主窗口（label == "main"）接管旧值并复制到槽位；旧键保留一个版本周期（不清除），槽位缺失时回读旧键即天然回滚。
  2. 槽位 JSON 损坏 → 跳过恢复该窗口，槽位置空，不阻塞其他窗口。
- **窗口集恢复**：新增全局键 `windows.order: string[]`（按创建顺序）与 `windows.nextIndex`；退出时由 close 流程更新；启动时 Rust `setup` 读取 `windows.order`（≤5）依次创建窗口（`visible: false` + window-state 恢复后 show，防闪烁），各窗口前端自行恢复各自槽位。
- 窗口数量超上限（>5 记录）：多出的窗口不恢复，`windows.order` 截断为 5。

### 4.4 single-instance 与文件打开路由

- `lib.rs:289-295` 的 `activate_main_window` → `activate_last_focused`（WindowManager 维护，`WindowEvent::Focused(true)` 时更新）。
- `RunEvent::Opened`（macOS 拖文件到 Dock）与 single-instance argv 路由到 `last_focused`；无窗口时（macOS）先 `create_app_window("main")`。

### 4.5 生命周期与退出语义

- 创建：`create_app_window` → window-state 恢复位置尺寸 → show → 前端 `initializeSettingsStore`（按 label scope）→ 恢复工作区/标签/树展开。
- 关闭单窗口：前端 closeRequestRef 流程不变（flush 持久化 + 未保存确认）→ 后端 `WindowEvent::Destroyed`：watcher 引用计数-1、`windows.order` 移除该 label、window-state 保存（插件自动）。
- 最后一个窗口：macOS 用 `RunEvent::ExitRequested { api }` + `api.prevent_exit()`（App 留驻 Dock）；`RunEvent::Reopen`（Dock 点击）→ `create_app_window("main")`。Windows/Linux 不拦截，保持现退出行为。
- 进程退出：`RunEvent::ExitRequested`（真正的退出，如 Cmd+Q）→ 汇总保存 `windows.order`。现有 `visual_preview::close_previews` 清理按 label 前缀泛化（主窗口 label 可能不再是 "main"——previews 关联逻辑改为按父 label 记录）。

### 4.6 B3：macOS 系统窗口标签

- `create_app_window` 与主窗口均设置 `tabbingIdentifier: "inknote-main"`（tauri 2 窗口配置项；窗口非透明非无装饰，满足 wry 启用条件）。
- 收益：系统级"合并所有窗口 / 显示所有标签 / 标签总览"免实现。
- POC 验证点（先行）：Overlay 标题栏下系统 tab bar 出现时，交通灯与自绘标题栏的避让是否正常；全屏切换时 tab bar 行为。POC 不通过则 B3 缓行，不阻塞 B1。

### 4.7 watcher 引用计数（§5.3）

- `watch_dirs` 语义改为"窗口 label + 目录集合"注册；Rust 侧按目录聚合 refcount，>0 时保持 watch，=0 时 unwatch。
- `dir-changed`/`file-changed` 事件用 `emit_to(subscriber labels)` 定向分发，禁止 `emit` 广播（避免窗口间重复刷新与无效 IPC）。

## 5. 五维审查

| 维度 | 结论 |
| --- | --- |
| 状态归属 | 每窗口 tabs/zustand = webview 私有（天然）；工作区/侧栏/树展开 = per-window 槽位；设置/主题/快捷键/AI = 全局；WindowManager（labels/last_focused/watcher）= Rust 进程级。唯一权威源都是单点，无多副本写。 |
| 生命周期 | 窗口创建→恢复→销毁对称；watcher refcount 归零即回收；updater 仅主窗口；previews 按父 label 清理；prevent_exit 仅 macOS。 |
| 异步时序 | 槽位读写全部走 settingsStore 现有 saveChain 串行化；启动恢复串行创建窗口，后窗口不抢占前窗口的 IPC；`last_focused` 更新仅由 Focused 事件驱动，无竞态窗口（同窗口事件在主线程串行）。 |
| 爆炸半径 | 槽位损坏 → 单窗口跳过恢复；watcher 失败 → 该窗口降级为手动刷新；菜单路由失败 → 命令面板/快捷键仍可用（快捷键是前端本地监听）。 |
| 单双向门 | 持久化 schema 变更 = 单向门。回滚路径：保留旧 `workspace.*` 键一个版本周期，槽位缺失时回读旧键降级单窗口；`windows.order` 缺失视为仅恢复 main。 |

## 6. 实施切分（PR 序列）

1. PR-1 基建：WindowManager + `create_app_window` + 前端 label 感知的 settingsStore 槽位（含迁移/回滚）+ New Window 菜单与命令。此 PR 完成后已可多开窗口。
2. PR-2 路由：single-instance / Opened / last_focused；watcher 引用计数 + emit_to 定向分发。
3. PR-3 入口：Open Folder 新窗口修饰、树根右键、最近项目右键；窗口恢复（windows.order，上限 5）；退出语义（prevent_exit/Reopen）。
4. PR-4 B3 POC：tabbingIdentifier + Overlay/tab bar 视觉验证；通过则随 PR 合入。

每步可独立回归、独立回滚（feature 无 flag，按 PR 粒度回滚）。

## 7. 验收清单（对应需求方案 §4-B1 验收 + §5.3 预算）

- 双窗各挂不同项目，互不串扰；重启恢复各窗工作区/标签/树展开与窗口位置。
- 菜单动作始终作用于聚焦窗口；快捷键各自窗口独立。
- 3 窗口同挂 5000 文件目录：外部修改仅挂载窗口收到一次刷新事件。
- 恢复 3 窗口的启动时间相比单窗口 ≤ 2×（串行恢复），无可感知白屏闪烁。
- macOS：关最后一窗 App 留驻；Dock 点击再开窗；Cmd+Q 退出后状态已保存。
- Win/Linux：行为不退化，最后一窗关闭即退出。
- B3：合并所有窗口后交通灯/tab bar 布局正常（POC 决定去留）。
