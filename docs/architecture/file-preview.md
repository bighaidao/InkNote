# 多格式预览架构设计（Phase 1）

> 状态：已实施（2026-09。实施确定项：① 白名单 JSON 拆 `searchableTextExtensions`（内容搜索）与 `previewableExtensions`（快速打开/文件树文件名列表）双列表，Rust `include_str!` 与前端 import 同源；② 二进制读取走 Tauri `ipc::Response` 原始字节通道，避免 JSON 序列化放大；③ 压缩包大小上限对齐 Rust 全局护栏 200MB；④ HTML/SVG 等文本类以源码高亮预览（textPlugin），不做沙箱渲染 HTML）
> 前置：`docs/requirements/product-vision-roadmap.md`
> 选型：`@open-file-viewer/react`（MIT），fallback `@file-viewer/react`

## 0. 目标与非目标

**目标**：代码/文本/图片/Office(doc/docx/xls/xlsx/ppt/pptx)/PDF/HTML/压缩包/邮件 在 Tab 内高性能只读预览；文本类格式进全局搜索。

**非目标**：预览态编辑；Office 保真还原（接受 pptx-preview 系限制）；服务端转换（违背本地优先）。

## 1. 分层拓扑（单向依赖）

```
┌─────────────────────────────────────────────────────────────┐
│ App.tsx（分流入口，≤50 行新增）                                │
│   loadFile() → isPreviewable(path) ? openPreviewTab : 原路径  │
├─────────────────────────────────────────────────────────────┤
│ Preview 层（全部新文件）                                      │
│   FilePreviewTab.tsx      容器 + 四态 + 生命周期             │
│   previewRegistry.ts      扩展名 → 插件/策略 纯函数映射        │
│   previewAssets.ts        Blob 缓存 + LRU + revoke           │
├─────────────────────────────────────────────────────────────┤
│ State 层                                                     │
│   useTabsStore：TabDoc 增 kind + previewPath（兼容设计见 §3） │
├─────────────────────────────────────────────────────────────┤
│ Rust 层                                                      │
│   fs.rs（从 lib.rs 抽出）：read_binary_file / stat_file      │
│   search：collect 扩展名白名单常量化                          │
└─────────────────────────────────────────────────────────────┘
```

**红线**：App.tsx / editor.ts / lib.rs 现有行数只减不增；预览代码 100% 进新文件。

## 2. 数据流与权威真理源

```
双击文件树 / 拖放 / 对话框
        │ path
        ▼
previewRegistry.classify(path)  ── "markdown" ──▶ 现有 loadFile（零改动）
        │ "preview"                              （readTextFile → TabDoc）
        ▼
read_binary_file(path)  ← Rust：fs::metadata 大小检查 → Vec<u8>
        │
        ▼
previewAssets.acquire(path, bytes) ── LRU 缓存 → Blob + objectURL
        │
        ▼
TabDoc{kind:"preview", previewPath} ──▶ FilePreviewTab
        │                                   │
        │                    createViewer(container, {plugins})
        │                                   │
        └── closeTab / LRU 淘汰 ──▶ release() ──▶ URL.revokeObjectURL
                                         viewer.destroy()
```

权威真理源：**磁盘文件**。预览 Tab 不缓存内容语义，重新激活 Tab 时若 `file-changed` 事件命中 `previewPath`，直接重新 `read_binary_file`（预览无 dirty 态，无冲突问题）。

## 3. TabDoc 兼容设计（评审问题 #1 #5）

不新建平行的 tab 数组（那会波及 Tab 栏/关闭逻辑/恢复逻辑全链路），而是最小侵入：

```ts
// useTabsStore.ts 扩展（增量，不改现有字段语义）
export interface TabDoc {
  // ...现有 20 个字段不动，预览 Tab 下这些字段取默认值...
  kind: "document" | "preview";   // 默认 "document"，旧快照缺省即 document
  previewPath: string | null;      // kind=preview 时有效；与 path 字段分开，
}                                  // 避免 sameDocumentPath 去重逻辑误伤

// restoreTab 快照增加 kind + previewPath 透传（评审问题 #1）
```

- `sameDocumentPath` 去重：预览 Tab 用 `previewPath` 参与，与 document Tab 天然不去重（同一 .md 文件不会既是 document 又是 preview，因为 classify 是纯函数互斥）。
- Tab 栏 UI：`kind === "preview"` 时显示只读角标，右键菜单去掉「保存/导出」，保留「关闭/在访达中显示」。
- 窗口重启恢复（review 中确认的槽位机制）：快照里 preview Tab 只存 `previewPath`，恢复时重新读盘，不持久化 Blob。

## 4. 模块清单（全部新文件，评审问题 #2）

| 文件 | 行数预算 | 职责 |
| --- | --- | --- |
| `src/preview/FilePreviewTab.tsx` | ≤300 | 容器组件：四态渲染、viewer 生命周期、resize 响应 |
| `src/preview/previewRegistry.ts` | ≤150 | 纯函数：扩展名 → `{kind, plugin, sizeLimit}`；无 React/无 IO，100% 可单测 |
| `src/preview/previewAssets.ts` | ≤120 | Blob LRU（上限 5 条 / 单条 200MB）、revoke、acquire/release |
| `src/preview/usePreviewFile.ts` | ≤100 | Hook：读盘 + 大小检查 + 错误归一化 |
| `src-tauri/src/fs.rs` | ≤250 | `read_binary_file`、`stat_file`；从 lib.rs 平移既有 fs 命令 |

### previewRegistry 策略表（初始值，已确认进 settings.json，与搜索白名单共用一份配置）

| 类别 | 扩展名 | 引擎 | 大小上限 |
| --- | --- | --- | --- |
| markdown | md, markdown, txt | （现有链路，不走预览） | — |
| 代码/文本 | json yaml yml xml ts tsx js py go rs sql sh html css log 等全文白名单 | **TextPreview（CM6 只读）+ language-data 懒加载高亮**（对齐 product-design-full §1.1 中量级；自带行号/查找面板/虚拟滚动；编码探测复用 readTextFile） | 10MB（超出降级为纯文本无高亮 + 性能保护横幅） |
| 图片 | png jpg jpeg gif webp svg bmp ico avif | 原生 img + `convertFileSrc`（零拷贝，不读字节） | 100MB |
| PDF | pdf | pdfPlugin（pdfjs worker 经 `?url` 引入） | 200MB |
| Word | doc docx docm dot rtf odt | officePlugin | 100MB |
| Excel | xls xlsx xlsm xlsb | officePlugin | 50MB |
| PPT | ppt pps pptx pptm odp | officePlugin | 100MB |
| EPUB | epub | epubPlugin | 100MB |
| HTML/HTM | html htm | TextPreview（源码高亮；不做沙箱渲染 HTML，规避脚本面） | 10MB |
| 压缩包 | zip rar 7z tar gz tgz bz2 xz | archivePlugin | **200MB（已拍板：与 Rust 全局护栏统一，修订设计文档的 500MB，保证单 Tab 内存护栏可守；流式目录解析留待 Phase 2 评估）** |
| 邮件 | eml msg mbox | emailPlugin | 20MB |
| 其他 | * | fallback：图标 + 「系统打开 / 在资源管理器中显示」 | — |

> 常量单一来源：此表同时是**搜索收录白名单**的来源（评审问题 #4）——文本类行进 Rust `SUPPORTED_TEXT_EXTS`，通过 `shared-extensions.json` 构建期注入双端，杜绝两处手写漂移。JS 侧 `workspaceSearch.ts` 的目录遍历改为直接消费 Rust `search_workspace` 返回的文件列表，删除 JS 版 `collectMarkdownFiles`（少一次逐目录 IPC 往返，本身即性能优化）。

## 5. Rust 层设计（评审问题 #2 #7）

```rust
// src-tauri/src/fs.rs
#[tauri::command]
fn stat_file(path: String) -> Result<FileStat, String> {
    let meta = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    Ok(FileStat { size: meta.len(), is_dir: meta.is_dir() })
}

#[tauri::command]
fn read_binary_file(path: String) -> Result<Vec<u8>, String> {
    // 大小护栏在 IO 侧，不信任前端传参
    let meta = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    if meta.len() > PREVIEW_MAX_BYTES { return Err("preview_file_too_large".into()); }
    std::fs::read(&path).map_err(|e| e.to_string())
}
```

- `search_workspace` / `collect_markdown_files` 改造：`is_markdown_ext` → `is_searchable_text_ext`，扩展名来自生成文件；`is_markdown`（启动参数用，lib.rs:322）**保持不变**（双击 .md 打开主窗口的语义不动）。
- lib.rs 其余不动（本次不强制拆分 lib.rs，只把新增命令放新模块，避免重构面扩大）。

## 6. CSP 与资产（评审问题 #3）

**Spike 任务（编码前 0.5 天）**：在 demo 分支验证以下 CSP + open-file-viewer WASM Worker 能否运行：

```
default-src 'self';
script-src 'self' 'wasm-unsafe-eval';
worker-src 'self' blob:;
img-src 'self' asset: http://asset.localhost https: data: blob:;
media-src 'self' asset: http://asset.localhost blob:;
style-src 'self' 'unsafe-inline';
font-src 'self' data: blob:;
connect-src 'self' ipc: http://ipc.localhost asset: http://asset.localhost blob: data:;
```

已按此落地 `tauri.conf.json`（spike 结论：构建通过；WKWebView 内 WASM/Worker 运行验证待真机手测清单确认）。

**资产自托管**：open-file-viewer 的 WASM/字体经 Vite 插件复制到 `public/file-viewer/`，设置 `assetBaseUrl` 指向打包内路径，离线可用。CI 加检查：`public/file-viewer` 存在且 LICENSE/NOTICE 齐全（合规）。

## 7. 状态与生命周期（评审问题 #5 #7）

预览 Tab 状态机：

```
loading ──读盘失败──▶ error(重试/系统打开)
   │读盘成功
   ▼
ready ──file-changed 命中 previewPath──▶ refreshing ──▶ ready（新 Blob）
   │
   ├─ 大小超限 ──▶ confirm("文件 380MB 超过预览上限，用系统应用打开？")
   │                 ├─ 是 → opener.openPath(path)，Tab 显示降级卡片
   │                 └─ 否 → Tab 显示降级卡片（含「仍然预览」仅对压缩包类）
   │
   └─ 关闭 Tab / LRU 淘汰 ──▶ viewer.destroy() + revokeObjectURL（确定性销毁）
```

四态 UI（产品确认稿）：

- 空数据态：不适用（预览必有文件）
- 加载态：容器骨架 + 文件名 + 大小（stat_file 先行返回，loading 期间即显示）
- 异常态：内联错误卡（错误信息 + 重试 + 系统打开），不弹模态
- 极端态：超大文本（>10MB）降级无高亮纯文本；超多页 PDF 只渲染可视页；长列表插件自带虚拟滚动

## 8. 性能设计

| 措施 | 落点 | 验收 |
| --- | --- | --- |
| 引擎懒加载 | `import("@open-file-viewer/react")` 仅在首个 preview Tab 打开时执行 | md-only 会话网络面板零加载 |
| 首屏体验 | stat_file(<5ms) 先行 → loading 态即有元信息 | 100MB PDF loading 态 <100ms 出现 |
| Blob LRU | previewAssets，5 条上限，淘汰即 revoke | 10 Tab 连续开关预览内存不增长 |
| PDF 分页 | viewer 内置懒渲染 + 配置 renderAhead 仅 1 页 | 滚动不卡顿 |
| 搜索白名单 | Rust 侧常量，无 IPC 放大 | 全库搜索 P95 不劣化于现状 +10% |
| 基线脚本 | `scripts/perf-baseline.ts`：启动耗时/搜索耗时/内存快照 | 进 CI 可选 job，输出 JSON 趋势 |

## 9. 测试计划

| 层 | 用例 |
| --- | --- |
| previewRegistry 单测 | 全扩展名分类互斥、大小上限映射、未知扩展 fallback |
| previewAssets 单测 | LRU 淘汰顺序、revoke 调用、并发 acquire |
| useTabsStore 单测 | kind 快照往返（评审问题 #1 的回归用例）、previewTab 关闭清理 |
| Rust 单测 | read_binary_file 超限/不存在/权限；新搜索扩展名收录 |
| 集成测试 | FilePreviewTab 四态渲染（mock invoke）；file-changed 刷新 |
| 手测清单 | Win/macOS 各一轮：六类真实文件、拖放、对话框、重启恢复 |

## 10. 实施顺序（每步可独立验证，随时可停）

| 步骤 | 状态 |
| --- | --- |
| 1. Spike：CSP + open-file-viewer | ✅ 完成（依赖 0.1.48 已装；CSP 已落地；`optimizeDeps`/rollup 双端排除 `@napi-rs/canvas` 原生模块；生产构建通过，preview-engines 独立懒加载 chunk ≈483KB gzip） |
| 2. Rust：fs.rs + 白名单 + `list_workspace_files` | ✅ 完成（25 测试通过；`ipc::Response` 原始字节通道） |
| 3. State：TabDoc kind + 快照 | ✅ 完成（13 store 测试通过，含旧快照兼容） |
| 4. UI：registry / assets / FilePreviewTab / viewerBundle | ✅ 完成（四态、LRU、防漂移测试；前端 172 测试通过） |
| 5. 接线：loadFile 分流 / 对话框 / 拖放 / 文件树 / Tab 角标 | ✅ 完成（导出/保存/编辑开关对预览 Tab 关闭） |
| 6. 收尾：README 五语言、设置页插件开关、真机手测 | ⏳ 待做（真机验证需先关闭正在运行的已安装版 InkNote——single_instance 会让 dev 实例静默退出） |

### 10.1 已知限制（v1）

- ~~预览 Tab 不响应 `file-changed` 外部修改~~ → **已实现**：外部修改静默刷新（§3.2 二等公民行为）。
- ~~搜索结果点击非 md 文本文件不支持行号定位~~ → **已实现**：`initialLine` 透传，CM6 只读实例滚动到命中行（§2.2 类型感知跳转）。
- 图片预览的滚轮缩放/双击 1:1/拖拽平移（设计文档 §1.1 轻量级交互）未实现，v1 仅 contain 显示。
- PDF/Office 的 Viewer 内置查找未启用（`toolbar: false`）；文本类查找由 CM6 查找面板覆盖。
- ~~「预览插件开关进 settings.json」待落地~~ → **已实现**（2026-09-24）：设置面板新增「预览与文件」分类——6 类格式开关（text/image/pdf/office/archive/email，office 三子类共用）+ 搜索排除目录（按目录名、任意深度，Rust `search_workspace`/`list_workspace_files` 已支持 `excludedDirs` 参数）；关闭某类预览时回落 Markdown 文档链路。存储复用 settingsStore（`preferences.previewFeatures` / `preferences.searchExcludedDirs`）。
- 文件树格式感知图标已实现（`src/components/fileTypeIcon.ts`，lucide 按扩展名映射）。

### 10.2 对齐 product-design-full 的实施记录（2026-09-24）

- **文本引擎修正**：textPlugin（prismjs）→ CM6 只读 + `@codemirror/language-data`（新增依赖，替代原方案的 legacy-modes 假设）。拍板依据：复用 CM6 体系、支撑搜索跳转、UI 一致。
- **ZIP 上限拍板**：统一 200MB，修订设计文档 500MB 与内存护栏的矛盾；500MB 流式目录解析列为 Phase 2 候选。
- **P0 Tab 行为矩阵落地**：Cmd+S 静默+提示、Tab 右键菜单（保存/另存为置灰、刷新、复制路径、访达显示）、只读徽标、外部修改静默刷新、超限主动确认卡。

## 11. 风险登记

| 风险 | 触发条件 | 应对 |
| --- | --- | --- |
| spike 失败（WASM 被 CSP 拒） | 步骤 1 | 评估 file-viewer / 降级格式集 |
| open-file-viewer 渲染 bug | 步骤 4 手测 | 单格式插件可摘除，registry 表即开关 |
| 内存泄漏 | 长时间使用 | LRU + destroy 代码评审 + 基线脚本盯内存 |
| 搜索性能回退 | 大仓库 | 白名单体积控制 + 基线对比门禁 |
