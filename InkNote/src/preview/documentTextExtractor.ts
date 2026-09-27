import { writeText as tauriWriteText } from "@tauri-apps/plugin-clipboard-manager";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";
import type { PreviewCategory } from "./previewRegistry";

/**
 * 跨平台安全剪贴板写入（Tauri IPC 优先，浏览器 API 兜底）
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    await tauriWriteText(text);
    return true;
  } catch {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * 获取当前全局鼠标选中文本
 */
export function getSelectionText(): string {
  const selection = window.getSelection();
  return selection ? selection.toString().trim() : "";
}

/**
 * 从 docx-preview 渲染结构（.docx-wrapper > section > 块级元素）提取纯文本。
 * 逐顶层块遍历：表格按行取单元格，其余块取整段文本，
 * 避免单元格内 <p> 与所属 <tr> 被重复输出。
 */
function extractWordBlocks(wrapper: Element): string {
  const blocks = Array.from(wrapper.querySelectorAll("section > *"));
  const lines: string[] = [];
  for (const block of blocks) {
    if (block instanceof HTMLTableElement) {
      const rows = Array.from(block.querySelectorAll("tr"));
      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll("th, td"));
        const line = cells
          .map((cell) => (cell.textContent ?? "").replace(/\s+/g, " ").trim())
          .join("\t");
        if (line) lines.push(line);
      }
    } else {
      const text = (block.textContent ?? "").replace(/\s+/g, " ").trim();
      if (text) lines.push(text);
    }
  }
  return lines.join("\n");
}

/**
 * 从 DOM 容器中智能提取纯文本（针对 Word、Excel、PPT、HTML 渲染层）
 */
export function extractDomText(container: HTMLElement): string {
  // Word（docx-preview）优先判断：Word 文档内部同样会渲染 <table>，
  // 若先走表格分支会把整篇正文段落全部丢弃，只留下表格。
  const docxWrapper = container.querySelector(".docx-wrapper, .docx");
  if (docxWrapper) {
    const wordText = extractWordBlocks(docxWrapper);
    if (wordText) return wordText;
  }

  // 如果是 Excel 表格
  const tables = container.querySelectorAll("table");
  if (tables.length > 0) {
    const tableTexts: string[] = [];
    tables.forEach((table) => {
      const rows = Array.from(table.querySelectorAll("tr"));
      const rowTexts = rows.map((row) => {
        const cells = Array.from(row.querySelectorAll("th, td"));
        return cells.map((cell) => (cell.textContent ?? "").trim()).join("\t");
      });
      tableTexts.push(rowTexts.join("\n"));
    });
    return tableTexts.join("\n\n");
  }

  // 通用遍历回退（按块级元素换行）
  const text = container.innerText || container.textContent || "";
  return text.trim();
}

/**
 * 使用 pdfjs-dist 直接抽取 PDF 的所有页纯文本
 */
export async function extractPdfText(blob: Blob): Promise<string> {
  try {
    const pdfjsLib = await import("pdfjs-dist");
    // 复用与 ViewerBundle 相同的 worker 资源；缺省时 pdfjs 会退化为主线程 fake worker，大文件易卡 UI
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
    const arrayBuffer = await blob.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useWorkerFetch: false,
      useSystemFonts: true,
    });
    const pdf = await loadingTask.promise;
    const pageTexts: string[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const pageStr = content.items
        .map((item: unknown) => {
          const textItem = item as { str?: string };
          return textItem.str ?? "";
        })
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      if (pageStr) {
        pageTexts.push(`[Page ${pageNum}]\n${pageStr}`);
      }
    }

    return pageTexts.join("\n\n");
  } catch (error) {
    console.warn("Direct PDF text extraction fallback to DOM", error);
    return "";
  }
}

/**
 * 统一全文提取入口
 */
export async function extractFullDocumentText(
  category: PreviewCategory,
  blob?: Blob | null,
  containerEl?: HTMLElement | null
): Promise<string> {
  // 1. PDF 优先调 pdfjs 提取精准文字
  if (category === "pdf" && blob) {
    const pdfText = await extractPdfText(blob);
    if (pdfText) return pdfText;
  }

  // 2. DOM 渲染层提取（适用于 Word、Excel、PPT、HTML）
  if (containerEl) {
    const domText = extractDomText(containerEl);
    if (domText) return domText;
  }

  return "";
}
