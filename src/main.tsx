import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import { CartProvider } from "@/lib/cart"
import App from './App.tsx'
createRoot(document.getElementById('root')!).render(
  <StrictMode><BrowserRouter><CartProvider><App /></CartProvider></BrowserRouter></StrictMode>,
)
