use std::collections::HashMap;
use std::sync::{
    atomic::{AtomicU64, Ordering},
    Mutex, OnceLock,
};
use tauri::{Emitter, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

#[derive(Clone, serde::Serialize, serde::Deserialize)]
pub struct PreviewData {
    kind: String,
    source: String,
    locale: String,
    theme: String,
}

static PREVIEWS: OnceLock<Mutex<HashMap<String, PreviewData>>> = OnceLock::new();
static NEXT_ID: AtomicU64 = AtomicU64::new(1);

/// 同时存活的预览窗口上限；超限后新请求复用最旧的窗口（资源评估 §7-P1-1）。
const MAX_PREVIEWS: usize = 4;

fn previews() -> &'static Mutex<HashMap<String, PreviewData>> {
    PREVIEWS.get_or_init(Default::default)
}

fn preview_id(label: &str) -> u64 {
    label
        .strip_prefix("visual-preview-")
        .and_then(|rest| rest.parse::<u64>().ok())
        .unwrap_or(u64::MAX)
}

fn preview_title(data: &PreviewData) -> &'static str {
    if data.locale == "en" {
        "InkNote — Diagram and formula preview"
    } else {
        "墨笺 — 图表与公式预览"
    }
}

fn create_preview_window(app: &tauri::AppHandle, data: &PreviewData) -> Result<String, String> {
    let label = format!("visual-preview-{}", NEXT_ID.fetch_add(1, Ordering::Relaxed));
    let theme = if data.theme == "dark" {
        tauri::Theme::Dark
    } else {
        tauri::Theme::Light
    };
    previews().lock().unwrap().insert(label.clone(), data.clone());
    let result = WebviewWindowBuilder::new(
        app,
        &label,
        WebviewUrl::App("index.html?visual-preview=1".into()),
    )
    .title(preview_title(data))
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
            let destroyed_label = label.clone();
            preview.on_window_event(move |event| {
                if matches!(event, tauri::WindowEvent::Destroyed) {
                    previews().lock().unwrap().remove(&destroyed_label);
                }
            });
            Ok(label)
        }
        Err(error) => {
            previews().lock().unwrap().remove(&label);
            Err(error.to_string())
        }
    }
}

#[tauri::command]
pub async fn open_visual_preview(
    app: tauri::AppHandle,
    window: WebviewWindow,
    data: PreviewData,
) -> Result<(), String> {
    if !window.label().starts_with("main") || !matches!(data.kind.as_str(), "mermaid" | "math") {
        return Err("invalid preview request".into());
    }

    // 复用策略：同 kind 的存活窗口直接更新内容；否则上限内新建；超限复用最旧。
    let previews = previews();
    let mut target: Option<String> = {
        let map = previews.lock().unwrap();
        map.iter()
            .find(|(_, existing)| existing.kind == data.kind)
            .map(|(label, _)| label.clone())
            .filter(|label| app.get_webview_window(label).is_some())
    };
    if target.is_none() {
        let oldest = {
            let map = previews.lock().unwrap();
            if map.len() >= MAX_PREVIEWS {
                map.keys()
                    .min_by_key(|label| preview_id(label))
                    .cloned()
                    .filter(|label| app.get_webview_window(label).is_some())
            } else {
                None
            }
        };
        target = match oldest {
            Some(label) => {
                previews.lock().unwrap().remove(&label);
                Some(label)
            }
            None => None,
        };
    }

    let label = match target {
        // 复用已有窗口：更新数据后通知其 webview 重渲染。
        Some(label) => {
            previews.lock().unwrap().insert(label.clone(), data.clone());
            label
        }
        // 新建窗口。
        None => create_preview_window(&app, &data)?,
    };

    if let Some(existing) = app.get_webview_window(&label) {
        let _ = existing.unminimize();
        let _ = existing.show();
        let _ = existing.set_focus();
    }
    let _ = app.emit_to(label.as_str(), "visual-preview-updated", data);
    Ok(())
}

#[tauri::command]
pub fn get_visual_preview(window: WebviewWindow) -> Result<PreviewData, String> {
    previews()
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
    previews().lock().unwrap().clear();
}
