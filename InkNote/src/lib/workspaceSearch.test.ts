import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mocks.invoke,
}));

import { invalidateWorkspaceFileCache, listWorkspaceFiles, searchWorkspace } from "./workspaceSearch";

vi.mock("../preview/previewSettings", () => ({
  getSearchExcludedDirs: vi.fn(() => []),
}));

describe("workspace search", () => {
  beforeEach(() => {
    mocks.invoke.mockReset();
    invalidateWorkspaceFileCache();
  });

  it("passes trimmed query and options through to the native search", async () => {
    mocks.invoke.mockResolvedValue({ matches: [], fileCount: 0 });

    await searchWorkspace(["D:\\notes"], ["D:\\recent.md"], "  needle  ", {
      useRegex: true,
      filenameOnly: true,
    });

    expect(mocks.invoke).toHaveBeenCalledWith("search_workspace", {
      roots: ["D:\\notes"],
      recentFiles: ["D:\\recent.md"],
      query: "needle",
      useRegex: true,
      filenameOnly: true,
      excludedDirs: [],
    });
  });

  it("short-circuits empty queries without touching the backend", async () => {
    const result = await searchWorkspace(["D:\\notes"], [], "   ");

    expect(result).toEqual({ matches: [], fileCount: 0 });
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it("returns the native result unchanged", async () => {
    const native = {
      matches: [
        { path: "D:\\notes\\a.md", line: 3, lineText: "needle here", matchStart: 0, matchEnd: 6 },
      ],
      fileCount: 7,
    };
    mocks.invoke.mockResolvedValue(native);

    expect(await searchWorkspace(["D:\\notes"], [], "needle")).toEqual(native);
  });

  it("lists workspace files through the native traversal command", async () => {
    mocks.invoke.mockResolvedValue(["D:\\notes\\a.md", "D:\\notes\\doc.pdf"]);

    await listWorkspaceFiles(["D:\\notes"], []);

    expect(mocks.invoke).toHaveBeenCalledWith("list_workspace_files", {
      roots: ["D:\\notes"],
      recentFiles: [],
      excludedDirs: [],
    });
  });

  it("refreshes the file list after workspace changes invalidate the cache", async () => {
    mocks.invoke
      .mockResolvedValueOnce(["D:\\notes\\old.md"])
      .mockResolvedValueOnce(["D:\\notes\\new.md"]);

    expect(await listWorkspaceFiles(["D:\\notes"], [])).toEqual(["D:\\notes\\old.md"]);
    invalidateWorkspaceFileCache();
    expect(await listWorkspaceFiles(["D:\\notes"], [])).toEqual(["D:\\notes\\new.md"]);
  });

  it("caches repeated calls within the TTL window", async () => {
    mocks.invoke.mockResolvedValue(["D:\\notes\\a.md"]);

    await listWorkspaceFiles(["D:\\notes"], []);
    await listWorkspaceFiles(["D:\\notes"], []);

    expect(mocks.invoke).toHaveBeenCalledTimes(1);
  });
});
