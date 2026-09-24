import { getStoredValue, setStoredValue } from "../lib/settingsStore";
import type { PreviewCategory } from "./previewRegistry";

/**
 * 预览与搜索的运行时配置（设计文档 §模块五「预览与文件」专区）。
 * 存储复用 settingsStore 的通用键值（preferences.*），值为 JSON 字符串。
 */

export type PreviewFeature = "text" | "image" | "pdf" | "office" | "archive" | "email";

const PREVIEW_FEATURES_KEY = "mdnote.previewFeatures";
const EXCLUDED_DIRS_KEY = "mdnote.searchExcludedDirs";

const FEATURE_DEFAULTS: Record<PreviewFeature, boolean> = {
  text: true,
  image: true,
  pdf: true,
  office: true,
  archive: true,
  email: true,
};

/** 预览分类 → 设置开关（office 三子类共用一个开关；epub 归入 pdf 开关）。 */
const CATEGORY_FEATURE: Record<PreviewCategory, PreviewFeature> = {
  text: "text",
  image: "image",
  pdf: "pdf",
  epub: "pdf",
  "office-word": "office",
  "office-sheet": "office",
  "office-slides": "office",
  archive: "archive",
  email: "email",
};

function readFeatures(): Record<PreviewFeature, boolean> {
  const raw = getStoredValue(PREVIEW_FEATURES_KEY);
  if (!raw) return { ...FEATURE_DEFAULTS };
  try {
    const parsed = JSON.parse(raw) as Partial<Record<PreviewFeature, boolean>>;
    return { ...FEATURE_DEFAULTS, ...parsed };
  } catch {
    return { ...FEATURE_DEFAULTS };
  }
}

export function isPreviewCategoryEnabled(category: PreviewCategory): boolean {
  return readFeatures()[CATEGORY_FEATURE[category]];
}

export function getPreviewFeatures(): Record<PreviewFeature, boolean> {
  return readFeatures();
}

export function setPreviewFeatureEnabled(feature: PreviewFeature, enabled: boolean): void {
  setStoredValue(PREVIEW_FEATURES_KEY, JSON.stringify({ ...readFeatures(), [feature]: enabled }));
}

export const DEFAULT_EXCLUDED_DIRS = ["node_modules", ".next", ".cache", "dist", "target"];
const HIDE_HIDDEN_FILES_KEY = "mdnote.hideHiddenFiles";

/** 是否自动过滤以点（.）开头的隐藏文件与文件夹（默认开启）。 */
export function getHideHiddenFiles(): boolean {
  const raw = getStoredValue(HIDE_HIDDEN_FILES_KEY);
  if (raw === null || raw === undefined) return true;
  return raw === "true";
}

export function setHideHiddenFiles(hide: boolean): void {
  setStoredValue(HIDE_HIDDEN_FILES_KEY, String(hide));
}

/** 搜索/快速打开/文件树的排除目录名（按目录名匹配，任意深度生效）。 */
export function getSearchExcludedDirs(): string[] {
  const raw = getStoredValue(EXCLUDED_DIRS_KEY);
  if (!raw) return [...DEFAULT_EXCLUDED_DIRS];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [...DEFAULT_EXCLUDED_DIRS];
    const userDirs = parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    // 合并默认排除项与用户自定义项，确保 node_modules, .next, .cache 等默认项始终有效
    return [...new Set([...DEFAULT_EXCLUDED_DIRS, ...userDirs])];
  } catch {
    return [...DEFAULT_EXCLUDED_DIRS];
  }
}

export function setSearchExcludedDirs(list: string[]): void {
  setStoredValue(EXCLUDED_DIRS_KEY, JSON.stringify(list.map((item) => item.trim()).filter(Boolean)));
}

