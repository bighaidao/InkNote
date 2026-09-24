import { readBinaryFile } from "../lib/tauri";

/**
 * 预览 Blob 缓存（LRU）。
 *
 * 上限：5 条；单条上限由 Rust 侧 PREVIEW_MAX_BYTES（200MB）硬护栏保证。
 * 正在被挂载中的预览 Tab 引用的条目不会被淘汰（active 集合），
 * 因此实际内存上界 = 打开中的预览 Tab 的文件体积之和；关闭 Tab 时调用 release 释放。
 */
const MAX_ENTRIES = 5;

interface CacheEntry {
  blob: Blob;
  url: string;
}

const cache = new Map<string, CacheEntry>();
const active = new Set<string>();

export function markPreviewActive(path: string): void {
  active.add(path);
}

export function markPreviewInactive(path: string): void {
  active.delete(path);
}

function evictOverflow(protect: string): void {
  while (cache.size > MAX_ENTRIES) {
    const victim = [...cache.keys()].find((path) => path !== protect && !active.has(path));
    if (!victim) return; // 全部在用：宁可不淘汰，也不吊销正在显示的 URL
    const entry = cache.get(victim)!;
    URL.revokeObjectURL(entry.url);
    cache.delete(victim);
  }
}

export async function acquirePreviewBlob(path: string): Promise<Blob> {
  const cached = cache.get(path);
  if (cached) {
    // 触达即刷新 LRU 顺序（Map 迭代按插入序，删除再插入 = 移到最新）
    cache.delete(path);
    cache.set(path, cached);
    return cached.blob;
  }
  const buffer = await readBinaryFile(path);
  const blob = new Blob([buffer]);
  const entry: CacheEntry = { blob, url: URL.createObjectURL(blob) };
  cache.set(path, entry);
  evictOverflow(path);
  return blob;
}

/** 关闭预览 Tab 时调用：吊销 URL 并移出缓存。 */
export function releasePreviewBlob(path: string): void {
  const entry = cache.get(path);
  if (entry) {
    URL.revokeObjectURL(entry.url);
    cache.delete(path);
  }
  active.delete(path);
}

/** 仅测试用：清空全部缓存。 */
export function resetPreviewAssetsForTest(): void {
  for (const entry of cache.values()) URL.revokeObjectURL(entry.url);
  cache.clear();
  active.clear();
}
