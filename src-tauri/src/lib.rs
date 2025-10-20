// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use std::time::Duration;

use reqwest::blocking::Client;
use reqwest::Url;
use headless_chrome::{Browser, LaunchOptions};
use tokio::time::timeout;
use futures::future::join_all;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn proxy_http_request(url: String, method: String, body: Option<String>) -> Result<String, String> {
    eprintln!("[Rust Proxy] Request: {} {}", method, url);
    
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to build client: {}", e))?;
    
    let request = match method.to_uppercase().as_str() {
        "GET" => client.get(&url),
        "POST" => {
            let mut req = client.post(&url);
            if let Some(b) = body {
                req = req.header("Content-Type", "application/json").body(b);
            }
            req
        }
        _ => return Err(format!("Unsupported method: {}", method)),
    };
    
    let response = request
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;
    
    let status = response.status();
    eprintln!("[Rust Proxy] Response status: {}", status);
    
    if !status.is_success() {
        return Err(format!("Request failed with status: {}", status));
    }
    
    let text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;
    
    eprintln!("[Rust Proxy] Response length: {} bytes", text.len());
    Ok(text)
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
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0")
        .build()
        .map_err(|err| format!("Failed to build HTTP client: {err}"))?;

    let response = client
        .get(parsed.clone())
        .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8")
        .header("Accept-Language", "en-US,en;q=0.9")
        .header("Accept-Encoding", "gzip, deflate, br")
        .header("DNT", "1")
        .header("Connection", "keep-alive")
        .header("Upgrade-Insecure-Requests", "1")
        .send()
        .map_err(|err| format!("Request failed: {err}"))?;

    if !response.status().is_success() {
        return Err(format!("Request failed with status {}", response.status()));
    }

    response
        .text()
        .map_err(|err| format!("Failed to read response body: {err}"))
}

#[tauri::command]
fn fetch_url_browser(url: String, browser_path: Option<String>) -> Result<String, String> {
    let parsed = Url::parse(&url).map_err(|err| format!("Invalid URL: {err}"))?;

    match parsed.scheme() {
        "http" | "https" => {}
        _ => return Err("Only http and https schemes are allowed".to_string()),
    }

    // Launch headless browser with custom path if provided
    let mut launch_options = LaunchOptions {
        headless: true,
        sandbox: false,
        ..Default::default()
    };
    
    // Use provided path, or try to find Chrome automatically
    if let Some(path) = browser_path {
        launch_options.path = Some(std::path::PathBuf::from(path));
    } else if let Some(path) = find_chrome_path() {
        launch_options.path = Some(path);
    }
    
    let browser = Browser::new(launch_options)
        .map_err(|err| format!("Failed to launch browser: {err}"))?;

    // Create a new tab
    let tab = browser
        .new_tab()
        .map_err(|err| format!("Failed to create tab: {err}"))?;

    // Navigate to URL with timeout
    tab.navigate_to(&url)
        .map_err(|err| format!("Failed to navigate: {err}"))?;

    tab.wait_until_navigated()
        .map_err(|err| format!("Navigation timeout: {err}"))?;

    // Wait a bit for JavaScript to execute
    std::thread::sleep(Duration::from_millis(1000));

    // Get the page HTML
    let html = tab
        .get_content()
        .map_err(|err| format!("Failed to get content: {err}"))?;

    Ok(html)
}

#[derive(serde::Serialize, serde::Deserialize)]
struct SearchResult {
    title: String,
    url: String,
    snippet: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
struct ScrapedContent {
    url: String,
    title: String,
    content: String,
    metadata: ContentMetadata,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
struct ContentMetadata {
    #[serde(skip_serializing_if = "Option::is_none")]
    published_date: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    author: Option<String>,
    domain: String,
    word_count: usize,
}

#[derive(serde::Serialize, serde::Deserialize)]
struct ScrapeResult {
    success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    content: Option<ScrapedContent>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[tauri::command]
fn web_search_and_scrape(query: String, max_results: Option<usize>) -> Result<Vec<ScrapedContent>, String> {
    let _limit = max_results.unwrap_or(5);
    
    // Step 1: Search DuckDuckGo using POST (required by DuckDuckGo)
    let _search_html = search_duckduckgo(&query)?;
    
    // Step 2: Parse search results (done in frontend, so we return empty for now)
    // Frontend will handle parsing and call backend for scraping individual URLs
    
    Ok(Vec::new())
}

#[tauri::command]
fn search_duckduckgo(query: &str) -> Result<String, String> {
    // reqwest automatically handles decompression when using .text()
    // The key is to NOT manually set Accept-Encoding header
    let client = Client::builder()
        .timeout(Duration::from_secs(20))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0")
        .build()
        .map_err(|err| format!("Failed to build HTTP client: {err}"))?;

    // DuckDuckGo requires POST request with form data
    let params = [("q", query), ("b", ""), ("kl", "wt-wt")];
    
    eprintln!("Searching DuckDuckGo for: {}", query);
    
    let response = client
        .post("https://html.duckduckgo.com/html/")
        .form(&params)
        .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8")
        .header("Accept-Language", "en-US,en;q=0.9")
        // NOTE: Do NOT set Accept-Encoding - let reqwest handle it automatically
        .header("DNT", "1")
        .header("Connection", "keep-alive")
        .header("Upgrade-Insecure-Requests", "1")
        .send()
        .map_err(|err| format!("Request failed: {err}"))?;

    eprintln!("Response status: {}", response.status());
    eprintln!("Response headers: {:?}", response.headers());

    if !response.status().is_success() {
        return Err(format!("Request failed with status {}", response.status()));
    }

    // Using .text() automatically handles decompression
    let text = response
        .text()
        .map_err(|err| format!("Failed to read response body: {err}"))?;
    
    // Debug: Log response info
    eprintln!("Received {} characters of text", text.len());
    eprintln!("First 200 chars: {}", &text.chars().take(200).collect::<String>());
    
    Ok(text)
}

// Parsing is done in frontend (TypeScript has better HTML parsing)
// This function is kept for future backend parsing implementation
#[allow(dead_code)]
fn parse_duckduckgo_results(_html: &str, _limit: usize) -> Result<Vec<SearchResult>, String> {
    let results = Vec::new();
    Ok(results)
}

// Helper function to extract domain from URL
fn extract_domain(url: &str) -> String {
    Url::parse(url)
        .ok()
        .and_then(|u| u.host_str().map(|h| h.to_string()))
        .unwrap_or_else(|| "unknown".to_string())
}

// Helper function to clean and normalize text
fn clean_text(text: &str) -> String {
    // Normalize whitespace
    text.split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_string()
}

// Helper function to scrape a single URL with retry mechanism
fn scrape_single_url_with_retry(url: String, timeout_ms: u64, max_retries: u32) -> ScrapeResult {
    let mut attempts = 0;
    let mut last_error = String::new();
    
    while attempts < max_retries {
        attempts += 1;
        
        match scrape_single_url_internal(&url, timeout_ms) {
            Ok(content) => {
                return ScrapeResult {
                    success: true,
                    content: Some(content),
                    error: None,
                };
            }
            Err(err) => {
                last_error = format!("Attempt {}/{}: {}", attempts, max_retries, err);
                eprintln!("Error scraping {}: {}", url, last_error);
                
                // Wait before retry (exponential backoff)
                if attempts < max_retries {
                    let wait_ms = 1000 * (2_u64.pow(attempts - 1));
                    std::thread::sleep(Duration::from_millis(wait_ms));
                }
            }
        }
    }
    
    ScrapeResult {
        success: false,
        content: None,
        error: Some(last_error),
    }
}

// Fallback function to scrape using reqwest (no browser)
fn scrape_with_reqwest(url: &str, timeout_ms: u64) -> Result<ScrapedContent, String> {
    let client = Client::builder()
        .timeout(Duration::from_millis(timeout_ms))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0")
        .build()
        .map_err(|err| format!("Failed to build HTTP client: {err}"))?;

    let response = client
        .get(url)
        .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8")
        .header("Accept-Language", "en-US,en;q=0.9")
        .send()
        .map_err(|err| format!("Request failed: {err}"))?;

    if !response.status().is_success() {
        return Err(format!("Request failed with status {}", response.status()));
    }

    let html = response
        .text()
        .map_err(|err| format!("Failed to read response body: {err}"))?;

    // Simple HTML parsing - extract title and body text
    let title = html
        .split("<title>")
        .nth(1)
        .and_then(|s| s.split("</title>").next())
        .unwrap_or("Untitled")
        .to_string();

    // Very basic content extraction - just get the text
    let content = clean_text(&html);
    let word_count = content.split_whitespace().count();
    let domain = extract_domain(url);

    Ok(ScrapedContent {
        url: url.to_string(),
        title: clean_text(&title),
        content,
        metadata: ContentMetadata {
            published_date: None,
            author: None,
            domain,
            word_count,
        },
    })
}

// Helper function to find Chrome/Chromium on the system
fn find_chrome_path() -> Option<std::path::PathBuf> {
    // Common Chrome/Chromium paths on Windows
    let possible_paths = vec![
        // Chrome
        std::env::var("PROGRAMFILES").ok().map(|p| format!("{}\\Google\\Chrome\\Application\\chrome.exe", p)),
        std::env::var("PROGRAMFILES(X86)").ok().map(|p| format!("{}\\Google\\Chrome\\Application\\chrome.exe", p)),
        std::env::var("LOCALAPPDATA").ok().map(|p| format!("{}\\Google\\Chrome\\Application\\chrome.exe", p)),
        // Chromium
        std::env::var("PROGRAMFILES").ok().map(|p| format!("{}\\Chromium\\Application\\chrome.exe", p)),
        std::env::var("LOCALAPPDATA").ok().map(|p| format!("{}\\Chromium\\Application\\chrome.exe", p)),
        // Edge (Chromium-based)
        std::env::var("PROGRAMFILES(X86)").ok().map(|p| format!("{}\\Microsoft\\Edge\\Application\\msedge.exe", p)),
        std::env::var("PROGRAMFILES").ok().map(|p| format!("{}\\Microsoft\\Edge\\Application\\msedge.exe", p)),
    ];

    for path_opt in possible_paths {
        if let Some(path_str) = path_opt {
            let path = std::path::PathBuf::from(&path_str);
            if path.exists() {
                eprintln!("Found browser at: {}", path_str);
                return Some(path);
            }
        }
    }

    eprintln!("No Chrome/Chromium/Edge browser found on system");
    None
}

// Internal function to scrape a single URL
fn scrape_single_url_internal(url: &str, timeout_ms: u64) -> Result<ScrapedContent, String> {
    // Validate URL
    let parsed = Url::parse(url).map_err(|err| format!("Invalid URL: {err}"))?;
    
    match parsed.scheme() {
        "http" | "https" => {}
        _ => return Err("Only http and https schemes are allowed".to_string()),
    }
    
    // Try to find Chrome on the system
    let chrome_path = find_chrome_path();
    
    // Try to launch headless browser, fallback to reqwest if it fails
    let mut launch_options = LaunchOptions {
        headless: true,
        sandbox: false,
        ..Default::default()
    };
    
    // Use found Chrome path if available
    if let Some(path) = chrome_path {
        launch_options.path = Some(path);
    }
    
    let browser = match Browser::new(launch_options) {
        Ok(b) => b,
        Err(err) => {
            eprintln!("Failed to launch browser, falling back to reqwest: {}", err);
            return scrape_with_reqwest(url, timeout_ms);
        }
    };
    
    let tab = browser
        .new_tab()
        .map_err(|err| format!("Failed to create tab: {err}"))?;
    
    // Set timeout for navigation
    tab.set_default_timeout(Duration::from_millis(timeout_ms));
    
    // Navigate to URL
    tab.navigate_to(url)
        .map_err(|err| format!("Failed to navigate: {err}"))?;
    
    tab.wait_until_navigated()
        .map_err(|err| format!("Navigation timeout: {err}"))?;
    
    // Wait for content to load
    std::thread::sleep(Duration::from_millis(1500));
    
    // Extract content, metadata, and title using JavaScript
    let extraction_script = r#"
        (function() {
            try {
                // Extract main content
                let mainContent = document.querySelector('main, article, [role="main"], .main-content, #main-content, .content, #content');
                if (!mainContent) {
                    mainContent = document.body;
                }
                
                const content = mainContent ? mainContent.innerText : document.body.innerText;
                
                // Extract title
                const title = document.title || '';
                
                // Extract metadata with safe optional chaining
                let publishedDate = null;
                try {
                    const metaPublished = document.querySelector('meta[property="article:published_time"]');
                    if (metaPublished) publishedDate = metaPublished.content;
                    if (!publishedDate) {
                        const metaDate = document.querySelector('meta[name="date"]');
                        if (metaDate) publishedDate = metaDate.content;
                    }
                    if (!publishedDate) {
                        const timeEl = document.querySelector('time[datetime]');
                        if (timeEl) publishedDate = timeEl.getAttribute('datetime');
                    }
                } catch (e) {
                    console.error('Error extracting date:', e);
                }
                
                let author = null;
                try {
                    const metaAuthor = document.querySelector('meta[name="author"]');
                    if (metaAuthor) author = metaAuthor.content;
                    if (!author) {
                        const metaArticleAuthor = document.querySelector('meta[property="article:author"]');
                        if (metaArticleAuthor) author = metaArticleAuthor.content;
                    }
                    if (!author) {
                        const authorEl = document.querySelector('[rel="author"]');
                        if (authorEl) author = authorEl.textContent;
                    }
                } catch (e) {
                    console.error('Error extracting author:', e);
                }
                
                return {
                    content: content || '',
                    title: title || '',
                    publishedDate: publishedDate,
                    author: author
                };
            } catch (error) {
                console.error('Extraction error:', error);
                return {
                    content: document.body.innerText || '',
                    title: document.title || '',
                    publishedDate: null,
                    author: null
                };
            }
        })()
    "#;
    
    let result = tab
        .evaluate(extraction_script, false)
        .map_err(|err| format!("Failed to extract content: {err}"))?;
    
    eprintln!("Extraction result: {:?}", result);
    
    // Parse the result with better error handling
    let value = match result.value {
        Some(v) => v,
        None => {
            eprintln!("No value returned from extraction, trying fallback");
            // Fallback: try to get just the body text
            let fallback_script = "document.body.innerText";
            let fallback_result = tab
                .evaluate(fallback_script, false)
                .map_err(|err| format!("Fallback extraction failed: {err}"))?;
            
            if let Some(text) = fallback_result.value.and_then(|v| v.as_str().map(|s| s.to_string())) {
                let title_script = "document.title";
                let title_result = tab.evaluate(title_script, false).ok();
                let title = title_result
                    .and_then(|r| r.value)
                    .and_then(|v| v.as_str().map(|s| s.to_string()))
                    .unwrap_or_else(|| "Untitled".to_string());
                
                let cleaned_content = clean_text(&text);
                let word_count = cleaned_content.split_whitespace().count();
                let domain = extract_domain(url);
                
                return Ok(ScrapedContent {
                    url: url.to_string(),
                    title: clean_text(&title),
                    content: cleaned_content,
                    metadata: ContentMetadata {
                        published_date: None,
                        author: None,
                        domain,
                        word_count,
                    },
                });
            } else {
                return Err("No value returned from extraction and fallback failed".to_string());
            }
        }
    };
    
    let content_text = value
        .get("content")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    
    let title = value
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("Untitled")
        .to_string();
    
    let published_date = value
        .get("publishedDate")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    
    let author = value
        .get("author")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    
    // Clean the content
    let cleaned_content = clean_text(&content_text);
    
    // Calculate word count
    let word_count = cleaned_content.split_whitespace().count();
    
    // Extract domain
    let domain = extract_domain(url);
    
    Ok(ScrapedContent {
        url: url.to_string(),
        title: clean_text(&title),
        content: cleaned_content,
        metadata: ContentMetadata {
            published_date,
            author,
            domain,
            word_count,
        },
    })
}

// Async wrapper for scraping with timeout
async fn scrape_url_async(url: String, timeout_ms: u64, max_retries: u32) -> ScrapeResult {
    // Run the blocking scrape operation in a separate thread
    let result = tokio::task::spawn_blocking(move || {
        scrape_single_url_with_retry(url, timeout_ms, max_retries)
    });
    
    // Apply timeout to the entire operation
    match timeout(Duration::from_millis(timeout_ms + 5000), result).await {
        Ok(Ok(scrape_result)) => scrape_result,
        Ok(Err(err)) => ScrapeResult {
            success: false,
            content: None,
            error: Some(format!("Task error: {}", err)),
        },
        Err(_) => ScrapeResult {
            success: false,
            content: None,
            error: Some("Overall timeout exceeded".to_string()),
        },
    }
}

// Main command to scrape multiple URLs in parallel
#[tauri::command]
async fn scrape_urls(
    urls: Vec<String>,
    timeout_ms: Option<u64>,
    max_retries: Option<u32>,
    max_concurrent: Option<usize>,
) -> Result<Vec<ScrapeResult>, String> {
    let timeout_ms = timeout_ms.unwrap_or(30000); // Default 30 seconds
    let max_retries = max_retries.unwrap_or(3); // Default 3 retries
    let max_concurrent = max_concurrent.unwrap_or(5); // Default 5 concurrent requests
    
    if urls.is_empty() {
        return Ok(Vec::new());
    }
    
    eprintln!("Starting scrape of {} URLs with max {} concurrent requests", urls.len(), max_concurrent);
    
    // Process URLs in batches to limit concurrency
    let mut all_results = Vec::new();
    
    for chunk in urls.chunks(max_concurrent) {
        let futures: Vec<_> = chunk
            .iter()
            .map(|url| {
                let url = url.clone();
                scrape_url_async(url, timeout_ms, max_retries)
            })
            .collect();
        
        let results = join_all(futures).await;
        all_results.extend(results);
    }
    
    // Log summary
    let successful = all_results.iter().filter(|r| r.success).count();
    let failed = all_results.len() - successful;
    eprintln!("Scraping complete: {} successful, {} failed", successful, failed);
    
    Ok(all_results)
}

// Command to scrape a single URL (for convenience)
#[tauri::command]
async fn scrape_url(
    url: String,
    timeout_ms: Option<u64>,
    max_retries: Option<u32>,
) -> Result<ScrapeResult, String> {
    let timeout_ms = timeout_ms.unwrap_or(30000);
    let max_retries = max_retries.unwrap_or(3);
    
    Ok(scrape_url_async(url, timeout_ms, max_retries).await)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            greet, 
            fetch_url, 
            fetch_url_browser, 
            web_search_and_scrape, 
            search_duckduckgo,
            scrape_urls,
            scrape_url,
            proxy_http_request
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
