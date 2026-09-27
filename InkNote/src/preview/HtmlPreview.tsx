import { useState, useCallback, type MouseEvent } from "react";
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import { notifyToast } from "../lib/useToast";
import { t, type Locale } from "../lib/i18n";
import ContextMenu, { type ContextMenuItem } from "../components/ContextMenu";
import { copyTextToClipboard, getSelectionText } from "./documentTextExtractor";
import TextPreview from "./TextPreview";

interface Props {
  content: string;
  fileName: string;
  previewPath: string;
  locale: Locale;
  initialLine?: number;
}

export default function HtmlPreview({
  content,
  fileName,
  previewPath,
  locale,
  initialLine,
}: Props) {
  const [mode, setMode] = useState<"rendered" | "source">("rendered");
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [copied, setCopied] = useState(false);

  // 安全沙箱 HTML 处理：默认响应式基础样式。
  // 注意 sandbox 仅 allow-scripts：iframe 与主窗口保持源隔离，防止预览内容触达应用上下文。
  const sanitizedDoc = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    /* 默认基础排版修饰，避免未带样式的 HTML 过分简陋 */
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #333333;
      margin: 16px;
      word-break: break-word;
    }
    @media (prefers-color-scheme: dark) {
      body {
        color: #e0e0e0;
      }
    }
    img, video { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  ${content}
</body>
</html>
  `;

  // 一键复制代码/纯文本
  const handleCopySource = useCallback(async () => {
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
      label: t(locale, "preview.copySourceCode"),
      onClick: handleCopySource,
    },
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
    },
  ];

  return (
    <div
      className="html-preview-container"
      style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%" }}
      onContextMenu={handleContextMenu}
    >
      {/* 顶部模式切换与操作条 */}
      <div className="html-preview-toolbar" style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "6px 12px",
        borderBottom: "1px solid var(--border-color, rgba(128,128,128,0.15))",
        fontSize: "12px",
        background: "var(--bg-secondary, rgba(128,128,128,0.04))",
        flexShrink: 0,
      }}>
        {/* 左侧：分段切换控制器 */}
        <div className="html-view-tabs" style={{ display: "inline-flex", borderRadius: "6px", background: "rgba(128,128,128,0.12)", padding: "2px" }}>
          <button
            type="button"
            className={`html-tab-btn ${mode === "rendered" ? "is-active" : ""}`}
            style={{
              border: "none",
              padding: "3px 10px",
              borderRadius: "4px",
              fontSize: "12px",
              cursor: "pointer",
              background: mode === "rendered" ? "var(--bg-primary, #fff)" : "transparent",
              color: mode === "rendered" ? "var(--text-primary, currentColor)" : "var(--text-muted, #888)",
              boxShadow: mode === "rendered" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              fontWeight: mode === "rendered" ? 600 : 400,
            }}
            onClick={() => setMode("rendered")}
          >
            {t(locale, "preview.modeRendered")}
          </button>
          <button
            type="button"
            className={`html-tab-btn ${mode === "source" ? "is-active" : ""}`}
            style={{
              border: "none",
              padding: "3px 10px",
              borderRadius: "4px",
              fontSize: "12px",
              cursor: "pointer",
              background: mode === "source" ? "var(--bg-primary, #fff)" : "transparent",
              color: mode === "source" ? "var(--text-primary, currentColor)" : "var(--text-muted, #888)",
              boxShadow: mode === "source" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              fontWeight: mode === "source" ? 600 : 400,
            }}
            onClick={() => setMode("source")}
          >
            {t(locale, "preview.modeSource")}
          </button>
        </div>

        {/* 右侧：快捷操作 */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            type="button"
            className="preview-btn"
            style={{
              padding: "4px 8px",
              fontSize: "11px",
              cursor: "pointer",
              borderRadius: "4px",
              border: "1px solid var(--border-color, rgba(128,128,128,0.2))",
              background: "transparent",
              color: "currentColor",
            }}
            onClick={handleCopySource}
          >
            {copied ? `✓ ${t(locale, "preview.copied")}` : t(locale, "preview.copySource")}
          </button>
          <button
            type="button"
            className="preview-btn"
            style={{
              padding: "4px 8px",
              fontSize: "11px",
              cursor: "pointer",
              borderRadius: "4px",
              border: "1px solid var(--border-color, rgba(128,128,128,0.2))",
              background: "transparent",
              color: "currentColor",
            }}
            onClick={() => void openPath(previewPath).catch(() => {})}
          >
            {t(locale, "preview.openInBrowser")}
          </button>
        </div>
      </div>

      {/* 主体视口 */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {mode === "rendered" ? (
          <iframe
            title={fileName}
            srcDoc={sanitizedDoc}
            sandbox="allow-scripts"
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              background: "var(--bg-primary, #ffffff)",
            }}
          />
        ) : (
          <TextPreview
            content={content}
            fileName={fileName}
            previewPath={previewPath}
            locale={locale}
            initialLine={initialLine}
          />
        )}
      </div>

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
