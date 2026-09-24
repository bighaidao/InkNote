import whitelist from "./searchableExtensions.json";

export type PreviewCategory =
  | "text"
  | "image"
  | "pdf"
  | "epub"
  | "office-word"
  | "office-sheet"
  | "office-slides"
  | "archive"
  | "email";

/** 这些扩展名永远走 Markdown 文档链路（现有编辑器），不进预览。 */
const DOCUMENT_EXTS = new Set<string>(["md", "markdown", "txt"]);

/** 二进制/专用格式的分类映射；与 searchableExtensions.json 的 previewableExtensions 必须一致（由单测防护）。 */
const BINARY_CATEGORY_EXTS: Record<Exclude<PreviewCategory, "text">, string[]> = {
  image: ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif"],
  pdf: ["pdf"],
  epub: ["epub"],
  "office-word": ["doc", "docx", "docm", "dot", "rtf", "odt"],
  "office-sheet": ["xls", "xlsx", "xlsm", "xlsb"],
  "office-slides": ["ppt", "pps", "pptx", "pptm", "odp"],
  archive: ["zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "xz"],
  email: ["eml", "msg", "mbox"],
};

/** 前端展示用的单类大小上限；Rust 侧另有 200MB 全局硬护栏（fs::PREVIEW_MAX_BYTES）。 */
export const PREVIEW_SIZE_LIMITS: Record<PreviewCategory, number> = {
  text: 10 * 1024 * 1024,
  image: 100 * 1024 * 1024,
  pdf: 200 * 1024 * 1024,
  epub: 100 * 1024 * 1024,
  "office-word": 100 * 1024 * 1024,
  "office-sheet": 50 * 1024 * 1024,
  "office-slides": 100 * 1024 * 1024,
  archive: 200 * 1024 * 1024,
  email: 20 * 1024 * 1024,
};

const SEARCHABLE_EXTS: readonly string[] = whitelist.searchableTextExtensions;

const EXT_TO_CATEGORY = new Map<string, PreviewCategory>();
for (const ext of SEARCHABLE_EXTS) {
  if (!DOCUMENT_EXTS.has(ext)) EXT_TO_CATEGORY.set(ext, "text");
}
for (const [category, exts] of Object.entries(BINARY_CATEGORY_EXTS)) {
  for (const ext of exts) EXT_TO_CATEGORY.set(ext, category as PreviewCategory);
}

/** 单一判定入口：返回 null 表示不走预览（Markdown 文档链路或未知格式）。 */
export function classifyPath(path: string): PreviewCategory | null {
  const name = path.replace(/\\/g, "/").split("/").pop() ?? "";
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return null; // 无后缀 / .gitignore 类隐藏名不判类
  const ext = name.slice(dot + 1).toLowerCase();
  if (!/^[a-z0-9]+$/.test(ext)) return null;
  return EXT_TO_CATEGORY.get(ext) ?? null;
}

export function isPreviewPath(path: string): boolean {
  return classifyPath(path) !== null;
}

/** 供测试与调试：白名单 JSON 的 previewableExtensions 应与二进制分类映射一致。 */
export function binaryWhitelistExts(): string[] {
  return Object.values(BINARY_CATEGORY_EXTS).flat();
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
