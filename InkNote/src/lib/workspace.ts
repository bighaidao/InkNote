import { getDefaultSidebarTab } from "./preferences";
import { isPathUnder, remapPath } from "./paths";
import { getStoredValue, removeStoredValue, setStoredValue } from "./settingsStore";

const FOLDERS_KEY = "mdnote.workspaceFolders";
const FILE_KEY = "mdnote.lastFile";
const SIDEBAR_TAB_KEY = "mdnote.sidebarTab";

/**
 * 多根工作区（窗口槽位私有）。
 *
 * 注意：这里绝不回退读取任何全局键——旧版全局 lastFolder 由 settingsStore
 * 的初始化迁移一次性接管到 windows.main 槽位；槽位为空即空工作区，
 * 否则新窗口会继承其他窗口的项目（跨窗口污染）。
 */
export function getWorkspaceFolders(): string[] {
  const raw = getStoredValue(FOLDERS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((path): path is string => typeof path === "string" && path.trim().length > 0))];
  } catch {
    return [];
  }
}

export function setWorkspaceFolders(paths: string[]) {
  const folders = [...new Set(paths.map((path) => path.trim()).filter(Boolean))];
  setStoredValue(FOLDERS_KEY, JSON.stringify(folders));
}

export function getLastFile(): string | null {
  return getStoredValue(FILE_KEY);
}

export function setLastFile(path: string) {
  setStoredValue(FILE_KEY, path);
}

export function clearLastFile() {
  removeStoredValue(FILE_KEY);
}

export function remapLastFile(oldPath: string, newPath: string) {
  const path = getLastFile();
  if (path) setLastFile(remapPath(path, oldPath, newPath));
}

export function clearLastFileUnder(path: string) {
  const current = getLastFile();
  if (current && isPathUnder(current, path)) clearLastFile();
}

export type SavedSidebarTab = "files" | "outline" | "recent";

export function getSidebarTab(): SavedSidebarTab {
  const v = getStoredValue(SIDEBAR_TAB_KEY);
  if (v === "outline" || v === "recent" || v === "files") return v;
  return getDefaultSidebarTab();
}

export function setSidebarTab(tab: SavedSidebarTab) {
  setStoredValue(SIDEBAR_TAB_KEY, tab);
}
