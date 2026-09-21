import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import Editor, { type EditorRef } from "./Editor";
import { writeText as writeClipboardText } from "@tauri-apps/plugin-clipboard-manager";

vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  readText: vi.fn(),
  writeText: vi.fn().mockResolvedValue(undefined),
}));

let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
});

describe("Editor document replacement", () => {
  it("applies an AI result only while the captured text is unchanged", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    const ref = createRef<EditorRef>();
    const onChange = vi.fn();

    act(() => root?.render(
      <Editor
        ref={ref}
        locale="en"
        value="Original text"
        mode="source"
        filePath={null}
        typewriter={false}
        lineNumbers={false}
        wordWrap
        tabSize={2}
        spellCheck={false}
        readOnly={false}
        onChange={onChange}
        onModeChange={() => {}}
      />,
    ));

    const snapshot = ref.current?.captureAiSelection();
    expect(snapshot).toMatchObject({ text: "Original text", from: 0, to: 13, wholeDocument: true });
    act(() => expect(ref.current?.applyAiResult(snapshot!, "Polished text", false)).toBe(true));
    expect(onChange).toHaveBeenLastCalledWith("Polished text");
    expect(ref.current?.applyAiResult(snapshot!, "Stale overwrite", false)).toBe(false);
  });

  it("does not replace an unchanged document when editing is enabled", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    const ref = createRef<EditorRef>();
    const onChange = vi.fn();
    const content = Array.from({ length: 100 }, (_, i) => `line ${i}`).join("\n");

    act(() => root?.render(
      <Editor
        ref={ref}
        locale="en"
        value={content}
        mode="preview"
        filePath={null}
        typewriter={false}
        lineNumbers={false}
        wordWrap
        tabSize={2}
        spellCheck={false}
        readOnly
        onChange={onChange}
        onModeChange={() => {}}
      />,
    ));
    onChange.mockClear();

    act(() => ref.current?.resetContent(content));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("clamps the selection to CodeMirror's normalized CRLF document length", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    const ref = createRef<EditorRef>();
    const onChange = vi.fn();
    const render = (value: string) => (
      <Editor
        ref={ref}
        locale="en"
        value={value}
        mode="preview"
        filePath={null}
        typewriter={false}
        lineNumbers={false}
        wordWrap
        tabSize={2}
        spellCheck={false}
        readOnly={false}
        onChange={onChange}
        onModeChange={() => {}}
      />
    );

    act(() => root?.render(render(Array.from({ length: 20 }, (_, i) => `line ${i}`).join("\n"))));
    act(() => ref.current?.scrollToLine(20));

    expect(() => {
      act(() => root?.render(render("one\r\ntwo")));
    }).not.toThrow();
  });

  it("copies a rectangular table selection from the context menu", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    const ref = createRef<EditorRef>();

    act(() => root?.render(
      <Editor
        ref={ref}
        locale="en"
        value={["| A | B |", "| --- | --- |", "| 1 | 2 |"].join("\n")}
        mode="preview"
        filePath={null}
        typewriter={false}
        lineNumbers={false}
        wordWrap
        tabSize={2}
        spellCheck={false}
        readOnly={false}
        onChange={() => {}}
        onModeChange={() => {}}
      />,
    ));

    const wrap = host.querySelector<HTMLElement>(".md-table-widget")!;
    const firstHeader = wrap.querySelectorAll<HTMLElement>("thead th")[0];
    const secondBodyCell = wrap.querySelectorAll<HTMLElement>("tbody td")[1];
    act(() => {
      firstHeader.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
      secondBodyCell.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
      secondBodyCell.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 0 }));
      secondBodyCell.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
    });

    vi.mocked(writeClipboardText).mockClear();
    const copyItem = Array.from(host.querySelectorAll<HTMLButtonElement>(".context-menu-item"))
      .find((button) => button.textContent?.includes("Copy"));
    expect(copyItem).toBeDefined();
    act(() => copyItem?.click());

    expect(writeClipboardText).toHaveBeenCalledWith("A\tB\n1\t2");
  });
});
