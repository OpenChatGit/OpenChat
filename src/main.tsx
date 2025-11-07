import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ToastProvider } from "./hooks/useToast";
import "./index.css";

// Apply saved theme immediately before React renders to prevent flash
(async () => {
  try {
    const savedTheme = localStorage.getItem('theme');
    let theme = savedTheme ? JSON.parse(savedTheme) : 'system';
    
    // If theme is 'system', try to get from Tauri window
    if (theme === 'system') {
      try {
        if (typeof window !== 'undefined' && '__TAURI__' in window) {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          const currentWindow = getCurrentWindow();
          const windowTheme = await currentWindow.theme();
          
          console.log('[Theme Init] Tauri window theme:', windowTheme);
          theme = windowTheme === 'light' ? 'light' : 'dark';
        } else {
          // Fallback to CSS media query
          const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
          theme = prefersDark ? 'dark' : 'light';
        }
      } catch (error) {
        console.warn('[Theme Init] Failed to get Tauri theme, using media query:', error);
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        theme = prefersDark ? 'dark' : 'light';
      }
    }
    
    console.log('[Theme Init] Setting initial theme:', theme);
    document.documentElement.setAttribute('data-theme', theme);
  } catch (error) {
    console.error('[Theme Init] Failed to load theme:', error);
    // Fallback to dark
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
);
