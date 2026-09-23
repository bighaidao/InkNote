import { invoke } from "@tauri-apps/api/core";
import { listDir } from "./tauri";
import { basename } from "./paths";

export interface SearchMatch {
  path: string;
  line: number;
  lineText: string;
  matchStart: number;
  matchEnd: number;
}

const MD_EXT = /\.(md|markdown)$/i;
const FILE_CACHE_MS = 5000;
let fileCache: { key: string; time: number; value: Promise<string[]> } | null = null;

export function invalidateWorkspaceFileCache() {
  fileCache = null;
}

async function collectMarkdownFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  const queue = [root];

  while (queue.length > 0) {
    const dir = queue.shift()!;
    try {
      const entries = await listDir(dir);
      for (const e of entries) {
        if (e.is_dir) {
          if (!e.name.startsWith(".")) queue.push(e.path);
        } else if (MD_EXT.test(e.name)) {
          out.push(e.path);
        }
      }
    } catch {
      /* skip unreadable dirs */
    }
  }

  return out;
}

async function resolveSearchFiles(folderPaths: string[], recentFiles: string[]): Promise<string[]> {
  const key = JSON.stringify([folderPaths, recentFiles]);
  if (fileCache?.key === key && Date.now() - fileCache.time < FILE_CACHE_MS) {
    return fileCache.value;
  }
  const value = resolveSearchFilesUncached(folderPaths, recentFiles);
  fileCache = { key, time: Date.now(), value };
  return value;
}

async function resolveSearchFilesUncached(folderPaths: string[], recentFiles: string[]): Promise<string[]> {
  const paths = new Set<string>();

  for (const folderPath of folderPaths) {
    const files = await collectMarkdownFiles(folderPath);
    for (const f of files) paths.add(f);
  }

  for (const p of recentFiles) {
    if (MD_EXT.test(p)) paths.add(p);
  }

  return [...paths];
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
  });
}

export function hasSearchScope(folderPaths: string[], recentFiles: string[]): boolean {
  return folderPaths.length > 0 || recentFiles.some((p) => MD_EXT.test(p));
}
