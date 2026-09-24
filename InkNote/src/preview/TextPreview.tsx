import { useEffect, useRef } from "react";
import { EditorState, StateEffect } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection } from "@codemirror/view";
import { search, openSearchPanel, closeSearchPanel } from "@codemirror/search";
import { bracketMatching, syntaxHighlighting, defaultHighlightStyle, LanguageDescription } from "@codemirror/language";
import { languages } from "@codemirror/language-data";

/**
 * 代码/文本文件只读预览（设计文档 §1.1 中量级）。
 *
 * 复用编辑器同款 CM6 依赖：行号 / 语法高亮（language-data 按文件名懒加载对应语言包）/
 * Cmd+F 查找面板 / 虚拟滚动。不可编辑（editable=false + readOnly），不进 TabDoc 文档链路。
 */
export default function TextPreview({ content, fileName, initialLine }: {
  content: string;
  fileName: string;
  initialLine?: number;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: content,
        extensions: [
          lineNumbers(),
          highlightActiveLine(),
          drawSelection(),
          bracketMatching(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          search({ top: true }),
          keymap.of([
            { key: "Mod-f", run: openSearchPanel },
            { key: "Escape", run: closeSearchPanel },
          ]),
          EditorState.readOnly.of(true),
          EditorView.editable.of(false),
          EditorView.lineWrapping,
          previewTheme,
        ],
      }),
    });
    viewRef.current = view;

    // 按文件名匹配语言包并懒加载（yaml/rs/py… 各自独立 chunk，未命中零成本）
    const description = LanguageDescription.matchFilename(languages, fileName);
    if (description) {
      void description.load().then((support) => {
        if (cancelled || !viewRef.current) return;
        viewRef.current.dispatch({ effects: StateEffect.appendConfig.of([support]) });
      }).catch(() => { /* 高亮加载失败静默降级为纯文本 */ });
    }

    // 搜索结果跳转：滚动到命中行并居中（只读无 cursor 语义冲突）
    if (initialLine && initialLine > 1) {
      const lineNumber = Math.min(initialLine, view.state.doc.lines);
      const line = view.state.doc.line(lineNumber);
      view.dispatch({
        selection: { anchor: line.from },
        effects: EditorView.scrollIntoView(line.from, { y: "center" }),
      });
    }

    return () => {
      cancelled = true;
      view.destroy();
      viewRef.current = null;
    };
    // content / initialLine 变化即重建（预览无编辑态，重建成本可接受）
  }, [content, fileName, initialLine]);

  return <div ref={hostRef} className="preview-code" data-testid="preview-code" />;
}

const previewTheme = EditorView.theme({
  "&": { height: "100%", background: "transparent", fontSize: "12.5px" },
  ".cm-scroller": {
    overflow: "auto",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    lineHeight: "1.55",
  },
  ".cm-gutters": { background: "transparent", border: "none", opacity: 0.65 },
  ".cm-activeLine": { background: "rgba(128, 128, 128, 0.08)" },
  ".cm-activeLineGutter": { background: "transparent" },
  ".cm-panels": { fontSize: "12px" },
});
