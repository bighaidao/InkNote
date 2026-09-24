# macOS 图标圆角化与文件树过滤系统故障排查与重构复盘 (RCA)

> **日期**：2026-09-24  
> **状态**：已解决并交付  
> **涉及模块**：App 图标资产 (Tauri/icns)、文件树呈现 (`FileTree.tsx`)、运行时配置 (`previewSettings.ts` / `Settings.tsx`)、应用发布打包

---

## 1. 事件背景与现象

在引入多格式预览系统后，用户反馈了以下三类影响体验的核心问题：

1. **Dock 栏图标视觉异常**：
   - **现象**：InkNote 图标在 macOS Dock 栏呈现为一个突兀的不透明白色直角方块，未能呈现与其他 macOS 原生应用（如 WPS、Panda 桌面版等）一致的圆润大圆角悬浮质感。
2. **多格式文件未能展示（“只支持 md 文件”）**：
   - **现象**：虽然多格式预览后端与组件已就绪，但在工作区文件树展开时，依然仅展示 `.md`、`.markdown` 和 `.txt` 文件，其他常规代码（`.ts`, `.json` 等）与资源文件全部消失。
3. **文件树缺乏过滤机制，配置未生效**：
   - **现象**：工作区展开时暴露了大量以点开头的隐藏目录（如 `.git`, `.next`, `.agents`, `.agy_home`, `.codegraph` 等）与依赖目录（`node_modules`）；用户在设置中未能直观找到过滤项，即使在预览项中配置了排除目录，文件树也依然原封不动全部列出。
4. **本地验证未生效迷思**：
   - **现象**：修改代码后重新运行应用，用户界面依然呈现旧状态。

---

## 2. 根因深度剖析 (Root Cause Analysis)

### 2.1 Dock 栏白色方块根因：画布不透明与直角裁切

- **代码与资产现场**：此前使用的图标母版为 AI 渲染图，图像画布四个角落的像素值为 `RGB(253~255)`，**Alpha 透明通道为 255（完全不透明）**。
- **机制机理**：macOS Dock 栏通过检测 `.icns` 的 Alpha 通道进行轮廓贴合与悬浮阴影渲染。当图标四个角为不透明时，系统视其为标准矩形方块，导致在深色/彩色毛玻璃 Dock 栏上显现出明显的白色四方底框；同时，中间圆角卡片的曲率与边距未对齐 Apple HIG 官方 Squircle 规范。

### 2.2 文件树非 Markdown 文件消失根因：视图层硬编码拦截

- **代码定位**：`InkNote/src/components/FileTree.tsx#L912-L913`
- **代码现场**：
  ```tsx
  const isMd = /\.(md|markdown|txt)$/i.test(entry.name);
  if (!isMd) return null;
  ```
- **机制机理**：文件树节点渲染逻辑中，对非目录节点硬编码了正则表达式校验，直接丢弃了所有非 `.md/.markdown/.txt` 文件。多格式预览架构虽然打通了打开链路，但在视图渲染阶段被该条件一票否决。

### 2.3 隐藏文件与排除目录失效根因：逻辑孤岛与脏配置覆盖

1. **逻辑孤岛（FileTree 未消费配置）**：
   - `FileTree.tsx` 的 `loadDir` 仅过滤了内置图片资产目录 `isManagedImageAssetDir`，未引入任何隐藏文件判断或排除目录判断。
2. **配置入口偏狭**：
   - 原排除目录输入框被归在“预览 (Preview)”分类末尾，文案声明为“搜索排除目录”，用户在“文档/常规”分类中无法检索到。
3. **持久化脏缓存覆盖默认值**：
   - 排查本地 `settings.json`（位于 `~/Library/Application Support/com.inknote.desktop/settings.json`）发现：历史版本曾向磁盘写入过 `"searchExcludedDirs": "[\".git\"]"`。
   - 当应用读取配置时，由于该字段非空，新定义的默认排除名单（`node_modules, .next, .cache` 等）被完全覆盖忽略。

### 2.4 本地验证未生效根因：系统 LaunchServices 机制与单实例阻断

1. **双应用路径冲突**：
   - `/Applications/` 目录下已安装有旧版本（9月23日编译的 `InkNote.app`）。在 macOS 中，无论是 Dock 栏点击、Spotlight 启动还是部分命令行调用，系统 LaunchServices 会优先派发给系统应用程序目录下的实例。
2. **Tauri SingleInstance 插件重定向**：
   - 后台若有未完全退出的旧进程，后续启动的新实例会直接将焦点转发给旧进程并自我销毁，导致用户看到的始终是旧实例界面。

---

## 3. 架构与工程解决方案

```
┌─────────────────────────────────────────────────────────────────┐
│ 用户界面与配置 (Settings.tsx / i18n.ts)                           │
│   ├─ [文档] 专区: 新增「文件过滤与排除」                        │
│   │    ├─ 开关: 过滤隐藏文件与文件夹 (默认开启)                  │
│   │    └─ 输入框: 排除目录 (附带以点开头特定目录的配置提示)       │
│   └─ [预览与文件] 专区: 保持双向同步与联动                       │
└────────────────────────────────┬────────────────────────────────┘
                                 │ 权威真理源 (settingsStore)
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 运行时配置层 (previewSettings.ts)                                │
│   ├─ getHideHiddenFiles(): 默认 true                            │
│   └─ getSearchExcludedDirs(): 强制并集 (默认项 ∪ 用户自定义项)   │
└────────────────────────────────┬────────────────────────────────┘
                                 │ 驱动视图过滤
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 文件树组件 (FileTree.tsx)                                        │
│   ├─ loadDir: 自动滤除 dotfiles 与 excludedDirs 匹配目录        │
│   ├─ 彻底移除 if (!isMd) return null; 阻断                       │
│   └─ 呈现全格式多类型图标 (fileTypeIcon)                         │
└─────────────────────────────────────────────────────────────────┘
```

### 3.1 图标全套规范重构
1. **画布透明与比例**：基于 $1024 \times 1024$ 画布，$824 \times 824$ 基底，四周留白 $100\text{px}$ 且背景 100% 透明（Alpha = 0）。
2. **Squircle 连续曲率**：采用 $185\text{px}$ 标准大圆角超采样渲染，贴合 macOS 原生曲率。
3. **自然悬浮阴影**：内置自然向下的弥散落影与接触影，在浅色/深色 Dock 背景下均具备良好立体感。
4. **全尺寸打包与同步**：同步编译生成 `icon.icns`、`icon.ico`、`icon.png` 及全分辨率资源。

### 3.2 文件树多格式解禁与智能过滤
1. **解除格式硬编码**：移除 `FileTree.tsx` 中的 `isMd` 判断，所有非排除的文件正常挂载树节点。
2. **隐藏文件一键过滤**：`loadDir` 自动根据 `getHideHiddenFiles()` 过滤所有以 `.` 开头的文件/目录。
3. **排除目录智能合并**：
   ```ts
   // previewSettings.ts: 保证 node_modules, .next, .cache 等默认项始终有效
   export function getSearchExcludedDirs(): string[] {
     const raw = getStoredValue(EXCLUDED_DIRS_KEY);
     if (!raw) return [...DEFAULT_EXCLUDED_DIRS];
     try {
       const parsed = JSON.parse(raw) as unknown;
       if (!Array.isArray(parsed)) return [...DEFAULT_EXCLUDED_DIRS];
       const userDirs = parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
       return [...new Set([...DEFAULT_EXCLUDED_DIRS, ...userDirs])];
     } catch {
       return [...DEFAULT_EXCLUDED_DIRS];
     }
   }
   ```

### 3.3 交付物统一覆盖
- 重新构建前端静态产物（`vite build`）与 Rust 后端二进制。
- 直接将全新打包的 Release 应用同步部署至 `/Applications/InkNote.app`，彻底消除 LaunchServices 历史残留。

---

## 4. 验证与回归基线

- **自动化单测**：全套 179 项前端单元测试（含 `previewSettings`、`workspaceSearch`、`useTabsStore` 等）100% 通过。
- **视觉验证**：Dock 栏应用图标边缘透明平滑，无直角方框；文件树默认收敛 `.git`、`.next`、`node_modules` 等无关项目，普通代码文件清晰展示并匹配专属图标。
