import React from "react";
import ReactDOM from "react-dom/client";
import { error as logError } from "@tauri-apps/plugin-log";
import { initPlatform } from "./lib/platform";
import { getLocale, setLocale } from "./lib/i18n";
import { applyEditorLayoutPrefs } from "./lib/preferences";
import { applyMarkdownTheme } from "./lib/markdownTheme";
import { apply as applyTheme, applyBootstrapTheme } from "./lib/theme";
import { initializeSettingsStore } from "./lib/settingsStore";
import "./App.css";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** 全局错误兜底：未捕获异常/Rejected Promise 写入日志（终端 + 文件），dev 下同时可见于 DevTools。 */
function setupGlobalErrorLogging() {
  const report = (prefix: string, detail: unknown) => {
    const text = `${prefix}: ${detail instanceof Error ? `${detail.message}\n${detail.stack ?? ""}` : String(detail)}`;
    console.error(text);
    if (isTauri()) void logError(text).catch(() => {});
  };
  window.addEventListener("error", (e) => report("uncaught", e.error ?? e.message));
  window.addEventListener("unhandledrejection", (e) => report("unhandled-rejection", e.reason));
}

performance.mark("inknote:bootstrap-start");
initPlatform();
applyBootstrapTheme();
setupGlobalErrorLogging();

document.addEventListener(
  "contextmenu",
  (e) => {
    e.preventDefault();
  },
  { capture: true },
);

async function bootstrap() {
  if (new URLSearchParams(window.location.search).get("visual-preview") === "1") {
    const { bootstrapVisualPreview } = await import("./visualPreview");
    await bootstrapVisualPreview();
    return;
  }
  const [{ default: App }] = await Promise.all([
    import("./App"),
    initializeSettingsStore(),
  ]);
  performance.mark("inknote:settings-ready");
  initPlatform();
  setLocale(getLocale());
  applyTheme();
  applyEditorLayoutPrefs();
  applyMarkdownTheme();

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
  requestAnimationFrame(() => {
    performance.mark("inknote:app-rendered");
    performance.measure(
      "inknote:bootstrap-to-render",
      "inknote:bootstrap-start",
      "inknote:app-rendered",
    );
  });
}

void bootstrap();
