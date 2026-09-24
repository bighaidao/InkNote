import { Suspense, lazy, useEffect, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import { FileText } from "lucide-react";
import { statFile, readTextFile, type TextFileContent } from "../lib/tauri";
import { basename } from "../lib/paths";
import { t, type Locale } from "../lib/i18n";
import { classifyPath, formatSize, isPreviewPath } from "./previewRegistry";
import {
  acquirePreviewBlob,
  markPreviewActive,
  markPreviewInactive,
} from "./previewAssets";
import TextPreview from "./TextPreview";
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

export default function FilePreviewTab({ previewPath, locale, initialLine, reloadKey = 0 }: {
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

  if (phase.kind === "unsupported") {
    return (
      <div className="preview-state" data-testid="preview-unsupported">
        <FileText size={36} strokeWidth={1.4} aria-hidden="true" />
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
        <FileText size={36} strokeWidth={1.4} aria-hidden="true" />
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

  // 超过 Rust 护栏：主动确认后交给系统应用（设计文档 §3.4 路由决策树）
  if (phase.kind === "tooLarge") {
    return (
      <div className="preview-state" data-testid="preview-too-large">
        <FileText size={36} strokeWidth={1.4} aria-hidden="true" />
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
    <div className="preview-pane" data-testid="preview-pane" data-category={category}>
      <header className="preview-header">
        <span className="preview-name" title={previewPath}>{name}</span>
        <span className="preview-meta">
          {[
            stat ? formatSize(stat.size) : t(locale, "preview.sizeLoading"),
            textFile ? textFile.encoding.name : null,
          ].filter(Boolean).join(" · ")}
        </span>
        <div className="preview-actions">
          <PreviewActions path={previewPath} locale={locale} />
        </div>
      </header>
      <div className="preview-body">
        {phase.kind === "loading" && (
          <div className="preview-state" data-testid="preview-loading">
            <p>{t(locale, "preview.loading", { name })}</p>
          </div>
        )}
        {phase.kind === "ready" && category === "text" && textFile && (
          <TextPreview content={textFile.content} fileName={name} initialLine={initialLine} />
        )}
        {phase.kind === "ready" && category === "image" && (
          <img className="preview-image" src={convertFileSrc(previewPath)} alt={name} draggable={false} />
        )}
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
