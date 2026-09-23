import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  listDir: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mocks.invoke,
}));

vi.mock("./tauri", () => ({
  listDir: mocks.listDir,
}));

import { invalidateWorkspaceFileCache, listWorkspaceFiles, searchWorkspace } from "./workspaceSearch";

describe("workspace search", () => {
  beforeEach(() => {
    mocks.invoke.mockReset();
    mocks.listDir.mockReset();
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

  it("refreshes the file list after workspace changes invalidate the cache", async () => {
    mocks.listDir
      .mockResolvedValueOnce([{ name: "old.md", path: "D:\\notes\\old.md", is_dir: false }])
      .mockResolvedValueOnce([{ name: "new.md", path: "D:\\notes\\new.md", is_dir: false }]);

    expect(await listWorkspaceFiles(["D:\\notes"], [])).toEqual(["D:\\notes\\old.md"]);
    invalidateWorkspaceFileCache();
    expect(await listWorkspaceFiles(["D:\\notes"], [])).toEqual(["D:\\notes\\new.md"]);
  });
});
