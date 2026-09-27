import { useEffect, useRef, useState, useCallback, type MouseEvent } from "react";
import { EditorState, StateEffect } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection } from "@codemirror/view";
import { search, openSearchPanel, closeSearchPanel } from "@codemirror/search";
import { bracketMatching, syntaxHighlighting, defaultHighlightStyle, LanguageDescription } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import BizIcon from "../components/BizIcon";
import ContextMenu, { type ContextMenuItem } from "../components/ContextMenu";
import { notifyToast } from "../lib/useToast";
import { t, type Locale } from "../lib/i18n";
import { copyTextToClipboard, getSelectionText } from "./documentTextExtractor";
import { formatSize } from "./previewRegistry";

export default function TextPreview({
  content,
  fileName,
  previewPath,
  locale = "zh",
  initialLine,
}: {
  content: string;
  fileName: string;
  previewPath?: string;
  locale?: Locale;
  initialLine?: number;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [copied, setCopied] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  // 解析语言名称
  const langDesc = LanguageDescription.matchFilename(languages, fileName);
  const langName = langDesc?.name ?? fileName.split(".").pop()?.toUpperCase() ?? "Text";
  const lineCount = content.split("\n").length;

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

    // 按文件名匹配语言包并懒加载
    if (langDesc) {
      void langDesc
        .load()
        .then((support) => {
          if (cancelled || !viewRef.current) return;
          viewRef.current.dispatch({ effects: StateEffect.appendConfig.of([support]) });
        })
        .catch(() => {});
    }

    // 搜索结果跳转定位
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
  }, [content, fileName, initialLine, langDesc]);

  // 一键复制代码
  const handleCopyCode = useCallback(async () => {
    const success = await copyTextToClipboard(content);
    if (success) {
      setCopied(true);
      notifyToast(t(locale, "preview.copiedText", { count: content.length }), "success");
      setTimeout(() => setCopied(false), 2000);
    }
  }, [content, locale]);

  // 右键菜单（stopPropagation：阻止冒泡到 FilePreviewTab 兜底菜单，避免双层菜单叠加）
  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const menuItems: ContextMenuItem[] = [
    {
      label: t(locale, "preview.copySelection"),
      shortcut: "Cmd+C",
      disabled: !getSelectionText(),
      onClick: async () => {
        const text = getSelectionText();
        if (text) {
          await copyTextToClipboard(text);
          notifyToast(t(locale, "preview.copiedText", { count: text.length }), "success");
        }
      },
    },
    {
      label: t(locale, "menu.selectAll"),
      shortcut: "Cmd+A",
      onClick: () => {
        if (viewRef.current) {
          viewRef.current.dispatch({
            selection: { anchor: 0, head: viewRef.current.state.doc.length },
          });
        }
      },
    },
    {
      label: t(locale, "preview.copyAllText"),
      onClick: handleCopyCode,
    },
  ];

  if (previewPath) {
    menuItems.push(
      { separator: true, label: "" },
      {
        label: t(locale, "preview.copyAbsolutePath"),
        onClick: async () => {
          await copyTextToClipboard(previewPath);
          notifyToast(t(locale, "preview.copiedPath"), "success");
        },
      },
      {
        label: t(locale, "preview.revealInFolder"),
        onClick: () => void revealItemInDir(previewPath).catch(() => {}),
      },
      {
        label: t(locale, "preview.openWithSystem"),
        onClick: () => void openPath(previewPath).catch(() => {}),
      }
    );
  }

  return (
    <div
      className="code-preview-wrapper"
      style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%" }}
      onContextMenu={handleContextMenu}
    >
      {/* 顶部语言与操作信息条 */}
      <div
        className="code-preview-header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "5px 12px",
          borderBottom: "1px solid var(--border-color, rgba(128,128,128,0.15))",
          fontSize: "12px",
          background: "var(--bg-secondary, rgba(128,128,128,0.03))",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <BizIcon name={fileName} size={15} />
          <span style={{ fontWeight: 600, color: "var(--text-primary, currentColor)" }}>{langName}</span>
          <span style={{ opacity: 0.5 }}>·</span>
          <span style={{ opacity: 0.7 }}>{t(locale, "preview.lines", { count: lineCount })}</span>
          <span style={{ opacity: 0.5 }}>·</span>
          <span style={{ opacity: 0.7 }}>{formatSize(content.length)}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            type="button"
            className="preview-btn"
            style={{
              padding: "3px 8px",
              fontSize: "11px",
              cursor: "pointer",
              borderRadius: "4px",
              border: "1px solid var(--border-color, rgba(128,128,128,0.2))",
              background: "transparent",
              color: "currentColor",
            }}
            onClick={() => {
              if (viewRef.current) openSearchPanel(viewRef.current);
            }}
          >
            🔍 {t(locale, "menu.find")} (Cmd+F)
          </button>
          <button
            type="button"
            className="preview-btn"
            style={{
              padding: "3px 8px",
              fontSize: "11px",
              cursor: "pointer",
              borderRadius: "4px",
              border: "1px solid var(--border-color, rgba(128,128,128,0.2))",
              background: "transparent",
              color: "currentColor",
            }}
            onClick={handleCopyCode}
          >
            {copied ? `✓ ${t(locale, "preview.copied")}` : `📋 ${t(locale, "preview.copySource")}`}
          </button>
        </div>
      </div>

      <div ref={hostRef} className="preview-code" data-testid="preview-code" style={{ flex: 1, overflow: "hidden" }} />

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={menuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
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
