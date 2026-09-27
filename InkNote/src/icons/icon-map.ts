import { VSCODE_ICONS, type IconDefinition } from "./iconData";

/**
 * 特殊文件名直接精确映射（大小写无关）
 */
const EXACT_FILE_MAP: Record<string, string> = {
  "package.json": "json",
  "tsconfig.json": "typescript",
  "tsconfig.node.json": "typescript",
  "cargo.toml": "rust",
  "cargo.lock": "rust",
  ".gitignore": "git",
  ".gitattributes": "git",
  ".gitmodules": "git",
  "dockerfile": "shell",
  "readme.md": "markdown",
  "license": "file",
};

/**
 * 扩展名分类映射字典
 */
const EXT_TO_ICON_KEY: Record<string, string> = {
  // Python
  py: "python",
  pyw: "python",
  ipynb: "python",

  // TypeScript / JavaScript
  ts: "typescript",
  tsx: "typescript",
  mts: "typescript",
  cts: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",

  // Rust / Go / C / C++
  rs: "rust",
  go: "go",
  c: "file",
  h: "file",
  cpp: "file",
  hpp: "file",

  // Web 前端
  html: "html",
  htm: "html",
  css: "css",
  scss: "css",
  sass: "css",
  less: "css",
  vue: "javascript",
  svelte: "javascript",

  // 文档与标记
  md: "markdown",
  markdown: "markdown",
  txt: "file",
  log: "file",

  // 配置与数据
  json: "json",
  json5: "json",
  yaml: "json",
  yml: "json",
  toml: "json",
  xml: "html",
  ini: "settings",
  cfg: "settings",
  conf: "settings",
  env: "settings",

  // 微软 Office
  doc: "word",
  docx: "word",
  docm: "word",
  dot: "word",
  rtf: "word",
  odt: "word",

  xls: "excel",
  xlsx: "excel",
  xlsm: "excel",
  xlsb: "excel",
  csv: "excel",
  tsv: "excel",

  ppt: "powerpoint",
  pptx: "powerpoint",
  pps: "powerpoint",
  pptm: "powerpoint",
  odp: "powerpoint",

  // PDF
  pdf: "pdf",

  // 压缩包与镜像
  zip: "archive",
  rar: "archive",
  "7z": "archive",
  tar: "archive",
  gz: "archive",
  tgz: "archive",
  bz2: "archive",
  xz: "archive",

  // 图片与媒体
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  svg: "image",
  bmp: "image",
  ico: "image",
  avif: "image",

  // 数据库与脚本
  sql: "database",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  fish: "shell",
  ps1: "shell",
  bat: "shell",
  cmd: "shell",
};

/**
 * 解析业务图标 Key
 */
export function resolveBizIconKey(name: string, isDir = false, isOpen = false): string {
  if (isDir) {
    return isOpen ? "folder-open" : "folder";
  }
  const lowerName = name.toLowerCase();
  if (EXACT_FILE_MAP[lowerName]) {
    return EXACT_FILE_MAP[lowerName];
  }
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex <= 0) return "file";
  const ext = name.slice(dotIndex + 1).toLowerCase();
  return EXT_TO_ICON_KEY[ext] ?? "file";
}

/**
 * 获取图标定义
 */
export function resolveBizIcon(name: string, isDir = false, isOpen = false): IconDefinition {
  const key = resolveBizIconKey(name, isDir, isOpen);
  return VSCODE_ICONS[key] ?? VSCODE_ICONS.file;
}
