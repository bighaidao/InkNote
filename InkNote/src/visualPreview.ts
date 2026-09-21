import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { configuredMermaid } from "./lib/mermaid";
import { t, type Locale } from "./lib/i18n";
import { openVisualViewer } from "./editor/widgets/visualActions";
import "katex/dist/katex.min.css";

interface PreviewData { kind: "mermaid" | "math"; source: string; locale: Locale; theme: "light" | "dark" }

export async function bootstrapVisualPreview() {
  const root = document.getElementById("root")!;
  let locale: Locale = "zh";
  root.textContent = "Loading…";
  try {
    const data = await invoke<PreviewData>("get_visual_preview");
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
  } catch {
    root.classList.remove("visual-preview-source");
    root.textContent = t(locale, "visual.failed");
    root.classList.add("visual-preview-error");
  }
}
