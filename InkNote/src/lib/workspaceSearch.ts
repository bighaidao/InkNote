import { invoke } from "@tauri-apps/api/core";
import { basename } from "./paths";
import { getSearchExcludedDirs } from "../preview/previewSettings";
import whitelist from "../preview/searchableExtensions.json";

export interface SearchMatch {
  path: string;
  line: number;
  lineText: string;
  matchStart: number;
  matchEnd: number;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 内容搜索收录范围：与 Rust 侧 fs::is_searchable_text_ext 同源（searchableExtensions.json）。 */
const SEARCHABLE_EXT_RE = new RegExp(
  `\\.(${whitelist.searchableTextExtensions.map(escapeRegExp).join("|")})$`,
  "i",
);

const FILE_CACHE_MS = 5000;
let fileCache: { key: string; time: number; value: Promise<string[]> } | null = null;

export function invalidateWorkspaceFileCache() {
  fileCache = null;
}

/** 文件名列表（快速打开 / 文件树过滤）：Rust 一次 IPC 遍历全部可预览扩展名。 */
function listWorkspaceFilesUncached(
  folderPaths: string[],
  recentFiles: string[],
): Promise<string[]> {
  return invoke<string[]>("list_workspace_files", {
    roots: folderPaths,
    recentFiles,
    excludedDirs: getSearchExcludedDirs(),
  });
}

async function resolveSearchFiles(folderPaths: string[], recentFiles: string[]): Promise<string[]> {
  const key = JSON.stringify([folderPaths, recentFiles]);
  if (fileCache?.key === key && Date.now() - fileCache.time < FILE_CACHE_MS) {
    return fileCache.value;
  }
  const value = listWorkspaceFilesUncached(folderPaths, recentFiles);
  fileCache = { key, time: Date.now(), value };
  return value;
}

export async function listWorkspaceFiles(
  folderPaths: string[],
  recentFiles: string[],
): Promise<string[]> {
  return resolveSearchFiles(folderPaths, recentFiles);
}

export function scorePathMatch(query: string, path: string): number {
  const name = basename(path).toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return 1;
  if (name === q) return 100;
  if (name.startsWith(q)) return 80;
  if (name.includes(q)) return 60;
  if (path.toLowerCase().includes(q)) return 40;
  return 0;
}

export interface SearchOptions {
  filenameOnly?: boolean;
  useRegex?: boolean;
}

/**
 * 全库搜索：内容匹配整体在 Rust 侧执行（资源评估 §7-P1-3），
 * 只回传命中行，不再把全文拉进 JS。语义与旧 JS 实现逐条对齐（含结果不封顶）。
 */
export async function searchWorkspace(
  folderPaths: string[],
  recentFiles: string[],
  query: string,
  opts: SearchOptions = {},
): Promise<{ matches: SearchMatch[]; fileCount: number }> {
  const q = query.trim();
  if (!q) return { matches: [], fileCount: 0 };

  return invoke<{ matches: SearchMatch[]; fileCount: number }>("search_workspace", {
    roots: folderPaths,
    recentFiles,
    query: q,
    useRegex: opts.useRegex === true,
    filenameOnly: opts.filenameOnly === true,
    excludedDirs: getSearchExcludedDirs(),
  });
}

export function hasSearchScope(folderPaths: string[], recentFiles: string[]): boolean {
  return folderPaths.length > 0 || recentFiles.some((p) => SEARCHABLE_EXT_RE.test(p));
}
