import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { configuredMermaid } from "./lib/mermaid";
import { t, type Locale } from "./lib/i18n";
import { openVisualViewer } from "./editor/widgets/visualActions";
import "katex/dist/katex.min.css";

interface PreviewData { kind: "mermaid" | "math"; source: string; locale: Locale; theme: "light" | "dark" }

/**
 * 独立预览窗口：窗口按 kind 复用（资源评估 §7-P1-1），
 * Rust 侧更新数据后 emit "visual-preview-updated"，这里重渲染并重开 viewer。
 */
export async function bootstrapVisualPreview() {
  const root = document.getElementById("root")!;
  let locale: Locale = "zh";
  root.textContent = "Loading…";

  const render = async (data: PreviewData) => {
    locale = data.locale === "en" ? "en" : "zh";
    document.documentElement.lang = locale === "en" ? "en" : "zh-CN";
    document.documentElement.dataset.theme = data.theme;
    const target = document.createElement("div");
    root.classList.add("visual-preview-source");
    root.replaceChildren(target);
    if (data.kind === "mermaid") {
      const mermaid = await configuredMermaid(data.theme === "dark" ? "dark" : "default");
      target.innerHTML = (await mermaid.render("native-diagram", data.source)).svg;
    } else {
      const { default: katex } = await import("katex");
      target.innerHTML = katex.renderToString(data.source, { displayMode: true, throwOnError: true });
    }
    await document.fonts.ready;
    const current = getCurrentWindow();
    openVisualViewer(target, {
      locale,
      close: () => current.close(),
      fullscreen: async () => current.setFullscreen(!(await current.isFullscreen())),
      escape: async () => { if (await current.isFullscreen()) await current.setFullscreen(false); else await current.close(); },
    });
  };

  try {
    const data = await invoke<PreviewData>("get_visual_preview");
    await render(data);
  } catch {
    root.classList.remove("visual-preview-source");
    root.textContent = t(locale, "visual.failed");
    root.classList.add("visual-preview-error");
    return;
  }

  // 同 kind 复用：后续请求以事件送达，重渲染替换当前 viewer。
  void listen<PreviewData>("visual-preview-updated", (event) => {
    void render(event.payload).catch(() => {
      // 更新失败保留旧内容，仅记录（独立预览窗无 toast 体系）
      console.error("visual preview update failed");
    });
  });
}
