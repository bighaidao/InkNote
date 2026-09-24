import { describe, expect, it } from "vitest";
import whitelist from "./searchableExtensions.json";
import {
  binaryWhitelistExts,
  classifyPath,
  formatSize,
  isPreviewPath,
} from "./previewRegistry";

describe("previewRegistry", () => {
  it("routes markdown/txt to the document pipeline, not preview", () => {
    expect(classifyPath("D:\\notes\\a.md")).toBeNull();
    expect(classifyPath("/notes/b.markdown")).toBeNull();
    expect(classifyPath("/notes/c.txt")).toBeNull();
    expect(isPreviewPath("a.md")).toBe(false);
  });

  it("classifies searchable text extensions as text previews", () => {
    expect(classifyPath("main.rs")).toBe("text");
    expect(classifyPath("config.yaml")).toBe("text");
    expect(classifyPath("style.css")).toBe("text");
    expect(classifyPath("index.html")).toBe("text");
  });

  it("classifies binary formats into dedicated categories", () => {
    expect(classifyPath("doc.pdf")).toBe("pdf");
    expect(classifyPath("book.epub")).toBe("epub");
    expect(classifyPath("IMG.PNG")).toBe("image");
    expect(classifyPath("report.docx")).toBe("office-word");
    expect(classifyPath("table.XLSX")).toBe("office-sheet");
    expect(classifyPath("slides.pptx")).toBe("office-slides");
    expect(classifyPath("bundle.zip")).toBe("archive");
    expect(classifyPath("mail.eml")).toBe("email");
  });

  it("rejects files without a usable extension", () => {
    expect(classifyPath("Dockerfile")).toBeNull();
    expect(classifyPath("archive.tar.gz")).toBe("archive"); // 按最后一段 gz
    expect(classifyPath("file.")).toBeNull();
    expect(classifyPath("noext")).toBeNull();
  });

  it("keeps the shared JSON whitelist and the binary category map in sync", () => {
    // 防漂移：searchableExtensions.json 的 previewableExtensions 必须与
    // previewRegistry 的二进制分类映射完全一致（顺序不敏感）。
    expect([...binaryWhitelistExts()].sort()).toEqual(
      [...whitelist.previewableExtensions].sort(),
    );
    // searchableTextExtensions 不得与 previewableExtensions 重叠
    const overlap = whitelist.searchableTextExtensions.filter((ext) =>
      whitelist.previewableExtensions.includes(ext),
    );
    expect(overlap).toEqual([]);
  });

  it("formats sizes for humans", () => {
    expect(formatSize(512)).toBe("512 B");
    expect(formatSize(2048)).toBe("2.0 KB");
    expect(formatSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});
