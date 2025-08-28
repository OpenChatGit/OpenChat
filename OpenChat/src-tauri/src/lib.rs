use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use tauri::Emitter;
use std::collections::VecDeque;
use std::sync::Mutex;
use std::time::{Duration, Instant};

// Global HTTP clients to keep connections warm and enable TCP_NODELAY
lazy_static::lazy_static! {
    static ref HTTP_CLIENT: reqwest::Client = reqwest::Client::builder()
        .tcp_nodelay(true)
        .timeout(Duration::from_secs(120))
        .build()
        .expect("init async http client");
    static ref HTTP_CLIENT_BLOCKING: reqwest::blocking::Client = reqwest::blocking::Client::builder()
        .tcp_nodelay(true)
        .timeout(Duration::from_secs(60))
        .build()
        .expect("init blocking http client");
}

// -----------------
// Streaming AI Response (Ollama stream=true)
// -----------------

#[tauri::command]
fn generate_ai_response_stream(window: tauri::Window, message: &str, model: Option<String>) -> Result<(), String> {
    let prompt = message.to_string();
    let model = model.unwrap_or_else(|| "llama3.1".to_string());

    tauri::async_runtime::spawn(async move {
        let client = HTTP_CLIENT.clone();

        let body = serde_json::json!({
            "model": model,
            "prompt": prompt,
            "stream": true,
            // Keep model in memory after request for faster subsequent responses
            "keep_alive": "10m"
        });

        let resp = client
            .post("http://127.0.0.1:11434/api/generate")
            .json(&body)
            .send()
            .await;

        let mut resp = match resp {
            Ok(r) => r,
            Err(e) => {
                let _ = window.emit("ai_error", format!("Request failed: {}", e));
                return;
            }
        };

        if !resp.status().is_success() {
            let _ = window.emit("ai_error", format!("HTTP status {}", resp.status()));
            return;
        }

        let mut acc = String::new();
        let mut buf = String::new();
        let mut done_emitted = false;

        while let Some(chunk) = resp.chunk().await.unwrap_or(None) {
            if chunk.is_empty() { continue; }
            let s = String::from_utf8_lossy(&chunk).to_string();
            buf.push_str(&s);

            // Process complete lines (Ollama streams JSON per line)
            loop {
                if let Some(pos) = buf.find('\n') {
                    let line: String = buf.drain(..=pos).collect();
                    let line = line.trim();
                    if line.is_empty() { continue; }
                    if let Ok(v) = serde_json::from_str::<JsonValue>(line) {
                        if let Some(t) = v.get("response").and_then(|x| x.as_str()) {
                            acc.push_str(t);
                            let _ = window.emit("ai_token", t);
                        }
                        if v.get("done").and_then(|x| x.as_bool()).unwrap_or(false) {
                            let _ = window.emit("ai_done", &acc);
                            done_emitted = true;
                        }
                    }
                } else {
                    break;
                }
            }
        }

        // After the stream ends, there may be a final JSON line without a trailing newline
        let tail = buf.trim();
        if !tail.is_empty() {
            if let Ok(v) = serde_json::from_str::<JsonValue>(tail) {
                if let Some(t) = v.get("response").and_then(|x| x.as_str()) {
                    acc.push_str(t);
                    let _ = window.emit("ai_token", t);
                }
                if v.get("done").and_then(|x| x.as_bool()).unwrap_or(false) {
                    let _ = window.emit("ai_done", &acc);
                    done_emitted = true;
                }
            }
        }

        // Ensure the frontend always receives a completion signal
        if !done_emitted {
            let _ = window.emit("ai_done", &acc);
        }
    });

    Ok(())
}

#[derive(Deserialize)]
struct OllamaGenerateResponse {
    response: Option<String>,
}

// AI Response generation command (calls local Ollama)
#[tauri::command]
fn generate_ai_response(message: &str, model: Option<String>) -> String {
    // Determine model or fallback
    let model = model.unwrap_or_else(|| "llama3.1".to_string());

    // Use shared blocking HTTP client
    let client = HTTP_CLIENT_BLOCKING.clone();

    // Prepare request body (include keep_alive to avoid cold starts)
    let body = serde_json::json!({
        "model": model,
        "prompt": message,
        "stream": false,
        "keep_alive": "10m"
    });

    // Call Ollama
    let resp = client
        .post("http://127.0.0.1:11434/api/generate")
        .json(&body)
        .send();

    match resp {
        Ok(r) => {
            if !r.status().is_success() {
                return format!(
                    "Ollama Fehler ({}): Bitte prüfe, ob Ollama läuft und das Modell '{}' vorhanden ist.",
                    r.status(),
                    model
                );
            }
            match r.json::<OllamaGenerateResponse>() {
                Ok(parsed) => parsed
                    .response
                    .unwrap_or_else(|| "(Leere Antwort von Ollama)".to_string()),
                Err(e) => format!("Antwort konnte nicht gelesen werden: {}", e),
            }
        }
        Err(e) => format!(
            "Konnte keine Verbindung zu Ollama herstellen: {}. Läuft Ollama auf 127.0.0.1:11434?",
            e
        ),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![generate_ai_response, web_search, generate_ai_response_stream, warm_model])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// -----------------
// Web Search Tool
// -----------------

#[derive(Serialize, Deserialize, Debug, Clone)]
struct SearchResult {
    title: String,
    url: String,
    snippet: String,
}

// Simple rate limiter: max 10 calls per minute
lazy_static::lazy_static! {
    static ref RATE_LIMIT_WINDOW: Mutex<VecDeque<Instant>> = Mutex::new(VecDeque::new());
}

fn allow_web_target(url: &str) -> bool {
    // Strict allowlist to avoid being blocked or abused
    url.contains("duckduckgo.com")
}

fn rate_limited() -> bool {
    let now = Instant::now();
    let mut q = RATE_LIMIT_WINDOW.lock().unwrap();
    // Drop entries older than 60s
    while let Some(&front) = q.front() {
        if now.duration_since(front) > Duration::from_secs(60) { q.pop_front(); } else { break; }
    }
    if q.len() >= 10 { return true; }
    q.push_back(now);
    false
}

#[derive(Deserialize)]
struct DdgAnswer {
    #[serde(default, rename = "AbstractText")]
    abstract_text: String,
    #[serde(default, rename = "AbstractURL")]
    abstract_url: String,
    #[serde(default, rename = "Heading")]
    heading: String,
    #[serde(default, rename = "RelatedTopics")]
    related_topics: Vec<DdgTopic>,
}

#[derive(Deserialize)]
struct DdgTopic {
    #[serde(default, rename = "Text")]
    text: String,
    #[serde(default, rename = "FirstURL")]
    first_url: String,
    // we don't read icons; keep but prefix with underscore to avoid dead_code warning
    #[serde(default, rename = "Icon")]
    _icon: Option<DdgIcon>,
}

#[derive(Deserialize)]
struct DdgIcon {
    #[allow(dead_code)]
    #[serde(rename = "URL")]
    url: Option<String>,
}

#[tauri::command]
fn web_search(query: &str, max_results: Option<u8>) -> Result<Vec<SearchResult>, String> {
    if query.trim().is_empty() { return Ok(vec![]); }
    if rate_limited() { return Err("Rate limited: too many web searches, please try again soon.".into()); }

    let max = max_results.unwrap_or(5).min(10);
    let endpoint = format!(
        "https://api.duckduckgo.com/?q={}&format=json&no_redirect=1&no_html=1",
        urlencoding::encode(query)
    );

    if !allow_web_target(&endpoint) {
        return Err("Blocked target domain".into());
    }

    let client = HTTP_CLIENT_BLOCKING.clone();

    let resp = client
        .get(&endpoint)
        .header(reqwest::header::USER_AGENT, "OpenChat/0.1 (+https://github.com)")
        .send()
        .map_err(|e| format!("Web request failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Web search error: HTTP {}", resp.status()));
    }

    let data: DdgAnswer = resp
        .json()
        .map_err(|e| format!("Parse response failed: {}", e))?;

    let mut results: Vec<SearchResult> = Vec::new();
    if !data.heading.is_empty() || !data.abstract_text.is_empty() {
        results.push(SearchResult {
            title: if data.heading.is_empty() { "Result".into() } else { data.heading },
            url: data.abstract_url,
            snippet: data.abstract_text,
        });
    }

    for t in data.related_topics.into_iter() {
        if t.text.is_empty() || t.first_url.is_empty() { continue; }
        results.push(SearchResult { title: t.text.clone(), url: t.first_url.clone(), snippet: t.text });
        if results.len() as u8 >= max { break; }
    }

    Ok(results)
}

// -----------------
// Model Warm-Up (Keeps model loaded for faster first token)
// -----------------

#[tauri::command]
fn warm_model(model: Option<String>) -> Result<(), String> {
    let model = model.unwrap_or_else(|| "llama3.1".to_string());

    // Run in background to avoid blocking the UI thread
    tauri::async_runtime::spawn(async move {
        let client = HTTP_CLIENT.clone();

        // Minimal generate call that loads the model and keeps it hot
        let body = serde_json::json!({
            "model": model,
            "prompt": "",
            "stream": false,
            "keep_alive": "10m",
            // Ask for 1 token to ensure load; output is ignored
            "options": { "num_predict": 1 }
        });

        let _ = client
            .post("http://127.0.0.1:11434/api/generate")
            .json(&body)
            .send()
            .await;
    });

    Ok(())
}
