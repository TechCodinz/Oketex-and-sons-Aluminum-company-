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
    navigator.serviceWorker.register("/sw.js").then((reg) => {
      // Self-apply future deploys: when a NEW worker finishes installing
      // while this page is still controlled by the old one, reload ONCE
      // (sessionStorage guard prevents any reload loop) so returning
      // visitors never sit on a stale cached build.
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener("statechange", () => {
          if (nw.state === "installed" && navigator.serviceWorker.controller && !sessionStorage.getItem("oketex-sw-reloaded")) {
            sessionStorage.setItem("oketex-sw-reloaded", "1");
            window.location.reload();
          }
        });
      });
    }).catch(() => { /* SW is an enhancement, never a blocker */ });
  });
}
