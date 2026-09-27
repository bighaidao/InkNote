import { describe, it, expect } from "vitest";
import { resolveBizIconKey } from "./icon-map";

describe("icon-map mapping system", () => {
  it("maps programming languages to VS Code icons", () => {
    expect(resolveBizIconKey("main.py")).toBe("python");
    expect(resolveBizIconKey("app.ts")).toBe("typescript");
    expect(resolveBizIconKey("Component.tsx")).toBe("typescript");
    expect(resolveBizIconKey("index.js")).toBe("javascript");
    expect(resolveBizIconKey("main.rs")).toBe("rust");
    expect(resolveBizIconKey("server.go")).toBe("go");
    expect(resolveBizIconKey("index.html")).toBe("html");
    expect(resolveBizIconKey("style.css")).toBe("css");
    expect(resolveBizIconKey("notes.md")).toBe("markdown");
  });

  it("maps Office and PDF documents to professional icons", () => {
    expect(resolveBizIconKey("report.docx")).toBe("word");
    expect(resolveBizIconKey("legacy.doc")).toBe("word");
    expect(resolveBizIconKey("data.xlsx")).toBe("excel");
    expect(resolveBizIconKey("data.csv")).toBe("excel");
    expect(resolveBizIconKey("slides.pptx")).toBe("powerpoint");
    expect(resolveBizIconKey("manual.pdf")).toBe("pdf");
  });

  it("maps folders to open and closed states", () => {
    expect(resolveBizIconKey("src", true, false)).toBe("folder");
    expect(resolveBizIconKey("src", true, true)).toBe("folder-open");
  });

  it("maps special configuration files", () => {
    expect(resolveBizIconKey("package.json")).toBe("json");
    expect(resolveBizIconKey("tsconfig.json")).toBe("typescript");
    expect(resolveBizIconKey(".gitignore")).toBe("git");
    expect(resolveBizIconKey("Cargo.toml")).toBe("rust");
  });

  it("falls back to file for unknown extensions", () => {
    expect(resolveBizIconKey("data.xyz123")).toBe("file");
    expect(resolveBizIconKey("no_extension")).toBe("file");
  });
});
