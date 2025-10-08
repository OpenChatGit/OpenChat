// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use std::time::Duration;

use reqwest::blocking::Client;
use reqwest::Url;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn fetch_url(url: String) -> Result<String, String> {
    let parsed = Url::parse(&url).map_err(|err| format!("Invalid URL: {err}"))?;

    match parsed.scheme() {
        "http" | "https" => {}
        _ => return Err("Only http and https schemes are allowed".to_string()),
    }

    let client = Client::builder()
        .timeout(Duration::from_secs(20))
        .user_agent("OpenChat-WebSearch/1.0")
        .build()
        .map_err(|err| format!("Failed to build HTTP client: {err}"))?;

    let response = client
        .get(parsed.clone())
        .send()
        .map_err(|err| format!("Request failed: {err}"))?;

    if !response.status().is_success() {
        return Err(format!("Request failed with status {}", response.status()));
    }

    response
        .text()
        .map_err(|err| format!("Failed to read response body: {err}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, fetch_url])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
