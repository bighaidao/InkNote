import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  flushTreeExpansionPersist,
  getTreeExpansion,
  removeTreeExpansion,
  resetTreeStateForTests,
  setTreeExpansion,
} from "./treeState";
import { getStoredValue, resetSettingsStoreForTests } from "./settingsStore";

describe("treeState persistence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetSettingsStoreForTests();
    resetTreeStateForTests();
  });

  afterEach(() => {
    flushTreeExpansionPersist();
    resetSettingsStoreForTests();
    resetTreeStateForTests();
    vi.useRealTimers();
  });

  it("falls back to an expanded root with no saved folders", () => {
    expect(getTreeExpansion("/tmp/project")).toEqual({ rootExpanded: true, expanded: [] });
  });

  it("persists expansion and reads it back", () => {
    setTreeExpansion("/tmp/project", { rootExpanded: true, expanded: ["a", "a/b"] });
    expect(getTreeExpansion("/tmp/project")).toEqual({
      rootExpanded: true,
      expanded: ["a", "a/b"],
    });
  });

  it("persists changes synchronously when flushed and deduplicates them", () => {
    setTreeExpansion("/tmp/a", { rootExpanded: true, expanded: ["x", "x", "y"] });
    flushTreeExpansionPersist();
    const stored = JSON.parse(getStoredValue("mdnote.treeExpansion") ?? "{}") as {
      [key: string]: { expanded: string[] };
    };
    expect(stored["/tmp/a"].expanded).toEqual(["x", "y"]);
  });

  it("batches rapid toggles into one persisted write", () => {
    setTreeExpansion("/tmp/a", { rootExpanded: true, expanded: ["1"] });
    setTreeExpansion("/tmp/a", { rootExpanded: true, expanded: ["1", "2"] });
    setTreeExpansion("/tmp/b", { rootExpanded: false, expanded: [] });
    // 去抖窗口内不落盘
    expect(getStoredValue("mdnote.treeExpansion")).toBeNull();
    vi.advanceTimersByTime(300);
    const stored = JSON.parse(getStoredValue("mdnote.treeExpansion") ?? "{}");
    expect(Object.keys(stored).sort()).toEqual(["/tmp/a", "/tmp/b"]);
    expect(stored["/tmp/a"].expanded).toEqual(["1", "2"]);
    expect(stored["/tmp/b"].rootExpanded).toBe(false);
  });

  it("removes roots from the persisted state", () => {
    setTreeExpansion("/tmp/a", { rootExpanded: true, expanded: ["x"] });
    flushTreeExpansionPersist();
    removeTreeExpansion("/tmp/a");
    flushTreeExpansionPersist();
    const stored = JSON.parse(getStoredValue("mdnote.treeExpansion") ?? "{}");
    expect(stored["/tmp/a"]).toBeUndefined();
    expect(getTreeExpansion("/tmp/a")).toEqual({ rootExpanded: true, expanded: [] });
  });
});
