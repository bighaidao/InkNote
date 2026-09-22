use std::collections::HashMap;
use std::sync::{
    atomic::{AtomicU64, Ordering},
    Mutex, OnceLock,
};
use tauri::{Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

#[derive(Clone, serde::Serialize, serde::Deserialize)]
pub struct PreviewData {
    kind: String,
    source: String,
    locale: String,
    theme: String,
}

static PREVIEWS: OnceLock<Mutex<HashMap<String, PreviewData>>> = OnceLock::new();
static NEXT_ID: AtomicU64 = AtomicU64::new(1);

#[tauri::command]
pub async fn open_visual_preview(
    app: tauri::AppHandle,
    window: WebviewWindow,
    data: PreviewData,
) -> Result<(), String> {
    if !window.label().starts_with("main") || !matches!(data.kind.as_str(), "mermaid" | "math") {
        return Err("invalid preview request".into());
    }
    let label = format!("visual-preview-{}", NEXT_ID.fetch_add(1, Ordering::Relaxed));
    let title = if data.locale == "en" {
        "InkNote — Diagram and formula preview"
    } else {
        "墨笺 — 图表与公式预览"
    };
    let theme = if data.theme == "dark" {
        tauri::Theme::Dark
    } else {
        tauri::Theme::Light
    };
    PREVIEWS
        .get_or_init(Default::default)
        .lock()
        .unwrap()
        .insert(label.clone(), data);
    let result = WebviewWindowBuilder::new(
        &app,
        &label,
        WebviewUrl::App("index.html?visual-preview=1".into()),
    )
    .title(title)
    .inner_size(1100.0, 760.0)
    .min_inner_size(480.0, 320.0)
    .decorations(true)
    .resizable(true)
    .maximizable(true)
    .center()
    .theme(Some(theme))
    .build();
    match result {
        Ok(preview) => {
            preview.on_window_event(move |event| {
                if matches!(event, tauri::WindowEvent::Destroyed) {
                    PREVIEWS
                        .get_or_init(Default::default)
                        .lock()
                        .unwrap()
                        .remove(&label);
                }
            });
            Ok(())
        }
        Err(error) => {
            PREVIEWS
                .get_or_init(Default::default)
                .lock()
                .unwrap()
                .remove(&label);
            Err(error.to_string())
        }
    }
}

#[tauri::command]
pub fn get_visual_preview(window: WebviewWindow) -> Result<PreviewData, String> {
    PREVIEWS
        .get_or_init(Default::default)
        .lock()
        .unwrap()
        .get(window.label())
        .cloned()
        .ok_or_else(|| "preview unavailable".into())
}

pub fn close_previews(app: &tauri::AppHandle) {
    for (label, window) in app.webview_windows() {
        if label.starts_with("visual-preview-") {
            let _ = window.destroy();
        }
    }
}
