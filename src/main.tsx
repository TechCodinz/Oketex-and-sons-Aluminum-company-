import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import { CartProvider } from "@/lib/cart"
import { LanguageProvider } from "@/lib/i18n"
import App from './App.tsx'
createRoot(document.getElementById('root')!).render(
  <StrictMode><BrowserRouter><LanguageProvider><CartProvider><App /></CartProvider></LanguageProvider></BrowserRouter></StrictMode>,
)
// PWA (Phase 6): register the service worker in production only. The SW
// never caches /api/* and falls back to the cached shell offline.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => { /* SW is an enhancement, never a blocker */ });
  });
}
