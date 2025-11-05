import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ToastProvider } from "./hooks/useToast";
import "./index.css";

// Apply saved theme immediately before React renders to prevent flash
try {
  const savedTheme = localStorage.getItem('theme');
  const theme = savedTheme ? JSON.parse(savedTheme) : 'dark';
  document.documentElement.setAttribute('data-theme', theme);
} catch (error) {
  console.error('Failed to load theme:', error);
  document.documentElement.setAttribute('data-theme', 'dark');
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
);
