import {
  Database,
  File,
  FileArchive,
  FileCode,
  FileCog,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileTerminal,
  Presentation,
  type LucideIcon,
} from "lucide-react";

/**
 * 文件树格式感知图标（设计文档 §3.1）：按扩展名返回 lucide 图标组件。
 * 纯函数映射，与 previewRegistry 的分类语义保持一致但不耦合其代码。
 */
const EXT_ICONS: Array<{ exts: string[]; icon: LucideIcon }> = [
  { exts: ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif"], icon: FileImage },
  { exts: ["pdf"], icon: FileText },
  { exts: ["doc", "docx", "docm", "dot", "rtf", "odt"], icon: FileText },
  { exts: ["xls", "xlsx", "xlsm", "xlsb"], icon: FileSpreadsheet },
  { exts: ["ppt", "pps", "pptx", "pptm", "odp"], icon: Presentation },
  { exts: ["zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "xz"], icon: FileArchive },
  { exts: ["json", "json5", "yaml", "yml", "toml", "xml", "ini", "cfg", "conf", "properties", "env", "editorconfig"], icon: FileCog },
  { exts: ["ts", "tsx", "js", "jsx", "mjs", "cjs", "vue", "svelte", "py", "go", "rs", "rb", "php", "java", "kt", "swift", "c", "h", "cpp", "hpp", "cc", "hh", "cs", "m", "mm", "dart", "scala", "groovy", "gradle", "lua", "pl", "r", "zig", "ex", "exs", "erl", "hs", "clj", "vim"], icon: FileCode },
  { exts: ["sql"], icon: Database },
  { exts: ["sh", "bash", "zsh", "fish", "ps1", "bat", "cmd"], icon: FileTerminal },
  { exts: ["md", "markdown", "txt", "log", "epub"], icon: FileText },
  { exts: ["html", "htm", "css", "scss", "sass", "less"], icon: FileCode },
  { exts: ["eml", "msg", "mbox"], icon: FileText },
];

const EXT_ICON_MAP = new Map<string, LucideIcon>();
for (const group of EXT_ICONS) {
  for (const ext of group.exts) {
    if (!EXT_ICON_MAP.has(ext)) EXT_ICON_MAP.set(ext, group.icon);
  }
}

export function fileTypeIcon(name: string): LucideIcon {
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return File;
  const ext = name.slice(dot + 1).toLowerCase();
  return EXT_ICON_MAP.get(ext) ?? File;
}
