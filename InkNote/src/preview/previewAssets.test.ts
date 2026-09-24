import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readBinaryFile: vi.fn(),
}));

vi.mock("../lib/tauri", () => ({
  readBinaryFile: mocks.readBinaryFile,
}));

import {
  acquirePreviewBlob,
  markPreviewActive,
  markPreviewInactive,
  releasePreviewBlob,
  resetPreviewAssetsForTest,
} from "./previewAssets";

function fakeBuffer(size: number): ArrayBuffer {
  return new ArrayBuffer(size);
}

beforeEach(() => {
  mocks.readBinaryFile.mockReset();
  resetPreviewAssetsForTest();
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: vi.fn(() => `blob:mock-${Math.random()}`),
    revokeObjectURL: vi.fn(),
  });
});

describe("previewAssets", () => {
  it("caches blobs per path and reads the file only once", async () => {
    mocks.readBinaryFile.mockResolvedValue(fakeBuffer(8));

    const first = await acquirePreviewBlob("/notes/a.pdf");
    const second = await acquirePreviewBlob("/notes/a.pdf");

    expect(second).toBe(first);
    expect(mocks.readBinaryFile).toHaveBeenCalledTimes(1);
  });

  it("evicts the least-recently-used inactive entry beyond 5", async () => {
    mocks.readBinaryFile.mockResolvedValue(fakeBuffer(4));

    for (const path of ["/p/1", "/p/2", "/p/3", "/p/4", "/p/5"]) {
      await acquirePreviewBlob(path);
    }
    expect(mocks.readBinaryFile).toHaveBeenCalledTimes(5);

    // /p/6 挤掉最旧的 /p/1
    await acquirePreviewBlob("/p/6");
    expect(mocks.readBinaryFile).toHaveBeenCalledTimes(6);

    // 重新获取 /p/1（读盘一次），此时缓存 [2,3,4,5,6,1] 超限 → /p/2 被挤掉
    mocks.readBinaryFile.mockClear();
    await acquirePreviewBlob("/p/1");
    expect(mocks.readBinaryFile).toHaveBeenCalledTimes(1);

    // /p/2 已被淘汰：再次获取会重新读盘；/p/4 仍在缓存
    await acquirePreviewBlob("/p/2");
    expect(mocks.readBinaryFile).toHaveBeenCalledTimes(2);
    mocks.readBinaryFile.mockClear();
    await acquirePreviewBlob("/p/4");
    expect(mocks.readBinaryFile).toHaveBeenCalledTimes(0);
  });

  it("never evicts entries referenced by mounted preview tabs", async () => {
    mocks.readBinaryFile.mockResolvedValue(fakeBuffer(4));

    for (const path of ["/p/1", "/p/2", "/p/3", "/p/4", "/p/5"]) {
      markPreviewActive(path);
      await acquirePreviewBlob(path);
    }

    // 全部激活时不吊销任何正在显示的 URL（/p/6 由 exclude 参数保护）
    await acquirePreviewBlob("/p/6");
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    // /p/1 变为非激活后，下一次获取允许回收它
    markPreviewInactive("/p/1");
    await acquirePreviewBlob("/p/7");
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  it("releases blobs when a preview tab closes", async () => {
    mocks.readBinaryFile.mockResolvedValue(fakeBuffer(4));
    await acquirePreviewBlob("/notes/a.pdf");
    releasePreviewBlob("/notes/a.pdf");

    expect(URL.revokeObjectURL).toHaveBeenCalled();
    mocks.readBinaryFile.mockClear();
    await acquirePreviewBlob("/notes/a.pdf");
    expect(mocks.readBinaryFile).toHaveBeenCalledTimes(1);
  });
});
