import { useMemo } from "react";
import { FileViewer } from "@open-file-viewer/react";
import {
  archivePlugin,
  emailPlugin,
  epubPlugin,
  officePlugin,
  pdfPlugin,
} from "@open-file-viewer/core";
import "@open-file-viewer/core/style.css";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";
import type { PreviewCategory } from "./previewRegistry";

/**
 * open-file-viewer 全部重依赖（WASM/Worker/CSS）收敛在本模块，
 * 仅当首个重量级预览 Tab（PDF/Office/压缩包/邮件）挂载时经 dynamic import 加载。
 * 代码/文本走 TextPreview（CM6），图片走原生 <img>，均不进本模块。
 */

function buildPlugins(category: PreviewCategory) {
  switch (category) {
    case "pdf":
      return [pdfPlugin({ workerSrc: pdfWorkerSrc })];
    case "epub":
      return [epubPlugin()];
    case "office-word":
    case "office-sheet":
    case "office-slides":
      return [officePlugin()];
    case "archive":
      return [archivePlugin()];
    case "email":
      return [emailPlugin()];
    default:
      // text/image 在 FilePreviewTab 中已分流；此处兜底为空（viewer 显示其自带 unsupported）
      return [];
  }
}

export default function ViewerBundle({ blob, fileName, category, onError, onUnsupported }: {
  blob: Blob;
  fileName: string;
  category: PreviewCategory;
  onError: () => void;
  onUnsupported: () => void;
}) {
  const plugins = useMemo(() => buildPlugins(category), [category]);
  return (
    <FileViewer
      file={blob}
      fileName={fileName}
      width="100%"
      height="100%"
      fit="contain"
      theme="auto"
      toolbar={false}
      plugins={plugins}
      onError={onError}
      onUnsupported={onUnsupported}
    />
  );
}
