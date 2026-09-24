import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import TextPreview from "./TextPreview";

let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
});

function mount(content: string, fileName: string, initialLine?: number) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root?.render(
    <TextPreview content={content} fileName={fileName} initialLine={initialLine} />,
  ));
  return host;
}

describe("TextPreview（CM6 只读）", () => {
  it("renders file content with line numbers and stays read-only", () => {
    const host = mount("host: localhost\nport: 5432\n", "config.yaml");

    // CM6 只读视图内容可见
    expect(host.textContent).toContain("host: localhost");
    expect(host.textContent).toContain("port: 5432");
    // 行号槽存在
    expect(host.querySelector(".cm-gutters")).not.toBeNull();
    // 不可编辑：contenteditable 为 false
    const contentDom = host.querySelector<HTMLElement>(".cm-content")!;
    expect(contentDom).not.toBeNull();
    expect(contentDom.getAttribute("contenteditable")).toBe("false");
  });

  it("clamps initialLine beyond document length", () => {
    const host = mount("a\nb\nc\n", "a.txt", 99);
    expect(host.textContent).toContain("c");
    expect(host.querySelector(".cm-content")).not.toBeNull();
  });
});
