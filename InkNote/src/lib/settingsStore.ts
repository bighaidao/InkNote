import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

type SettingsObject = Record<string, unknown>;

const SETTINGS_PATHS: Record<string, string> = {
  "inknote.locale": "locale",
  "mdnote.theme": "appearance.colorTheme",
  "mdnote.markdownTheme": "appearance.markdownTheme",
  "mdnote.customCss": "appearance.customCssPath",
  "mdnote.lastFolder": "workspace.lastFolder",
  "mdnote.workspaceFolders": "workspace.folders",
  "mdnote.lastFile": "workspace.lastFile",
  "mdnote.sidebarTab": "workspace.sidebarTab",
  "mdnote.recent": "workspace.recentFiles",
  "mdnote.treeExpansion": "workspace.treeExpansion",
};

/**
 * 多窗口槽位键：这些键按窗口 label 隔离到 `windows.<label>.*` 子树。
 * 其余键（偏好、主题、快捷键、AI 等）保持全局共享。
 */
const WINDOW_SCOPED_KEYS = new Set([
  "mdnote.workspaceFolders",
  "mdnote.lastFile",
  "mdnote.sidebarTab",
  "mdnote.treeExpansion",
]);

let settings: SettingsObject = {};
let initialized = false;
let saveChain: Promise<unknown> = Promise.resolve();
let windowLabel = resolveWindowLabel();

/** 非 Tauri 环境（测试）回落到 main 槽位。 */
function resolveWindowLabel(): string {
  try {
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      return getCurrentWindow().label || "main";
    }
  } catch {
    /* fall through */
  }
  return "main";
}

function pathFor(key: string): string[] {
  const mapped = SETTINGS_PATHS[key]
    ?? (key.startsWith("mdnote.") ? `preferences.${key.slice("mdnote.".length)}` : key);
  const parts = mapped.split(".");
  if (WINDOW_SCOPED_KEYS.has(key)) {
    return ["windows", windowLabel, ...parts];
  }
  return parts;
}

function readPath(path: string[]): unknown {
  let current: unknown = settings;
  for (const part of path) {
    if (!current || typeof current !== "object" || !(part in current)) return undefined;
    current = (current as SettingsObject)[part];
  }
  return current;
}

function writePath(path: string[], value: unknown) {
  let current = settings;
  for (const part of path.slice(0, -1)) {
    const child = current[part];
    if (!child || typeof child !== "object" || Array.isArray(child)) current[part] = {};
    current = current[part] as SettingsObject;
  }
  current[path[path.length - 1]] = value;
}

function removePath(path: string[]) {
  let current: SettingsObject = settings;
  for (const part of path.slice(0, -1)) {
    const child = current[part];
    if (!child || typeof child !== "object" || Array.isArray(child)) return;
    current = child as SettingsObject;
  }
  delete current[path[path.length - 1]];
}

function canInvokeTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** 待写入的增量变更：整包快照会让多窗口互相覆盖，必须按路径合并写入。 */
type PendingSetting = { path: string[]; value: unknown | null };
let pendingWrites: PendingSetting[] = [];

async function flushPendingWrites(): Promise<void> {
  const batch = pendingWrites;
  pendingWrites = [];
  for (const write of batch) {
    await invoke<void>("save_setting", { path: write.path, value: write.value });
  }
}

function persist(path: string[], value: unknown | null) {
  if (!canInvokeTauri()) return;
  pendingWrites.push({ path: [...path], value });
  saveChain = saveChain
    .catch(() => undefined)
    .then(flushPendingWrites)
    .catch((error) => console.error("保存设置失败", error));
}

/** 在 React 渲染前载入 JSON，并把旧版 localStorage 设置一次性迁移过去。 */
export async function initializeSettingsStore() {
  if (initialized) return;
  initialized = true;

  if (canInvokeTauri()) {
    try {
      const loaded = await invoke<SettingsObject>("load_app_settings");
      if (loaded && typeof loaded === "object" && !Array.isArray(loaded)) settings = loaded;
    } catch (error) {
      console.error("读取设置失败，将使用默认设置", error);
    }
  }

  // 会话恢复已移除：清理旧设置，避免历史草稿再次覆盖用户刚打开的文件。
  if (readPath(["recovery", "snapshot"]) !== undefined) {
    removePath(["recovery", "snapshot"]);
    persist(["recovery", "snapshot"], null);
  }
  // 多窗口槽位迁移：旧的全局 workspace 键由 main 窗口接管一次。
  // 旧键保留一个版本周期（回滚路径），槽位缺失时回读旧键。
  if (windowLabel === "main") {
    for (const key of WINDOW_SCOPED_KEYS) {
      const legacyPath = (SETTINGS_PATHS[key] ?? "").split(".");
      const scopedPath = pathFor(key);
      const legacyValue = readPath(legacyPath);
      if (legacyPath.length > 1 && legacyValue !== undefined && readPath(scopedPath) === undefined) {
        writePath(scopedPath, legacyValue);
        persist(scopedPath, legacyValue);
      }
    }
  }
  if (typeof localStorage !== "undefined") {
    const legacyKeys = [
      "inknote.locale",
      "mdnote.theme",
      "mdnote.markdownTheme",
      "mdnote.customCss",
      "mdnote.lastFolder",
      "mdnote.workspaceFolders",
      "mdnote.lastFile",
      "mdnote.sidebarTab",
      "mdnote.recent",
      "mdnote.fontSize",
      "mdnote.lineHeight",
      "mdnote.editorWidthPreset",
      "mdnote.focusMaxWidth",
      "mdnote.defaultEditorMode",
      "mdnote.lineNumbers",
      "mdnote.wordWrap",
      "mdnote.tabSize",
      "mdnote.spellCheck",
      "mdnote.restoreLastFolder",
      "mdnote.restoreLastFile",
      "mdnote.fontFamily",
      "mdnote.monoFontFamily",
      "mdnote.editorZoom",
      "mdnote.sidebarVisible",
      "mdnote.sidebarWidth",
      "mdnote.defaultSidebarTab",
      "mdnote.confirmDiscard",
      "mdnote.confirmDelete",
      "mdnote.recentFilesLimit",
      "mdnote.showStatusBar",
      "mdnote.typewriterPadding",
      "mdnote.externalOpenReadOnly",
      "mdnote.newDocumentMetadata",
      "mdnote.metadataTitle",
      "mdnote.metadataAuthor",
      "mdnote.treeExpansion",
    ];
    for (const key of legacyKeys) {
      const value = localStorage.getItem(key);
      if (value !== null && readPath(pathFor(key)) === undefined) {
        writePath(pathFor(key), value);
        persist(pathFor(key), value);
      }
      localStorage.removeItem(key);
    }
    localStorage.removeItem("mdnote.sessionRecovery");
  }
}

export function getStoredValue(key: string): string | null {
  const value = readPath(pathFor(key));
  return value === undefined || value === null ? null : String(value);
}

export function setStoredValue(key: string, value: string) {
  const path = pathFor(key);
  writePath(path, value);
  persist(path, value);
}

export function removeStoredValue(key: string) {
  const path = pathFor(key);
  removePath(path);
  persist(path, null);
}

/** 等待已经排队的设置写入完成，供应用退出前调用。 */
export async function flushSettingsStore(): Promise<void> {
  await saveChain;
}

export function resetSettingsStoreForTests() {
  settings = {};
  initialized = false;
  saveChain = Promise.resolve();
  pendingWrites = [];
  windowLabel = resolveWindowLabel();
}
