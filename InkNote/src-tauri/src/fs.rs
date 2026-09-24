//! 预览支撑的文件系统命令与搜索白名单。
//!
//! 白名单单一来源：`src/preview/searchableExtensions.json`（前端 import 同一文件），
//! 本模块通过 `include_str!` 在编译期读入，双端不会漂移。

use serde::Serialize;
use std::sync::OnceLock;

/// 预览读盘的单文件上限：200 MiB。超限由 IO 侧拒绝，前端仅做展示降级。
pub const PREVIEW_MAX_BYTES: u64 = 200 * 1024 * 1024;

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FileStat {
    pub size: u64,
    pub is_dir: bool,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExtensionWhitelist {
    #[serde(default)]
    searchable_text_extensions: Vec<String>,
    #[serde(default)]
    previewable_extensions: Vec<String>,
}

fn whitelist() -> &'static ExtensionWhitelist {
    static WHITELIST: OnceLock<ExtensionWhitelist> = OnceLock::new();
    WHITELIST.get_or_init(|| {
        serde_json::from_str(include_str!("../../src/preview/searchableExtensions.json"))
        .unwrap_or_else(|error| {
            log::error!("invalid searchableExtensions.json: {error}");
            ExtensionWhitelist {
                searchable_text_extensions: vec![
                    "md".into(),
                    "markdown".into(),
                    "txt".into(),
                ],
                previewable_extensions: Vec::new(),
            }
        })
    })
}

fn ext_of(name: &str) -> Option<String> {
    let lower = name.to_ascii_lowercase();
    let dot = lower.rfind('.')?;
    let ext = &lower[dot + 1..];
    if ext.is_empty() {
        return None;
    }
    // 扩展名只允许 [a-z0-9]，避免把无后缀文件或怪异后缀误判
    if !ext.chars().all(|c| c.is_ascii_alphanumeric()) {
        return None;
    }
    Some(ext.to_string())
}

/// 内容搜索收录：文本类扩展名。
pub fn is_searchable_text_ext(name: &str) -> bool {
    match ext_of(name) {
        Some(ext) => whitelist().searchable_text_extensions.iter().any(|e| *e == ext),
        None => false,
    }
}

/// 文件名列表收录（快速打开 / 文件树过滤）：可预览全部扩展名。
pub fn is_previewable_ext(name: &str) -> bool {
    match ext_of(name) {
        Some(ext) => {
            let w = whitelist();
            w.searchable_text_extensions.iter().any(|e| *e == ext)
                || w.previewable_extensions.iter().any(|e| *e == ext)
        }
        None => false,
    }
}

fn stat_metadata(path: &str) -> Result<std::fs::Metadata, String> {
    std::fs::metadata(path).map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            "file_not_found".to_string()
        } else {
            error.to_string()
        }
    })
}

#[tauri::command]
pub fn stat_file(path: String) -> Result<FileStat, String> {
    let meta = stat_metadata(&path)?;
    Ok(FileStat {
        size: meta.len(),
        is_dir: meta.is_dir(),
    })
}

/// 预览用二进制读取（核心逻辑，供测试）。
pub fn read_binary_bytes(path: &str) -> Result<Vec<u8>, String> {
    let meta = stat_metadata(path)?;
    if meta.is_dir() {
        return Err("invalid_source_file".to_string());
    }
    if meta.len() > PREVIEW_MAX_BYTES {
        return Err("preview_file_too_large".to_string());
    }
    std::fs::read(path).map_err(|error| error.to_string())
}

/// 预览用二进制读取命令。返回原始字节（`ipc::Response`），
/// 避免 `Vec<u8>` 走 JSON 数字数组的序列化放大。
#[tauri::command]
pub fn read_binary_file(path: String) -> Result<tauri::ipc::Response, String> {
    read_binary_bytes(&path).map(tauri::ipc::Response::new)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn classifies_extensions_from_shared_whitelist() {
        // 文本类：可搜索也可列出
        assert!(is_searchable_text_ext("note.md"));
        assert!(is_searchable_text_ext("NOTE.MD"));
        assert!(is_searchable_text_ext("main.rs"));
        assert!(is_searchable_text_ext("README.markdown"));
        assert!(is_searchable_text_ext("notes.txt"));
        // 二进制可预览：仅列出，不进内容搜索
        assert!(is_previewable_ext("doc.pdf"));
        assert!(is_previewable_ext("IMG.PNG"));
        assert!(is_previewable_ext("table.xlsx"));
        assert!(!is_searchable_text_ext("doc.pdf"));
        assert!(!is_searchable_text_ext("img.png"));
        // 未知/无后缀/怪后缀
        assert!(!is_searchable_text_ext("file.unknown"));
        assert!(!is_previewable_ext("file.unknown"));
        assert!(!is_searchable_text_ext("Dockerfile"));
        assert!(is_previewable_ext("archive.tar.gz")); // 按最后一段 gz 匹配
        assert!(!is_previewable_ext("weird."));
    }

    #[test]
    fn read_binary_file_reports_expected_errors() {
        let dir = std::env::temp_dir().join(format!("inknote-fs-test-{}", std::process::id()));
        std::fs::create_dir_all(dir.join("sub")).unwrap();

        // 不存在
        assert_eq!(
            read_binary_bytes(&dir.join("missing.bin").to_string_lossy()).unwrap_err(),
            "file_not_found"
        );
        // 目录
        assert_eq!(
            read_binary_bytes(&dir.join("sub").to_string_lossy()).unwrap_err(),
            "invalid_source_file"
        );
        // 超限（稀疏文件，不占磁盘）
        let big = dir.join("big.bin");
        let file = std::fs::File::create(&big).unwrap();
        file.set_len(PREVIEW_MAX_BYTES + 1).unwrap();
        assert_eq!(
            read_binary_bytes(&big.to_string_lossy()).unwrap_err(),
            "preview_file_too_large"
        );
        // 正常读取
        let small = dir.join("small.bin");
        std::fs::File::create(&small)
            .unwrap()
            .write_all(b"hello")
            .unwrap();
        assert_eq!(read_binary_bytes(&small.to_string_lossy()).unwrap(), b"hello".to_vec());

        std::fs::remove_dir_all(&dir).ok();
    }
}
