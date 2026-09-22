import { getStoredValue, setStoredValue } from "./settingsStore";

const KEY = "mdnote.treeExpansion";
const PERSIST_DEBOUNCE_MS = 300;

export interface TreeExpansionState {
  rootExpanded: boolean;
  expanded: string[];
}

type StoredTreeStates = Record<string, TreeExpansionState>;

/**
 * 内存缓存：readStates/getStoredValue 每次都要 JSON.parse，
 * 缓存后读路径零解析；写路径把高频 toggle 合并成一次持久化。
 */
let cache: StoredTreeStates | null = null;
/** 待持久化的变更（value 为 null 表示删除该根）。 */
let pending = new Map<string, TreeExpansionState | null>();
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function readStates(): StoredTreeStates {
  if (cache) return cache;
  try {
    const parsed = JSON.parse(getStoredValue(KEY) ?? "{}");
    cache = parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as StoredTreeStates
      : {};
  } catch {
    cache = {};
  }
  return cache;
}

function serialize(states: StoredTreeStates): string {
  const compact: StoredTreeStates = {};
  for (const [root, value] of Object.entries(states)) {
    compact[root] = {
      rootExpanded: value.rootExpanded,
      expanded: [...new Set(value.expanded)],
    };
  }
  return JSON.stringify(compact);
}

function flushPersist() {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  if (!pending.size) return;
  const states = readStates();
  for (const [root, value] of pending) {
    if (value === null) delete states[root];
    else states[root] = value;
  }
  pending = new Map();
  setStoredValue(KEY, serialize(states));
}

function schedulePersist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(flushPersist, PERSIST_DEBOUNCE_MS);
}

export function getTreeExpansion(rootPath: string): TreeExpansionState {
  const value = readStates()[rootPath];
  return {
    rootExpanded: value?.rootExpanded !== false,
    expanded: Array.isArray(value?.expanded)
      ? value.expanded.filter((path): path is string => typeof path === "string")
      : [],
  };
}

export function setTreeExpansion(rootPath: string, value: TreeExpansionState) {
  readStates()[rootPath] = {
    rootExpanded: value.rootExpanded,
    expanded: [...new Set(value.expanded)],
  };
  pending.set(rootPath, value);
  schedulePersist();
}

export function removeTreeExpansion(rootPath: string) {
  const states = readStates();
  if (!(rootPath in states)) return;
  delete states[rootPath];
  pending.set(rootPath, null);
  schedulePersist();
}

/** 立即写入挂起的树展开状态；应用退出/窗口关闭前调用，避免去抖窗口内丢状态。 */
export function flushTreeExpansionPersist() {
  flushPersist();
}

/** 测试专用：清空内存缓存与挂起写，重新从存储读取。 */
export function resetTreeStateForTests() {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  cache = null;
  pending = new Map();
}

if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("pagehide", flushPersist);
}
