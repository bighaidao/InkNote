# InkNote 资源消耗评估与优化方案（macOS 实测）

> 阶段：评估报告（含实测数据与优化建议，未实施）
> 对象：InkNote 0.2.12，Tauri 2 + React + CodeMirror 6，macOS（Apple Silicon）
> 日期：2026-06
> 方法：release 构建（`cargo build --release` + `pnpm build`）实机启动，`footprint` / `ps` / `lsof` 测量；代码路径静态审查

---

## 1. 实测结果

### 1.1 进程内存（冷启动 + 静置 45 秒，恢复上次会话后）

| 进程 | RSS | 说明 |
| --- | --- | --- |
| inknote（主进程，Rust） | 81 MB | `phys_footprint` 实际物理占用 **36 MB**（RSS 含二进制映射等共享页，虚高） |
| WebKit.WebContent ×2 | 20 MB / 20 MB | WebView 渲染进程（出现两个，其中一个是主 webview；第二个来源待核实，见 §5.1） |
| WebKit.GPU | 20 MB | 系统共享的合成进程 |
| WebKit.Networking | 14 MB | 系统共享的网络进程 |

**合计：全应用真实占用约 100–130 MB**（footprint 口径，macOS 内存压缩前）。
参照：Electron 同类应用冷启动基线通常 250–350 MB。**InkNote 当前内存表现属于 Tauri 应用的健康水平，无病态问题。**

其他：主进程 14 线程（tokio + wry 正常范围）；启动后静置无内存增长趋势（45 秒窗口内 RSS 稳定，81→81 MB）。

### 1.2 磁盘体积

| 项 | 数值 | 评估 |
| --- | --- | --- |
| 二进制 `target/release/inknote` | **21 MB** | **未优化**（无 `[profile.release]`，未 strip） |
| 前端 `dist/` | 6.8 MB（154 个文件） | 其中 5.5 MB 为 JS；**绝大部分是 mermaid 图表 chunk**（lazy 动态加载，不进初始内存） |
| 主 chunk `App-*.js` | 130 KB | 健康；初始解析成本低 |

### 1.3 结论先行

1. **内存没有大问题**，当前水位与 Typora/Bear 同量级，低于 Electron 一半以上。
2. **磁盘体积有明显优化空间**：二进制 21 MB 可压到约 9–12 MB（§2.1，改动 5 行配置）。
3. 真正的内存风险点在**两个使用场景**，均已有明确改法（§3）：全库搜索时的内容全量过 IPC、多 tab 大文档的三份拷贝。

---

## 2. 低成本速赢（建议全部做）

### 2.1 Rust 释放体积与内存：`[profile.release]` 调优 【成本 S】

当前 `InkNote/src-tauri/Cargo.toml` 无任何 profile 配置，二进制带全量符号。追加：

```toml
[profile.release]
strip = true        # 去符号：21MB → 预计 ~10-12MB
lto = "thin"        # 链接期优化：再省 5-10%，运行时也略省内存（去重代码页）
codegen-units = 1   # 配合 lto；编译时间变长（~1.5-2×），可接受
panic = "abort"     # 可选，再省 ~1MB；会改变 panic 行为（进程直接退出），保守起见可不加
```

- 预期：21 MB → 9–12 MB；物理内存中映射的代码页略降。
- 风险：低。`strip`/`lto` 不改行为；`panic="abort"` 单独决策。
- 验收：`cargo build --release` 后 `wc -c` 对比；跑全量测试与手动冒烟（开文件、保存、导出、AI）。

### 2.2 依赖瘦身（可选）【成本 S，收益小】

`Cargo.toml` 现有 reqwest（rustls）、keyring、encoding_rs、chardetng 等，均为功能必需，**不建议砍**。唯一可选项是 `reqwest` 的 TLS 后端（rustls 已是较小选择）。结论：依赖面已经干净，不动。

### 2.3 前端：维持现状 【成本 0】

vite 已把 mermaid/katex 拆成 154 个 lazy chunk（`InkNote/vite.config.ts` 分包 + 动态 import），不渲染 mermaid 就不占内存。主 chunk 130 KB 健康。**无需改动**；构建时的 ">500 kB chunk" 警告来自 mermaid 单图表 chunk，属预期。

---

## 3. 真正值得做的内存/性能优化（按场景）

### 3.1 场景一：全局搜索——文件内容全量过 IPC 【P1 · 成本 M】

**问题（代码事实）**：`InkNote/src/lib/workspaceSearch.ts:178-188` 全库搜索时，**每个文件都把完整内容读进 JS**（`readFile` → Rust `read_text_file` 全量 string → JSON IPC → JS string），每批 12 个并发。内容在 Rust String、JSON 序列化缓冲、JS String 间至少存在 3 份瞬时拷贝；5 MB 库搜索一遍，瞬时多出 ~15–20 MB 分配 + JSON parse CPU。

**改法**：把搜索循环整体下沉到 Rust——新增 `search_workspace(roots, query, opts)` 命令，在 Rust 侧读文件 + regex 匹配 + **只返回命中行**（上限如 1000 条），IPC 载荷从"全库内容"降为"命中结果"。现有 `search_regex`（`lib.rs:629`）已具备单文件能力，改造是把它与 `collectMarkdownFiles` 合并进一个命令。

- 附带收益：搜索从 12 路并发 IPC 变 1 次调用，去掉批处理往返；且省掉 JS 侧 `text.split("\n")` 的整文档行数组。
- 风险：中。需保持现有 SearchMatch 结构与大小写/UTF-16 偏移语义（`utf16_offset` 已有实现可复用）。
- 验收：5000 文件库搜索，峰值 RSS 增幅 < 30 MB（现状需实测基线对比）；结果与 JS 实现一致（复用现有测试用例）。

### 3.2 场景二：多 tab 大文档——同一文档三份拷贝 【P2 · 成本 M】

**问题**：`InkNote/src/store/useTabsStore.ts:12-23` 每个 tab 同时持有 `content` + `diskContent` 两份全文；活动 tab 还有 CodeMirror 的文档结构第三份。20 个 tab × 200 KB 文档 ≈ 8 MB 常驻（+CodeMirror 结构）。当前水位无害，但"打开几十个 tab 的长文档"场景会线性放大。

**改法（仅在用户反馈卡顿/内存高时做）**：非活动 tab 不存 `diskContent` 全文，改存 hash + 文件路径，切回 tab 时重新读盘对比（文件监听已存在，`watch_file`，`lib.rs:1008`，外部修改本来就会触发重载）。活动 tab 不变。
- 风险：中。涉及"保存期间输入不丢失"的时序（`markSaved` 注释 `useTabsStore.ts:183-189` 已明确该约束），改造必须保留该语义。
- 验收：40 tab × 500 KB 场景常驻内存较现状降 ≥ 40%；切 tab 无可感知延迟。

### 3.3 已在方案 v2 中列项的性能配套（不重复展开）

- `treeState.ts` 全量 JSON 读写去抖（`docs/requirements/mac-native-and-usability-plan.md` §5.1）；
- 文件树渲染超阈值 memo 化（§5.2）；
- 多窗口 watcher 引用计数与窗口数上限（§5.3）。

---

## 4. 多文件打开（tab）与渲染链路资源分析

### 4.1 打开多文件的内存模型

**数据面（代码事实）**：每个 tab 在 `useTabsStore` 持有 `content` + `diskContent` 两份全文（`InkNote/src/store/useTabsStore.ts:12-23`）；活动 tab 另有 CodeMirror 的 Doc 结构第三份。非活动 tab 的两份是纯 JS 字符串，无 DOM、无语法树——**打开 50 个普通文档（各 200 KB）常驻成本约 20 MB，是可控的线性增长**。tab 栏（`DocumentTabs.tsx`）只渲染轻量按钮列表，随 tab 数增长无压力。会话全文快照持久化已退役（`settingsStore.test.ts:48`），localStorage 不再随 tab 数膨胀。

**风险场景**：几十个 tab × MB 级长文档（日志型 md）时字符串双份线性放大——对应 §3.2 的 diskContent 瘦身（P2 触发式）。

### 4.2 切换 tab 的瞬时成本

**现状（代码事实）**：单 CodeMirror 实例（`InkNote/src/components/Editor.tsx:258-286`，mount 一次），切 tab = 全文 `dispatch` 替换（`Editor.tsx:340-364`），触发 CM6 文档树重建 + 全量语法高亮 + 视口内 widget 销毁重建。**已有三处正确的跳过优化**（`Editor.tsx:344` 回灌跳过、`347` 同值跳过、`185` doc.eq 跳过），说明该路径被有意识维护。

**可改进（P2）**：为非活动 tab 缓存 CM6 `EditorState`（语法树/折叠状态随 state 走），切换从"全文重算"变"状态切换"。收益是切 tab 延迟（长文档从可感知卡顿降到即时）+ 降低重算峰值；成本 M（需处理 state 与 store 字符串的同步时序）。触发条件：用户反馈大文档切卡。

### 4.3 渲染链路：现状健康，两点须知

**好的设计（无需改动）**：
- Live preview 是 CM6 装饰层内嵌 widget（`InkNote/src/editor/widgets/preview.ts`），**单 DOM 树**、无独立预览 DOM——比双栏双树省一半 DOM 内存；
- CM6 视口外 widget 不实例化，天然虚拟化；
- mermaid：懒加载 chunk + 渲染 token 防抖 + `eq()` 避免重绘（`mermaid.ts:19-49, 61-63`），滚出视口的 SVG 随 widget 销毁；
- 图片走 asset protocol 直读磁盘（`tauri.conf.json` assetProtocol），由浏览器缓存管理，无自定义缓存泄漏点。

**须知一：单屏多个复杂图表的 GPU 内存**。mermaid 架构图（数百节点）的 SVG 渲染层吃 GPU 内存而非 JS 堆，一屏多图时内存增长来自浏览器合成层——JS 侧无法回收，属浏览器托管。**不建议主动优化**，除非用户反馈；缓解手段是文档内控制图表密度。

**须知二：visual preview 独立窗口是最大的隐藏资源点**。每次打开图表/公式独立预览，Rust 侧**新建一个 WebviewWindow**（`InkNote/src-tauri/src/visual_preview.rs:44-57`）——即一个全新 WKWebView 进程（约 20–30 MB）+ 一份完整前端 bundle 实例。无复用、无数量上限；关窗清理是正确的（`visual_preview.rs:60-68` Destroyed → 移除）。

**改进建议（P1，成本 S-M）**：
1. 同 kind 预览**复用已有窗口**：`open_visual_preview` 先查 `PREVIEWS` 中同 kind 存活窗口，命中则更新数据并通知对应 webview 重渲染，而非再开新窗；
2. 兜底上限：同时存活的 visual-preview 窗口 ≤ 4，超限提示或复用最旧。
- 预期收益：预览重度用户省 20–30 MB/窗口；顺带统一了预览窗口管理入口。
- 风险：低（窗口生命周期已有正确的清理钩子，改动集中在 `visual_preview.rs` 单文件）。

**待核实**：PDF/HTML 导出的临时窗口（`lib.rs:573,674`）是否在导出完成后确定性销毁——`run()` 的事件处理只覆盖了 main 与 visual-preview 的清理路径。属一次性核查（成本 S）。

### 4.4 小结

| 场景 | 现状 | 定性 |
| --- | --- | --- |
| 打开 20-50 个普通文档 | 字符串双份线性增长，~20MB/50 tab | 健康，P2 触发式瘦身 |
| 长文档切 tab | 全文重算，已有跳过优化 | 可接受，P2 EditorState 缓存 |
| live preview 渲染 | 单 DOM 树 + 视口虚拟化 | 优秀，不动 |
| mermaid/katex | 懒加载 + 防抖 + 视口销毁 | 优秀，不动 |
| 一屏复杂图表 | GPU 合成层增长 | 浏览器托管，不主动优化 |
| **图表独立预览** | **每窗口一个 WKWebView 进程，无上限** | **P1：窗口复用 + 上限** |

---

## 5. 待核实项（诚实边界）

1. **两个 WebContent 进程**：启动即出现的第二个 WebContent，来源候选新增：visual preview / PDF 导出窗口残留（若导出后未销毁，则这是一个**确定性泄漏**，优先级升 P0）。**下一步**：`tauri dev` 中执行一次 PDF 导出后观察进程表。
2. **启动时间未精确测量**（本次仅测稳态内存）。建议用 `log` 时间戳或 Instruments 补一次冷启动到可交互的基线，作为后续多窗口方案 §5.3 的对照。
3. macOS 的 WebKit GPU/Networking 进程为系统共享，其内存不应全记在应用头上；本报告合计值已按保守口径（全记）给出。

---

## 6. 优先级汇总

| 项 | 成本 | 收益 | 建议 |
| --- | --- | --- | --- |
| 2.1 release profile（strip+lto） | S | 二进制 -50%，代码页略降 | **立即做** |
| 4.3 visual preview 窗口复用 + 上限 | S-M | 20–30 MB/预览窗口 | **P1 做** |
| 3.1 搜索下沉 Rust | M | 搜索峰值内存大幅下降 + IPC 减少 | **P1 做** |
| 4.3 导出窗口销毁核查 | S | 排查潜在确定性泄漏 | **P1 顺手查** |
| 3.2 非活动 tab 磁盘基线瘦身 | M | 重度用户常驻内存降 | P2，触发条件：用户反馈 |
| 4.2 切 tab EditorState 缓存 | M | 长文档切换延迟消除 | P2，触发条件：用户反馈 |
| 依赖/前端分包/live preview 架构 | 0 | 无 | 不动 |

一句话结论：**InkNote 的资源画像很健康（全应用 ~100-130 MB，远优于 Electron 基线）；打开多文件与渲染链路的设计质量高（单 DOM 树、视口虚拟化、懒加载均已就位）；值得做的是"编译配置调优"、"visual preview 窗口复用"、"搜索下沉"三件事，其余按场景触发即可。**
