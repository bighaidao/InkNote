import { Suspense, lazy, useEffect, useState, useRef, useCallback, type MouseEvent } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import { statFile, readTextFile, type TextFileContent } from "../lib/tauri";
import { basename } from "../lib/paths";
import { t, type Locale } from "../lib/i18n";
import { notifyToast } from "../lib/useToast";
import BizIcon from "../components/BizIcon";
import ContextMenu, { type ContextMenuItem } from "../components/ContextMenu";
import { classifyPath, formatSize, isPreviewPath } from "./previewRegistry";
import {
  acquirePreviewBlob,
  markPreviewActive,
  markPreviewInactive,
} from "./previewAssets";
import {
  copyTextToClipboard,
  getSelectionText,
  extractFullDocumentText,
} from "./documentTextExtractor";
import TextPreview from "./TextPreview";
import HtmlPreview from "./HtmlPreview";
import "./preview.css";

const ViewerBundle = lazy(() => import("./viewerBundle"));

type Phase =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "error"; message: string }
  | { kind: "tooLarge" }
  | { kind: "unsupported" };

/** read_binary_file / read_text_file 走 invoke，返回 Rust 错误码；在此归一化为文案。 */
function localizeError(error: unknown, locale: Locale): string {
  const raw = String(error);
  if (raw.includes("preview_file_too_large")) return t(locale, "error.previewFileTooLarge");
  if (raw.includes("file_not_found")) return t(locale, "error.fileNotFound");
  return t(locale, "preview.readFailed", { message: raw });
}

export default function FilePreviewTab({
  previewPath,
  locale,
  initialLine,
  reloadKey = 0,
}: {
  previewPath: string;
  locale: Locale;
  /** 搜索结果跳转：打开时滚动到的 1-based 行号 */
  initialLine?: number;
  /** 外部文件变更 / 用户手动刷新时递增，触发重新读盘 */
  reloadKey?: number;
}) {
  const [stat, setStat] = useState<{ size: number } | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [textFile, setTextFile] = useState<TextFileContent | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [reloadNonce, setReloadNonce] = useState(0);
  const [extracting, setExtracting] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isPreviewPath(previewPath)) {
      setPhase({ kind: "unsupported" });
      return;
    }
    const category = classifyPath(previewPath);
    let cancelled = false;
    markPreviewActive(previewPath);
    setPhase({ kind: "loading" });
    setBlob(null);
    setTextFile(null);
    setStat(null);
    (async () => {
      try {
        const info = await statFile(previewPath);
        if (cancelled) return;
        setStat({ size: info.size });
        if (category === "text") {
          // 文本类走 readTextFile：复用编码探测（UTF-8/16/GBK），blob 链路会丢编码信息
          const file = await readTextFile(previewPath);
          if (cancelled) return;
          setTextFile(file);
          setPhase({ kind: "ready" });
          return;
        }
        const acquired = await acquirePreviewBlob(previewPath);
        if (cancelled) return;
        setBlob(acquired);
        setPhase({ kind: "ready" });
      } catch (error) {
        if (cancelled) return;
        if (String(error).includes("preview_file_too_large")) {
          setPhase({ kind: "tooLarge" });
        } else {
          setPhase({ kind: "error", message: localizeError(error, locale) });
        }
      }
    })();
    return () => {
      cancelled = true;
      markPreviewInactive(previewPath);
    };
  }, [previewPath, reloadKey, reloadNonce, locale]);

  const category = classifyPath(previewPath);
  const name = basename(previewPath);
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const isHtml = ext === "html" || ext === "htm";
  const isOfficeOrPdf =
    category === "pdf" ||
    category === "office-word" ||
    category === "office-sheet" ||
    category === "office-slides";

  // 提取并复制文档全文
  const handleExtractFullText = useCallback(async () => {
    if (extracting || !category) return;
    setExtracting(true);
    try {
      const text = await extractFullDocumentText(category, blob, bodyRef.current);
      if (text) {
        await copyTextToClipboard(text);
        notifyToast(t(locale, "preview.copiedText", { count: text.length }), "success");
      } else {
        notifyToast(t(locale, "preview.noTextFound"), "error");
      }
    } catch (e) {
      notifyToast(t(locale, "preview.readFailed", { message: String(e) }), "error");
    } finally {
      setExtracting(false);
    }
  }, [category, blob, extracting, locale]);

  // 右键菜单
  const handleContextMenu = (e: MouseEvent) => {
    // 如果点在可自处理右键的区域（如代码/HTML已有内部菜单），此处作为兜底或外层菜单
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const menuItems: ContextMenuItem[] = [];

  // 如果有选中文本，放第一位
  const selectionText = getSelectionText();
  if (selectionText) {
    menuItems.push({
      label: t(locale, "preview.copySelection"),
      shortcut: "Cmd+C",
      onClick: async () => {
        await copyTextToClipboard(selectionText);
        notifyToast(t(locale, "preview.copiedText", { count: selectionText.length }), "success");
      },
    });
  }

  // 如果是 Office 或 PDF，支持复制全文
  if (isOfficeOrPdf) {
    menuItems.push({
      label: extracting ? t(locale, "preview.extracting") : t(locale, "preview.copyAllText"),
      disabled: extracting,
      onClick: handleExtractFullText,
    });
  }

  if (menuItems.length > 0) {
    menuItems.push({ separator: true, label: "" });
  }

  menuItems.push(
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
    { separator: true, label: "" },
    {
      label: t(locale, "preview.refresh"),
      onClick: () => setReloadNonce((v) => v + 1),
    }
  );

  if (phase.kind === "unsupported") {
    return (
      <div className="preview-state" data-testid="preview-unsupported">
        <BizIcon name={name} size={40} />
        <p>{t(locale, "preview.unsupported", { name })}</p>
        <div className="preview-actions">
          <PreviewActions path={previewPath} locale={locale} />
        </div>
      </div>
    );
  }

  if (phase.kind === "error") {
    return (
      <div className="preview-state" data-testid="preview-error">
        <BizIcon name={name} size={40} />
        <p>{phase.message}</p>
        <div className="preview-actions">
          <button type="button" onClick={() => setReloadNonce((value) => value + 1)}>
            {t(locale, "preview.retry")}
          </button>
          <PreviewActions path={previewPath} locale={locale} />
        </div>
      </div>
    );
  }

  if (phase.kind === "tooLarge") {
    return (
      <div className="preview-state" data-testid="preview-too-large">
        <BizIcon name={name} size={40} />
        <p className="preview-too-large-title">{t(locale, "preview.tooLargeTitle")}</p>
        <p>
          {t(locale, "preview.tooLargeBody", {
            name,
            size: stat ? formatSize(stat.size) : "—",
            limit: "200 MB",
          })}
        </p>
        <div className="preview-actions">
          <button type="button" className="preview-primary" onClick={() => void openPath(previewPath).catch(() => {})}>
            {t(locale, "preview.openWithSystem")}
          </button>
          <button type="button" onClick={() => void revealItemInDir(previewPath).catch(() => {})}>
            {t(locale, "preview.revealInFolder")}
          </button>
        </div>
        <p className="preview-note">{t(locale, "preview.tooLargeSafeToClose")}</p>
      </div>
    );
  }

  return (
    <div
      className="preview-pane"
      data-testid="preview-pane"
      data-category={category}
      onContextMenu={handleContextMenu}
    >
      <header className="preview-header">
        <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
          <BizIcon name={name} size={18} />
          <span className="preview-name" title={previewPath}>{name}</span>
        </div>
        <span className="preview-meta">
          {[
            stat ? formatSize(stat.size) : t(locale, "preview.sizeLoading"),
            textFile ? textFile.encoding.name : null,
          ].filter(Boolean).join(" · ")}
        </span>
        <div className="preview-actions">
          {/* 对于 Office/PDF 等文档，在顶部常驻一键提取复制全文按钮 */}
          {isOfficeOrPdf && (
            <button
              type="button"
              className="preview-extract-btn"
              disabled={extracting}
              onClick={handleExtractFullText}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                fontWeight: 600,
                background: "var(--accent-color, #3b82f6)",
                color: "#ffffff",
                border: "none",
                borderRadius: "4px",
                padding: "3px 9px",
                cursor: "pointer",
              }}
            >
              {extracting ? `⏳ ${t(locale, "preview.extracting")}` : `📋 ${t(locale, "preview.copyAllText")}`}
            </button>
          )}
          <PreviewActions path={previewPath} locale={locale} />
        </div>
      </header>

      <div className="preview-body" ref={bodyRef}>
        {phase.kind === "loading" && (
          <div className="preview-state" data-testid="preview-loading">
            <BizIcon name={name} size={32} />
            <p style={{ marginTop: "12px" }}>{t(locale, "preview.loading", { name })}</p>
          </div>
        )}

        {/* HTML 网页双模式安全预览 */}
        {phase.kind === "ready" && category === "text" && isHtml && textFile && (
          <HtmlPreview
            content={textFile.content}
            fileName={name}
            previewPath={previewPath}
            locale={locale}
            initialLine={initialLine}
          />
        )}

        {/* 其它代码与纯文本预览 */}
        {phase.kind === "ready" && category === "text" && !isHtml && textFile && (
          <TextPreview
            content={textFile.content}
            fileName={name}
            previewPath={previewPath}
            locale={locale}
            initialLine={initialLine}
          />
        )}

        {/* 图片预览 */}
        {phase.kind === "ready" && category === "image" && (
          <img className="preview-image" src={convertFileSrc(previewPath)} alt={name} draggable={false} />
        )}

        {/* 二进制 Office / PDF / 压缩包 / 邮件查看器 */}
        {phase.kind === "ready" && category !== "text" && category !== "image" && blob && (
          <Suspense fallback={<div className="preview-state"><p>{t(locale, "preview.loading", { name })}</p></div>}>
            <ViewerBundle
              blob={blob}
              fileName={name}
              category={category!}
              onError={() => setPhase({ kind: "error", message: t(locale, "preview.readFailed", { message: name }) })}
              onUnsupported={() => setPhase({ kind: "unsupported" })}
            />
          </Suspense>
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

function PreviewActions({ path, locale }: { path: string; locale: Locale }) {
  return (
    <>
      <button type="button" onClick={() => void openPath(path).catch(() => {})}>
        {t(locale, "preview.openWithSystem")}
      </button>
      <button type="button" onClick={() => void revealItemInDir(path).catch(() => {})}>
        {t(locale, "preview.revealInFolder")}
      </button>
    </>
  );
}
